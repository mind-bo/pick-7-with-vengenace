import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { ServerMsg, View } from "../src/shared/protocol";

const app = (path: string, init?: RequestInit) => exports.default.fetch(new Request("https://pick7.test" + path, init));

async function createRoomApi(name: string): Promise<{ code: string; token: string }> {
  const res = await app("/api/rooms", { method: "POST", body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error("create failed: " + res.status);
  return res.json();
}

/** One phone: a real WebSocket plus a log of every message it received. */
class Phone {
  readonly log: ServerMsg[] = [];
  private cursor = 0;
  closed = false;
  static sent = 0; // messages sent by all phones, for AC-N06
  private constructor(private ws: WebSocket) {
    ws.addEventListener("message", (e) => this.log.push(JSON.parse(e.data as string)));
    ws.addEventListener("close", () => (this.closed = true));
  }

  static async connect(code: string): Promise<Phone> {
    const res = await app(`/api/rooms/${code}/ws`, { headers: { Upgrade: "websocket" } });
    if (!res.webSocket) throw new Error("no websocket, status " + res.status);
    res.webSocket.accept();
    return new Phone(res.webSocket);
  }

  send(msg: object) {
    Phone.sent++;
    this.ws.send(JSON.stringify(msg));
  }

  /** Wait for the next message, after the last one matched, that satisfies the test. */
  async until<T extends ServerMsg>(test: (m: ServerMsg) => m is T, ms?: number): Promise<T>;
  async until(test: (m: ServerMsg) => boolean, ms?: number): Promise<ServerMsg>;
  async until(test: (m: ServerMsg) => boolean, ms = 2000): Promise<ServerMsg> {
    const deadline = Date.now() + ms;
    for (;;) {
      while (this.cursor < this.log.length) {
        const m = this.log[this.cursor++]!;
        if (test(m)) return m;
      }
      if (Date.now() > deadline) throw new Error("timeout; received " + JSON.stringify(this.log.slice(-3)));
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  async nextView(phase?: View["phase"]): Promise<View> {
    const m = await this.until((x): x is Extract<ServerMsg, { t: "view" }> => x.t === "view" && (!phase || x.view.phase === phase));
    return m.view;
  }

  close() {
    this.ws.close(1000);
  }
}

describe("rooms", () => {
  it("AC-R01: a created room has a 4-character code from the allowed set, and the host resumes into the lobby", async () => {
    const { code, token } = await createRoomApi("Ana");
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    const ana = await Phone.connect(code);
    ana.send({ t: "resume", token });
    const view = await ana.nextView("lobby");
    expect(view).toMatchObject({ phase: "lobby", code });
    if (view.phase === "lobby") expect(view.players.map((p) => p.name)).toEqual(["Ana"]);
  });
});

const isError = (m: ServerMsg): m is Extract<ServerMsg, { t: "error" }> => m.t === "error";
const isJoined = (m: ServerMsg): m is Extract<ServerMsg, { t: "joined" }> => m.t === "joined";

/** Create a room and connect the host. */
async function hostOf(name = "Ana") {
  const { code, token } = await createRoomApi(name);
  const phone = await Phone.connect(code);
  phone.send({ t: "resume", token });
  await phone.nextView("lobby");
  return { code, phone, token };
}

/** Connect a new player and join. */
async function joinAs(code: string, name: string) {
  const phone = await Phone.connect(code);
  phone.send({ t: "join", name });
  const { token } = await phone.until(isJoined);
  return { phone, token };
}

const names = (v: View) => (v.phase === "finished" ? [] : v.players.map((p) => p.name));

describe("joining", () => {
  it("AC-R03: a code in lower case reaches the same room", async () => {
    const { code } = await hostOf();
    const sam = await joinAs(code.toLowerCase(), "Sam");
    expect(names(await sam.phone.nextView("lobby"))).toEqual(["Ana", "Sam"]);
  });

  it("AC-R07: the host sees a joining player at once", async () => {
    const { code, phone: ana } = await hostOf();
    await joinAs(code, "Sam");
    const view = await ana.nextView("lobby");
    expect(names(view)).toEqual(["Ana", "Sam"]);
  });

  it("AC-R04: a repeated name is refused with NAME_TAKEN", async () => {
    const { code } = await hostOf();
    await joinAs(code, "Sam");
    const phone = await Phone.connect(code);
    phone.send({ t: "join", name: " sam " });
    expect((await phone.until(isError)).code).toBe("NAME_TAKEN");
  });

  it("AC-R05: an empty name is refused with BAD_NAME", async () => {
    const { code } = await hostOf();
    const phone = await Phone.connect(code);
    phone.send({ t: "join", name: "" });
    expect((await phone.until(isError)).code).toBe("BAD_NAME");
  });

  it("AC-R06: a code that does not exist gives Room not found", async () => {
    const res = await app("/api/rooms/ZZZZ/ws", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Room not found");
  });

  it("AC-P07: a bad token gets an error and no room data", async () => {
    const { code } = await hostOf();
    const phone = await Phone.connect(code);
    phone.send({ t: "resume", token: "not-a-token" });
    expect((await phone.until(isError)).code).toBe("NOT_IN_ROOM");
    await new Promise((r) => setTimeout(r, 100));
    expect(phone.log.filter((m) => m.t === "view")).toEqual([]);
  });

  it("AC-P07: a command from a socket with no token gets an error and no room data", async () => {
    const { code } = await hostOf();
    const phone = await Phone.connect(code);
    phone.send({ t: "start" });
    expect((await phone.until(isError)).code).toBe("NOT_IN_ROOM");
    expect(phone.log.filter((m) => m.t === "view")).toEqual([]);
  });

  it("a message that is not valid JSON gets MALFORMED", async () => {
    const { code } = await hostOf();
    const phone = await Phone.connect(code);
    (phone as unknown as { ws: WebSocket }).ws.send("{nope");
    expect((await phone.until(isError)).code).toBe("MALFORMED");
  });
});

type ViewMsg = Extract<ServerMsg, { t: "view" }>;
const viewWhere = async (phone: Phone, test: (v: View) => boolean, ms?: number): Promise<View> =>
  (await phone.until((m): m is ViewMsg => m.t === "view" && test(m.view), ms)).view;

const playing = (v: View) => {
  if (v.phase !== "playing") throw new Error("expected playing, got " + v.phase);
  return v;
};

interface Table {
  code: string;
  phones: Record<string, Phone>;
  tokens: Record<string, string>;
  ids: Record<string, string>;
}

/** A lobby with the named players. The first name is the host. Every phone has seen the full lobby. */
async function lobbyOf(...who: string[]): Promise<Table> {
  const host = await hostOf(who[0]);
  const table: Table = { code: host.code, phones: { [who[0]!]: host.phone }, tokens: { [who[0]!]: host.token }, ids: {} };
  for (const name of who.slice(1)) {
    const j = await joinAs(host.code, name);
    table.phones[name] = j.phone;
    table.tokens[name] = j.token;
  }
  for (const [name, phone] of Object.entries(table.phones)) {
    const v = await viewWhere(phone, (x) => x.phase === "lobby" && x.players.length === who.length);
    table.ids[name] = v.you;
  }
  return table;
}

/** A started game. Every phone has seen round 1. */
async function startedOf(...who: string[]): Promise<Table> {
  const t = await lobbyOf(...who);
  t.phones[who[0]!]!.send({ t: "start" });
  for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing");
  return t;
}

describe("start and remove", () => {
  it("AC-R08: two players cannot start", async () => {
    const t = await lobbyOf("Ana", "Sam");
    t.phones.Ana!.send({ t: "start" });
    expect((await t.phones.Ana!.until(isError)).code).toBe("NEED_3_PLAYERS");
  });

  it("AC-R09: three players start and every phone moves to round 1", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee");
    t.phones.Ana!.send({ t: "start" });
    for (const phone of Object.values(t.phones)) {
      expect(playing(await viewWhere(phone, (v) => v.phase === "playing")).round).toBe(1);
    }
  });

  it("AC-R10: a 13th player is refused with ROOM_FULL", async () => {
    const t = await lobbyOf("P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11");
    const late = await Phone.connect(t.code);
    late.send({ t: "join", name: "Late" });
    expect((await late.until(isError)).code).toBe("ROOM_FULL");
  });

  it("AC-R11: a new name after the start is refused with GAME_STARTED", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    const late = await Phone.connect(t.code);
    late.send({ t: "join", name: "Late" });
    expect((await late.until(isError)).code).toBe("GAME_STARTED");
  });

  it("AC-R12: a player who is not the host cannot start", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee");
    t.phones.Sam!.send({ t: "start" });
    expect((await t.phones.Sam!.until(isError)).code).toBe("HOST_ONLY");
  });

  it("AC-R13: the removed phone gets REMOVED and the others see the new list", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee", "Kim");
    t.phones.Ana!.send({ t: "remove", playerId: t.ids.Kim });
    expect((await t.phones.Kim!.until(isError)).code).toBe("REMOVED");
    const v = await viewWhere(t.phones.Sam!, (x) => x.phase === "lobby" && x.players.length === 3);
    expect(names(v)).toEqual(["Ana", "Sam", "Lee"]);
  });

  it("AC-L11: a removed player's token no longer works", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee", "Kim");
    t.phones.Ana!.send({ t: "remove", playerId: t.ids.Kim });
    await t.phones.Kim!.until(isError);
    const again = await Phone.connect(t.code);
    again.send({ t: "resume", token: t.tokens.Kim });
    expect((await again.until(isError)).code).toBe("NOT_IN_ROOM");
  });

  it("AC-R14: removal cannot go below 3 players", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee");
    t.phones.Ana!.send({ t: "remove", playerId: t.ids.Lee });
    expect((await t.phones.Ana!.until(isError)).code).toBe("NEED_3_PLAYERS");
  });

  it("AC-R15: the host cannot remove the host", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee", "Kim");
    t.phones.Ana!.send({ t: "remove", playerId: t.ids.Ana });
    expect((await t.phones.Ana!.until(isError)).code).toBe("BAD_STATE");
  });

  it("AC-R16: removing the one player still missing locks the round", async () => {
    const t = await startedOf("Ana", "Sam", "Lee", "Kim");
    for (const name of ["Ana", "Sam", "Lee"]) t.phones[name]!.send({ t: "submit", round: 1, entry: { kind: "bust" } });
    await viewWhere(t.phones.Ana!, (v) => v.phase === "playing" && v.submittedCount === 3);
    t.phones.Ana!.send({ t: "remove", playerId: t.ids.Kim });
    const v = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.round === 2));
    expect(v.yourHistory).toEqual([{ round: 1, score: 0 }]);
  });
});

