import { describe, expect, it } from "vitest";
import type { Command, ErrorCode } from "../src/shared/protocol";
import { CODE_ALPHABET, createRoom, generateCode, project, reduce, totals, type PlayerId, type Room } from "../src/worker/room";

const NOW = 1_000;

function idSource() {
  let i = 0;
  return () => "p" + ++i;
}

/** Run a command that must succeed. */
function run(room: Room, actor: PlayerId | null, cmd: Command, newId = idSource()) {
  const r = reduce(room, actor, cmd, NOW, newId);
  if (!r.ok) throw new Error("command refused: " + r.error);
  return r;
}

/** Run a command that must be refused. Returns the error code. */
function refused(room: Room, actor: PlayerId | null, cmd: Command): ErrorCode {
  const r = reduce(room, actor, cmd, NOW, idSource());
  if (r.ok) throw new Error("command was accepted");
  return r.error;
}

/** A lobby with the named players. The first name is the host. */
function lobby(...names: string[]) {
  const newId = idSource();
  const created = createRoom("K7QF", names[0]!, NOW, newId);
  if (!created.ok) throw new Error(created.error);
  let room = created.room;
  const ids: Record<string, PlayerId> = { [names[0]!]: room.hostId };
  for (const name of names.slice(1)) {
    const r = run(room, null, { t: "join", name }, newId);
    room = r.room;
    ids[name] = r.joined!;
  }
  return { room, ids };
}

const nobodyOnline: ReadonlySet<PlayerId> = new Set();

describe("lobby", () => {
  it("a joined player appears in the roster, and the host is marked", () => {
    const { room, ids } = lobby("Ana", "Sam");
    const view = project(room, ids.Ana!, new Set([ids.Ana!, ids.Sam!]));
    expect(view.phase).toBe("lobby");
    if (view.phase !== "lobby") return;
    expect(view.players.map((p) => [p.name, p.isHost])).toEqual([
      ["Ana", true],
      ["Sam", false],
    ]);
  });
});

describe("join rules", () => {
  it("AC-R04: a name equal to another name after trimming and ignoring case is NAME_TAKEN", () => {
    const { room } = lobby("Ana", "Sam");
    expect(refused(room, null, { t: "join", name: " sam " })).toBe("NAME_TAKEN");
  });

  it.each(["", "   ", "x".repeat(21)])("AC-R05: the name %j is BAD_NAME", (name) => {
    const { room } = lobby("Ana", "Sam");
    expect(refused(room, null, { t: "join", name })).toBe("BAD_NAME");
  });

  it("AC-R05: a 20-character name is accepted and stored trimmed", () => {
    const { room } = lobby("Ana");
    const r = run(room, null, { t: "join", name: "  " + "x".repeat(20) + "  " });
    expect(r.room.players[1]!.name).toBe("x".repeat(20));
  });

  it("the host name follows the same rules", () => {
    const r = createRoom("K7QF", "", NOW, idSource());
    expect(r).toEqual({ ok: false, error: "BAD_NAME" });
  });

  it("AC-R10: a 13th player is refused with ROOM_FULL", () => {
    const names = Array.from({ length: 12 }, (_, i) => "P" + i);
    const { room } = lobby(...names);
    expect(refused(room, null, { t: "join", name: "Late" })).toBe("ROOM_FULL");
  });
});

const everyone = (...ids: PlayerId[]) => new Set(ids);