const hand = (numbers: number[], o: { minus?: number[]; halve?: boolean } = {}) => ({
  kind: "hand",
  hand: { numbers, lucky13: false, secondThirteen: false, minus: [], halve: false, ...o },
});

describe("submit and lock", () => {
  it("AC-L02 and AC-W01: a submit shows on every phone as 5 of 7", async () => {
    const t = await startedOf("P0", "P1", "P2", "P3", "P4", "P5", "P6");
    for (const name of ["P0", "P1", "P2", "P3", "P4"]) t.phones[name]!.send({ t: "submit", round: 1, entry: hand([5]) });
    for (const name of ["P0", "P6"]) {
      const v = playing(await viewWhere(t.phones[name]!, (x) => x.phase === "playing" && x.submittedCount === 5));
      expect(v.players).toHaveLength(7);
      expect(v.players.filter((p) => p.status === "submitted")).toHaveLength(5);
    }
  });

  it("AC-L03: a score in the message is ignored", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Ana!.send({ t: "submit", round: 1, entry: hand([5]), score: 9999 });
    const v = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.yourEntry !== null));
    expect(v.yourScore?.value).toBe(5);
  });

  it("AC-L04 and AC-L10: a new entry replaces the old one, and a repeat changes nothing", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    const ana = t.phones.Ana!;
    ana.send({ t: "submit", round: 1, entry: hand([5]) });
    ana.send({ t: "submit", round: 1, entry: hand([1]) });
    ana.send({ t: "submit", round: 1, entry: hand([1]) });
    const v = playing(await viewWhere(ana, (x) => x.phase === "playing" && x.yourScore?.value === 1));
    expect(v.submittedCount).toBe(1);
    expect(ana.log.filter(isError)).toEqual([]);
  });

  it("AC-L05 and AC-L06: no lock at 2 of 3, a lock at 3 of 3", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Ana!.send({ t: "submit", round: 1, entry: hand([5]) });
    t.phones.Sam!.send({ t: "submit", round: 1, entry: hand([6]) });
    const open = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.submittedCount === 2));
    expect(open).toMatchObject({ round: 1, yourTotal: 0 });
    t.phones.Lee!.send({ t: "submit", round: 1, entry: hand([7]) });
    const locked = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.round === 2));
    expect(locked).toMatchObject({ yourTotal: 5, submittedCount: 0, yourHistory: [{ round: 1, score: 5 }] });
  });

  it("AC-L07: an entry for a finished round is STALE_ROUND", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    for (const name of ["Ana", "Sam", "Lee"]) t.phones[name]!.send({ t: "submit", round: 1, entry: hand([5]) });
    await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.round === 2);
    t.phones.Ana!.send({ t: "submit", round: 1, entry: hand([9]) });
    expect((await t.phones.Ana!.until(isError)).code).toBe("STALE_ROUND");
  });

  it("AC-L08: an empty hand is accepted", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Ana!.send({ t: "submit", round: 1, entry: hand([]) });
    const v = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.yourEntry !== null));
    expect(v.yourScore?.value).toBe(0);
  });

  it("AC-L09: an invalid entry is refused with its code and the stored entry stays", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    const ana = t.phones.Ana!;
    ana.send({ t: "submit", round: 1, entry: hand([5]) });
    await viewWhere(ana, (x) => x.phase === "playing" && x.yourEntry !== null);
    ana.send({ t: "submit", round: 1, entry: hand([0, 1, 2, 3, 4, 5, 6, 7]) });
    expect((await ana.until(isError)).code).toBe("TOO_MANY_CARDS");
    ana.send({ t: "submit", round: 1, entry: hand([5, 5]) });
    expect((await ana.until(isError)).code).toBe("DUPLICATE_CARD");
    ana.send({ t: "submit", round: "one", entry: hand([1]) });
    expect((await ana.until(isError)).code).toBe("MALFORMED");
  });

  it("AC-P08: the actor is the socket's player, not a player named in the message", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Sam!.send({ t: "submit", round: 1, entry: hand([5]), playerId: t.ids.Ana, actor: t.ids.Ana, you: t.ids.Ana });
    const v = playing(await viewWhere(t.phones.Lee!, (x) => x.phase === "playing" && x.submittedCount === 1));
    expect(v.players.find((p) => p.name === "Sam")!.status).toBe("submitted");
    expect(v.players.find((p) => p.name === "Ana")!.status).toBe("entering");
    t.phones.Sam!.send({ t: "remove", playerId: t.ids.Lee });
    expect((await t.phones.Sam!.until(isError)).code).toBe("HOST_ONLY");
  });
});

const statusOf = (v: View, name: string) => (v.phase === "finished" ? undefined : v.players.find((p) => p.name === name)?.status);

describe("presence and recovery", () => {
  it("AC-W02 and AC-W03: a closed socket shows Offline, and a resume shows the player again", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Sam!.close();
    await viewWhere(t.phones.Ana!, (v) => statusOf(v, "Sam") === "offline", 5000);
    const back = await Phone.connect(t.code);
    back.send({ t: "resume", token: t.tokens.Sam });
    await viewWhere(t.phones.Ana!, (v) => statusOf(v, "Sam") === "entering", 5000);
  });

  it("AC-C01: a resume returns the current view with the same data", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Sam!.send({ t: "submit", round: 1, entry: hand([5, 9], { minus: [10] }) });
    const before = playing(await viewWhere(t.phones.Sam!, (v) => v.phase === "playing" && v.yourEntry !== null));
    t.phones.Sam!.close();
    const back = await Phone.connect(t.code);
    back.send({ t: "resume", token: t.tokens.Sam });
    const after = playing(await viewWhere(back, (v) => v.phase === "playing"));
    expect(after.yourEntry).toEqual(before.yourEntry);
    expect(after.yourScore?.value).toBe(4);
    expect(after.round).toBe(1);
  });

  it("AC-C04: after a reconnect the player is still Submitted and can edit", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Sam!.send({ t: "submit", round: 1, entry: hand([5]) });
    await viewWhere(t.phones.Sam!, (v) => v.phase === "playing" && v.yourEntry !== null);
    t.phones.Sam!.close();
    const back = await Phone.connect(t.code);
    back.send({ t: "resume", token: t.tokens.Sam });
    const v = playing(await viewWhere(back, (x) => x.phase === "playing"));
    expect(statusOf(v, "Sam")).toBe("submitted");
    back.send({ t: "submit", round: 1, entry: hand([8]) });
    expect(playing(await viewWhere(back, (x) => x.phase === "playing" && x.yourScore?.value === 8)).submittedCount).toBe(1);
  });

  it("AC-C05: two sockets with one token both get views and both can send", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    const second = await Phone.connect(t.code);
    second.send({ t: "resume", token: t.tokens.Sam });
    await viewWhere(second, (v) => v.phase === "playing");
    t.phones.Sam!.send({ t: "submit", round: 1, entry: hand([5]) });
    await viewWhere(second, (v) => v.phase === "playing" && v.yourScore?.value === 5);
    second.send({ t: "submit", round: 1, entry: hand([6]) });
    await viewWhere(t.phones.Sam!, (v) => v.phase === "playing" && v.yourScore?.value === 6);
  });

  it("AC-C05: closing one of two sockets keeps the player online", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    const second = await Phone.connect(t.code);
    second.send({ t: "resume", token: t.tokens.Sam });
    await viewWhere(second, (v) => v.phase === "playing");
    t.phones.Sam!.close();
    const v = await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.players.length === 3, 5000);
    await new Promise((r) => setTimeout(r, 100));
    expect(statusOf(v, "Sam")).not.toBe("offline");
    expect(t.phones.Ana!.log.filter((m) => m.t === "view" && statusOf(m.view, "Sam") === "offline")).toEqual([]);
  });

  it("AC-C06: after the start, the name of an offline player without a token is GAME_STARTED", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    t.phones.Sam!.close();
    await viewWhere(t.phones.Ana!, (v) => statusOf(v, "Sam") === "offline", 5000);
    const stranger = await Phone.connect(t.code);
    stranger.send({ t: "join", name: "Sam" });
    expect((await stranger.until(isError)).code).toBe("GAME_STARTED");
  });
});