describe("start", () => {
  it("AC-R08: two players cannot start", () => {
    const { room, ids } = lobby("Ana", "Sam");
    expect(refused(room, ids.Ana!, { t: "start" })).toBe("NEED_3_PLAYERS");
  });

  it("AC-R09: three players start round 1", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    const started = run(room, ids.Ana!, { t: "start" }).room;
    const view = project(started, ids.Sam!, everyone(...Object.values(ids)));
    expect(view).toMatchObject({ phase: "playing", round: 1, yourTotal: 0, submittedCount: 0 });
  });

  it("AC-R12: a player who is not the host cannot start", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    expect(refused(room, ids.Sam!, { t: "start" })).toBe("HOST_ONLY");
  });

  it("start on a started game is BAD_STATE", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    const started = run(room, ids.Ana!, { t: "start" }).room;
    expect(refused(started, ids.Ana!, { t: "start" })).toBe("BAD_STATE");
  });

  it("canStart is true only for the host with 3 or more players", () => {
    const two = lobby("Ana", "Sam");
    const three = lobby("Ana", "Sam", "Lee");
    const canStart = (l: ReturnType<typeof lobby>, who: string) => {
      const v = project(l.room, l.ids[who]!, nobodyOnline);
      return v.phase === "lobby" && v.canStart;
    };
    expect([canStart(two, "Ana"), canStart(three, "Ana"), canStart(three, "Sam")]).toEqual([false, true, false]);
  });

  it("AC-R11 and AC-C06: after the start every join is GAME_STARTED, even a name already in the room", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    const started = run(room, ids.Ana!, { t: "start" }).room;
    expect(refused(started, null, { t: "join", name: "Newcomer" })).toBe("GAME_STARTED");
    expect(refused(started, null, { t: "join", name: "Sam" })).toBe("GAME_STARTED");
  });

  it("a command from someone who is not in the room is NOT_IN_ROOM", () => {
    const { room } = lobby("Ana", "Sam", "Lee");
    expect(refused(room, "stranger", { t: "start" })).toBe("NOT_IN_ROOM");
    expect(refused(room, null, { t: "start" })).toBe("NOT_IN_ROOM");
  });
});

/** A raw hand entry as it arrives on the wire. */
const hand = (numbers: number[], o: { minus?: number[]; halve?: boolean } = {}) => ({
  kind: "hand",
  hand: { numbers, lucky13: false, secondThirteen: false, minus: [], halve: false, ...o },
});

/** A started game with the named players online. The first name is the host. */
function started(...names: string[]) {
  const l = lobby(...names);
  const room = run(l.room, l.ids[names[0]!]!, { t: "start" }).room;
  return { room, ids: l.ids, online: everyone(...Object.values(l.ids)) };
}

const submit = (room: Room, who: PlayerId, round: number, entry: unknown) =>
  run(room, who, { t: "submit", round, entry }).room;

function playing(room: Room, who: PlayerId, online: ReadonlySet<PlayerId>) {
  const v = project(room, who, online);
  if (v.phase !== "playing") throw new Error("expected the playing phase, got " + v.phase);
  return v;
}