const stubOf = (code: string) => env.ROOM.get(env.ROOM.idFromName(code));
const alarmOf = (code: string) => runInDurableObject(stubOf(code), (_o, state) => state.storage.getAlarm());

describe("expiry", () => {
  it("AC-R17: when the alarm fires, all storage is empty, sockets close, and the code is gone", async () => {
    const t = await lobbyOf("Ana", "Sam", "Lee");
    expect(await runDurableObjectAlarm(stubOf(t.code))).toBe(true);
    const keys = await runInDurableObject(stubOf(t.code), (_o, state) => state.storage.list());
    expect(keys.size).toBe(0);
    const res = await app(`/api/rooms/${t.code}/ws`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(404);
    await new Promise((r) => setTimeout(r, 100));
    expect(t.phones.Sam!.closed).toBe(true);
  });

  it("AC-R18: each command moves the alarm to 24 hours after that command", async () => {
    const { code, phone: ana } = await hostOf();
    const first = (await alarmOf(code))!;
    expect(first).toBeGreaterThan(Date.now() + 23.9 * 3600_000);
    expect(first).toBeLessThan(Date.now() + 24.1 * 3600_000);
    await new Promise((r) => setTimeout(r, 25));
    await joinAs(code, "Sam");
    await ana.nextView("lobby");
    const second = (await alarmOf(code))!;
    expect(second).toBeGreaterThan(first);
  });
});

/** Every number that appears as a JSON number (not inside a string) in a message. */
function numbersIn(value: unknown, out = new Set<number>()): Set<number> {
  if (typeof value === "number") out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

function keysIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysIn(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysIn(v, out);
    }
  }
  return out;
}

/** A hand of at most 6 cards (no Flip 7) that scores exactly the target. */
function handScoring(target: number) {
  const cards: number[] = [];
  let left = target;
  for (let c = 13; c >= 1 && left > 0; c--) {
    if (c <= left) {
      cards.push(c);
      left -= c;
    }
  }
  if (left !== 0 || cards.length > 6) throw new Error("no hand for " + target);
  return hand(cards);
}

const FLIP7_85 = hand([7, 8, 9, 10, 11, 12, 13]); // 70 + 15

describe("privacy over the wire", () => {
  // Round scores are distinct and large, so no other number in a message can match one.
  const ROUND1: Record<string, number> = { P0: 22, P1: 24, P2: 26, P3: 28, P4: 30 };
  const ROUND2: Record<string, number> = { P0: 23, P1: 25, P2: 27, P3: 29, P4: 31 };
  const totalOf = (n: string) => ROUND1[n]! + ROUND2[n]!;

  async function fiveInRoundThree() {
    const t = await startedOf("P0", "P1", "P2", "P3", "P4");
    for (const [round, scores] of [[1, ROUND1], [2, ROUND2]] as const) {
      for (const [name, score] of Object.entries(scores)) t.phones[name]!.send({ t: "submit", round, entry: handScoring(score) });
      for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing" && v.round === round + 1);
    }
    t.phones.P1!.send({ t: "submit", round: 3, entry: hand([13, 12]) });
    t.phones.P2!.send({ t: "submit", round: 3, entry: hand([11, 10]) });
    for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing" && v.submittedCount === 2);
    return t;
  }

  it("AC-P01: no message holds another player's round score or total", async () => {
    const t = await fiveInRoundThree();
    const all = Object.keys(ROUND1);
    const sentinels = all.flatMap((n) => [ROUND1[n]!, ROUND2[n]!, totalOf(n)]);
    expect(new Set(sentinels).size).toBe(sentinels.length);
    for (const me of all) {
      const seen = new Set<number>();
      for (const m of t.phones[me]!.log) numbersIn(m, seen);
      for (const value of [ROUND1[me]!, ROUND2[me]!, totalOf(me)]) expect(seen.has(value), `${me} sees own ${value}`).toBe(true);
      for (const other of all.filter((n) => n !== me)) {
        for (const value of [ROUND1[other]!, ROUND2[other]!, totalOf(other)]) {
          expect(seen.has(value), `${me} sees a number of ${other}: ${value}`).toBe(false);
        }
      }
    }
  });

  it("AC-P02: a view holds only the viewer's own entry", async () => {
    const t = await fiveInRoundThree();
    for (const [name, phone] of Object.entries(t.phones)) {
      for (const m of phone.log) {
        if (m.t !== "view" || m.view.phase !== "playing") continue;
        const entries = (JSON.stringify(m.view).match(/"kind":"(hand|bust)"/g) ?? []).length;
        expect(entries, name).toBe(m.view.yourEntry ? 1 : 0);
      }
    }
  });

  it("AC-P03: before the end every roster item holds only id, name, status and isHost", async () => {
    const t = await fiveInRoundThree();
    for (const phone of Object.values(t.phones)) {
      for (const m of phone.log) {
        if (m.t !== "view" || m.view.phase === "finished") continue;
        for (const item of m.view.players) expect(Object.keys(item).sort()).toEqual(["id", "isHost", "name", "status"]);
      }
    }
  });

  it("AC-P05: with two players at 180 no message carries any field about the standing", async () => {
    const t = await startedOf("Ana", "Sam", "Lee");
    for (const round of [1, 2]) {
      t.phones.Ana!.send({ t: "submit", round, entry: FLIP7_85 });
      t.phones.Sam!.send({ t: "submit", round, entry: FLIP7_85 });
      t.phones.Lee!.send({ t: "submit", round, entry: hand([1]) });
      for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing" && v.round === round + 1);
    }
    t.phones.Ana!.send({ t: "submit", round: 3, entry: hand([10]) });
    t.phones.Sam!.send({ t: "submit", round: 3, entry: hand([10]) });
    t.phones.Lee!.send({ t: "submit", round: 3, entry: hand([1]) });
    const ana = playing(await viewWhere(t.phones.Ana!, (x) => x.phase === "playing" && x.round === 4));
    expect(ana.yourTotal).toBe(180);
    const allowed = new Set([
      "t", "view", "code", "phase", "you", "players", "canStart", "id", "name", "isHost", "status", "round", "submittedCount",
      "yourEntry", "yourScore", "yourTotal", "yourHistory", "score", "kind", "hand", "numbers", "lucky13", "secondThirteen",
      "minus", "halve", "value", "steps", "op", "before", "after", "detail", "token", "error",
    ]);
    for (const phone of Object.values(t.phones)) {
      for (const key of keysIn(phone.log)) expect(allowed.has(key), "unexpected key " + key).toBe(true);
    }
  });
});