describe("submit and lock", () => {
  it("AC-L02: a submitted entry is stored and the player shows as Submitted", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const after = submit(room, ids.Sam!, 1, hand([5, 9], { minus: [10] }));
    const v = playing(after, ids.Ana!, online);
    expect(v.players.find((p) => p.id === ids.Sam)!.status).toBe("submitted");
    expect(v.players.find((p) => p.id === ids.Ana)!.status).toBe("entering");
    expect(v.submittedCount).toBe(1);
    expect(playing(after, ids.Sam!, online).yourScore?.value).toBe(4);
  });

  it("AC-L04: a new entry replaces the old one before the lock", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const first = submit(room, ids.Sam!, 1, hand([5, 9]));
    const second = submit(first, ids.Sam!, 1, hand([1]));
    const v = playing(second, ids.Sam!, online);
    expect(v.yourScore?.value).toBe(1);
    expect(v.submittedCount).toBe(1);
  });

  it("AC-L05: with 2 of 3 submitted the round stays open and no total changes", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const after = submit(submit(room, ids.Ana!, 1, hand([5])), ids.Sam!, 1, hand([6]));
    expect(playing(after, ids.Ana!, online)).toMatchObject({ round: 1, yourTotal: 0, submittedCount: 2 });
  });

  it("AC-L06: the last submit locks the round, adds the scores and opens round 2", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    let r = submit(room, ids.Ana!, 1, hand([5]));
    r = submit(r, ids.Sam!, 1, hand([6]));
    r = submit(r, ids.Lee!, 1, hand([7]));
    expect(playing(r, ids.Ana!, online)).toMatchObject({
      round: 2,
      yourTotal: 5,
      yourHistory: [{ round: 1, score: 5 }],
      submittedCount: 0,
      yourEntry: null,
    });
    expect(playing(r, ids.Lee!, online).yourTotal).toBe(7);
    expect(playing(r, ids.Sam!, online).players.every((p) => p.status === "entering")).toBe(true);
  });

  it("AC-L03: a score sent by the phone is ignored", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const cmd = { t: "submit", round: 1, entry: hand([5]), score: 9999 } as Command;
    const after = run(room, ids.Ana!, cmd).room;
    expect(playing(after, ids.Ana!, online).yourScore?.value).toBe(5);
  });

  it("AC-L07: an entry for a past or future round is STALE_ROUND", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = submit(room, ids.Ana!, 1, hand([5]));
    r = submit(r, ids.Sam!, 1, hand([5]));
    r = submit(r, ids.Lee!, 1, hand([5]));
    expect(refused(r, ids.Ana!, { t: "submit", round: 1, entry: hand([5]) })).toBe("STALE_ROUND");
    expect(refused(r, ids.Ana!, { t: "submit", round: 3, entry: hand([5]) })).toBe("STALE_ROUND");
  });

  it("AC-L08: an empty hand is accepted and scores 0", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const after = submit(room, ids.Ana!, 1, hand([]));
    expect(playing(after, ids.Ana!, online).yourScore?.value).toBe(0);
  });

  it("AC-L09: an invalid entry is refused with its code and the stored entry stays", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee");
    const first = submit(room, ids.Ana!, 1, hand([5]));
    expect(refused(first, ids.Ana!, { t: "submit", round: 1, entry: hand([0, 1, 2, 3, 4, 5, 6, 7]) })).toBe("TOO_MANY_CARDS");
    expect(refused(first, ids.Ana!, { t: "submit", round: 1, entry: "junk" })).toBe("MALFORMED");
    expect(playing(first, ids.Ana!, online).yourScore?.value).toBe(5);
  });

  it("AC-L10: the same submit twice leaves the same state", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    const once = submit(room, ids.Sam!, 1, hand([5]));
    const twice = submit(once, ids.Sam!, 1, hand([5]));
    expect(twice).toEqual(once);
  });

  it("a submit before the start is BAD_STATE", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    expect(refused(room, ids.Ana!, { t: "submit", round: 1, entry: hand([5]) })).toBe("BAD_STATE");
  });
});