describe("the end of the game", () => {
  async function finishedGame() {
    const t = await startedOf("Ana", "Sam", "Lee");
    for (let round = 1; round <= 4; round++) {
      t.phones.Ana!.send({ t: "submit", round, entry: hand([9, 10, 11, 12, 13]) });
      t.phones.Sam!.send({ t: "submit", round, entry: hand([2]) });
      t.phones.Lee!.send({ t: "submit", round, entry: hand([3]) });
      if (round < 4) for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing" && v.round === round + 1);
    }
    return t;
  }

  it("AC-P06, AC-E08 and AC-E09: every phone gets the same Final view with all totals, then nothing more is accepted", async () => {
    const t = await finishedGame();
    const finals = await Promise.all(Object.values(t.phones).map((p) => viewWhere(p, (v) => v.phase === "finished")));
    const strip = (v: View) => ({ ...v, you: undefined });
    for (const f of finals) expect(strip(f)).toEqual(strip(finals[0]!));
    const f = finals[0]!;
    if (f.phase !== "finished") throw new Error("unreachable");
    expect(f.winners).toEqual([t.ids.Ana]);
    expect(f.ranking.map((r) => [r.name, r.total])).toEqual([["Ana", 220], ["Lee", 12], ["Sam", 8]]);
    expect(f.rounds).toHaveLength(4);
    t.phones.Sam!.send({ t: "submit", round: 5, entry: hand([1]) });
    expect((await t.phones.Sam!.until(isError)).code).toBe("BAD_STATE");
  });

  it("AC-E12: a reload gets the Final view again", async () => {
    const t = await finishedGame();
    await viewWhere(t.phones.Lee!, (v) => v.phase === "finished");
    const back = await Phone.connect(t.code);
    back.send({ t: "resume", token: t.tokens.Lee });
    const v = await viewWhere(back, (x) => x.phase === "finished");
    expect(v).toMatchObject({ phase: "finished", you: t.ids.Lee });
  });
});

describe("creating a room", () => {
  const post = (name: unknown) => app("/api/rooms", { method: "POST", body: JSON.stringify({ name }) });

  it("a bad host name is refused with 400 BAD_NAME", async () => {
    const res = await post("   ");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_NAME" });
  });

  it("a code that is taken is retried with a new code", async () => {
    const calls = { n: 0 };
    const spy = vi.spyOn(Math, "random").mockImplementation(() => (calls.n++ < 8 ? 0 : 0.5));
    try {
      const first = await (await post("Ana")).json<{ code: string }>();
      const second = await (await post("Sam")).json<{ code: string }>();
      expect(first.code).toBe("AAAA");
      expect(second.code).not.toBe("AAAA");
    } finally {
      spy.mockRestore();
    }
  });

  it("after 5 taken codes the request fails with 503", async () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.25);
    try {
      expect((await post("Ana")).status).toBe(200);
      expect((await post("Sam")).status).toBe(503);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("cost", () => {
  it("AC-N06: a 6-player, 8-round game sends fewer than 300 messages", async () => {
    Phone.sent = 0;
    const who = ["P0", "P1", "P2", "P3", "P4", "P5"];
    const t = await startedOf(...who);
    for (let round = 1; round <= 8; round++) {
      for (const name of who) t.phones[name]!.send({ t: "submit", round, entry: hand([5, 10]) });
      for (const phone of Object.values(t.phones)) await viewWhere(phone, (v) => v.phase === "playing" && v.round === round + 1);
    }
    expect(Phone.sent).toBeLessThan(300);
  });
});