describe("remove", () => {
  it("AC-R13: the host removes a player from the lobby", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee", "Kim");
    const after = run(room, ids.Ana!, { t: "remove", playerId: ids.Kim! }).room;
    expect(after.players.map((p) => p.name)).toEqual(["Ana", "Sam", "Lee"]);
  });

  it("AC-R14: removal cannot leave fewer than 3 players", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee");
    expect(refused(room, ids.Ana!, { t: "remove", playerId: ids.Lee! })).toBe("NEED_3_PLAYERS");
  });

  it("AC-R15: the host cannot remove the host", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee", "Kim");
    expect(refused(room, ids.Ana!, { t: "remove", playerId: ids.Ana! })).toBe("BAD_STATE");
  });

  it("only the host removes, and only a player in the room", () => {
    const { room, ids } = lobby("Ana", "Sam", "Lee", "Kim");
    expect(refused(room, ids.Sam!, { t: "remove", playerId: ids.Kim! })).toBe("HOST_ONLY");
    expect(refused(room, ids.Ana!, { t: "remove", playerId: "nobody" })).toBe("NOT_IN_ROOM");
  });

  it("AC-R16: removing the one player still missing locks the round", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee", "Kim", "Joe");
    let r = room;
    for (const who of ["Ana", "Sam", "Lee", "Kim"]) r = submit(r, ids[who]!, 1, hand([5]));
    r = run(r, ids.Ana!, { t: "remove", playerId: ids.Joe! }).room;
    expect(playing(r, ids.Ana!, online)).toMatchObject({ round: 2, yourTotal: 5 });
  });

  it("removing a player who has not submitted leaves the round open", () => {
    const { room, ids, online } = started("Ana", "Sam", "Lee", "Kim");
    let r = submit(room, ids.Ana!, 1, hand([5]));
    r = run(r, ids.Ana!, { t: "remove", playerId: ids.Kim! }).room;
    expect(playing(r, ids.Ana!, online)).toMatchObject({ round: 1, submittedCount: 1 });
  });

  it("AC-L11: a removed player's command is NOT_IN_ROOM", () => {
    const { room, ids } = started("Ana", "Sam", "Lee", "Kim");
    const r = run(room, ids.Ana!, { t: "remove", playerId: ids.Kim! }).room;
    expect(refused(r, ids.Kim!, { t: "submit", round: 1, entry: hand([5]) })).toBe("NOT_IN_ROOM");
  });

  it("D10: a removed player disappears from past rounds and from the totals", () => {
    const { room, ids } = started("Ana", "Sam", "Lee", "Kim");
    let r = room;
    for (const who of ["Ana", "Sam", "Lee", "Kim"]) r = submit(r, ids[who]!, 1, hand([5]));
    r = run(r, ids.Ana!, { t: "remove", playerId: ids.Kim! }).room;
    if (r.phase !== "playing") throw new Error("expected playing");
    expect(r.locked.every((round) => !(ids.Kim! in round.scores))).toBe(true);
    expect(Object.keys(totals(r)).sort()).toEqual([ids.Ana!, ids.Lee!, ids.Sam!].sort());
  });
});

const BIG = hand([9, 10, 11, 12, 13]); // 55 points

/** Every player submits. `hands` maps a name to a hand; others submit [1]. */
function roundOf(room: Room, ids: Record<string, PlayerId>, hands: Record<string, unknown> = {}): Room {
  const roundNumber = room.phase === "playing" ? room.current.number : 0;
  let r = room;
  for (const [name, id] of Object.entries(ids)) {
    if (!room.players.some((p) => p.id === id)) continue;
    r = submit(r, id, roundNumber, hands[name] ?? hand([1]));
  }
  return r;
}

function finalOf(room: Room, who: PlayerId) {
  const v = project(room, who, nobodyOnline);
  if (v.phase !== "finished") throw new Error("expected the finished phase, got " + v.phase);
  return v;
}

describe("ending", () => {
  it("AC-E08 and AC-E09: round 4 reaches 200, every phone gets the same Final view, nothing more is accepted", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = room;
    for (let i = 0; i < 3; i++) r = roundOf(r, ids, { Ana: BIG });
    expect(r.phase).toBe("playing");
    r = roundOf(r, ids, { Ana: BIG });
    expect(r.phase).toBe("finished");
    const { you: _a, ...anaView } = finalOf(r, ids.Ana!);
    const { you: _s, ...samView } = finalOf(r, ids.Sam!);
    expect(samView).toEqual(anaView);
    expect(anaView.winners).toEqual([ids.Ana]);
    expect(refused(r, ids.Sam!, { t: "submit", round: 5, entry: hand([5]) })).toBe("BAD_STATE");
    expect(refused(r, ids.Ana!, { t: "remove", playerId: ids.Lee! })).toBe("BAD_STATE");
  });

  it("the ranking is ordered by total, equal totals share a rank", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = room;
    for (let i = 0; i < 4; i++) r = roundOf(r, ids, { Ana: BIG });
    expect(finalOf(r, ids.Sam!).ranking).toEqual([
      { id: ids.Ana, name: "Ana", total: 220, rank: 1 },
      { id: ids.Sam, name: "Sam", total: 4, rank: 2 },
      { id: ids.Lee, name: "Lee", total: 4, rank: 2 },
    ]);
  });

  it("co-winners share the top total", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = room;
    for (let i = 0; i < 4; i++) r = roundOf(r, ids, { Ana: BIG, Sam: BIG });
    expect(finalOf(r, ids.Lee!).winners).toEqual([ids.Ana, ids.Sam]);
  });

  it("AC-E10: the rounds table holds one score per player per round and no hand", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = room;
    for (let i = 0; i < 4; i++) r = roundOf(r, ids, { Ana: BIG });
    const v = finalOf(r, ids.Sam!);
    expect(v.rounds.map((x) => x.number)).toEqual([1, 2, 3, 4]);
    for (const round of v.rounds) expect(Object.keys(round.cells).sort()).toEqual([ids.Ana!, ids.Lee!, ids.Sam!].sort());
    expect(v.rounds[0]!.cells[ids.Ana!]).toEqual({ score: 55, kind: "normal" });
    expect(JSON.stringify(v)).not.toMatch(/numbers|hand|minus|halve/);
  });

  it("the table marks a bust and a Flip 7", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    const r = roundOf(room, ids, { Ana: { kind: "bust" }, Sam: hand([1, 2, 3, 4, 5, 6, 7]) });
    if (r.phase !== "playing") throw new Error("expected playing");
    expect(r.locked[0]!.scores[ids.Ana!]!.kind).toBe("bust");
    expect(r.locked[0]!.scores[ids.Sam!]!.kind).toBe("flip7");
  });

  it("AC-E12: a reload gets the same Final view", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    let r = room;
    for (let i = 0; i < 4; i++) r = roundOf(r, ids, { Ana: BIG });
    expect(finalOf(r, ids.Lee!)).toEqual(finalOf(r, ids.Lee!));
  });

  it("AC-E13: a player removed in round 2 has no row or column in the Final view", () => {
    const { room, ids } = started("Ana", "Sam", "Lee", "Kim");
    let r = roundOf(room, ids, { Ana: BIG });
    r = run(r, ids.Ana!, { t: "remove", playerId: ids.Kim! }).room;
    for (let i = 0; i < 3; i++) r = roundOf(r, ids, { Ana: BIG });
    const v = finalOf(r, ids.Ana!);
    expect(v.ranking.map((x) => x.id)).not.toContain(ids.Kim);
    for (const round of v.rounds) expect(Object.keys(round.cells)).not.toContain(ids.Kim);
  });
});

describe("roster", () => {
  it("AC-W01: the count includes submitted players, online or not", () => {
    const { room, ids } = started("Ana", "Sam", "Lee", "Kim");
    let r = submit(room, ids.Sam!, 1, hand([5]));
    r = submit(r, ids.Lee!, 1, hand([5]));
    const v = playing(r, ids.Ana!, everyone(ids.Ana!, ids.Sam!)); // Lee and Kim are offline
    expect(v.submittedCount).toBe(2);
    const status = Object.fromEntries(v.players.map((p) => [p.name, p.status]));
    expect(status).toEqual({ Ana: "entering", Sam: "submitted", Lee: "offline", Kim: "offline" });
  });

  it("AC-P03: a roster item holds only id, name, status and isHost", () => {
    const { room, ids } = started("Ana", "Sam", "Lee");
    const r = submit(room, ids.Sam!, 1, hand([5]));
    for (const phaseRoom of [lobby("Ana", "Sam", "Lee").room, room, r]) {
      const v = project(phaseRoom, ids.Ana!, nobodyOnline);
      if (v.phase === "finished") throw new Error("unexpected phase");
      for (const item of v.players) expect(Object.keys(item).sort()).toEqual(["id", "isHost", "name", "status"]);
    }
  });
});

describe("room code", () => {
  it("AC-R02: 10,000 codes have 4 characters, all from the alphabet", () => {
    for (let i = 0; i < 10_000; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it("the alphabet holds none of 0 O 1 I L", () => {
    expect(CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it("the random source picks the characters", () => {
    expect(generateCode(() => 0)).toBe("AAAA");
    expect(generateCode(() => 0.999999)).toBe("9999");
  });
});
