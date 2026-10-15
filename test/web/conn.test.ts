import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMsg, View } from "../../src/shared/protocol";
import { Connection, clearToken, loadToken, saveToken } from "../../src/web/conn";

/** A WebSocket the test controls. */
class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeWS[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeWS.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  /** The network accepts the socket. */
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: ServerMsg) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  /** The network drops the socket. */
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  get commands() {
    return this.sent.map((s) => JSON.parse(s));
  }
}

const CODE = "K7QF";
const lobbyView: View = { phase: "lobby", code: CODE, you: "a", players: [], canStart: false };

beforeEach(() => {
  vi.useFakeTimers();
  FakeWS.all = [];
  vi.stubGlobal("WebSocket", FakeWS);
  clearToken(CODE);
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const live = () => FakeWS.all.filter((w) => w.readyState <= 1);

describe("join and resume", () => {
  it("a phone with a token resumes", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    FakeWS.all[0]!.open();
    expect(FakeWS.all[0]!.commands).toEqual([{ t: "resume", token: "tok" }]);
    c.close();
  });

  it("a phone without a token joins with its name and saves the token it gets", () => {
    const c = new Connection(CODE, "Sam");
    const ws = FakeWS.all[0]!;
    ws.open();
    expect(ws.commands).toEqual([{ t: "join", name: "Sam" }]);
    ws.receive({ t: "joined", token: "new" });
    expect(loadToken(CODE)).toBe("new");
    c.close();
  });

  it("a stale token does not block a join: the phone falls back to join with the typed name", () => {
    saveToken(CODE, "stale");
    const c = new Connection(CODE, "Sam");
    const ws = FakeWS.all[0]!;
    ws.open();
    ws.receive({ t: "error", code: "NOT_IN_ROOM" });
    expect(ws.commands).toEqual([
      { t: "resume", token: "stale" },
      { t: "join", name: "Sam" },
    ]);
    expect(c.state.fatal).toBeNull();
    expect(loadToken(CODE)).toBeNull();
    c.close();
  });

  it("a stale token with no typed name ends the session", () => {
    saveToken(CODE, "stale");
    const c = new Connection(CODE, null);
    FakeWS.all[0]!.open();
    FakeWS.all[0]!.receive({ t: "error", code: "NOT_IN_ROOM" });
    expect(c.state.fatal).toBe("NOT_IN_ROOM");
    expect(loadToken(CODE)).toBeNull();
  });

  it("a refused name ends the session", () => {
    const c = new Connection(CODE, "Sam");
    FakeWS.all[0]!.open();
    FakeWS.all[0]!.receive({ t: "error", code: "NAME_TAKEN" });
    expect(c.state.fatal).toBe("NAME_TAKEN");
  });
});

describe("token storage", () => {
  it("a blocked localStorage still keeps the token for this page", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    saveToken(CODE, "tok");
    expect(loadToken(CODE)).toBe("tok");
    clearToken(CODE);
    expect(loadToken(CODE)).toBeNull();
  });
});

describe("send", () => {
  it("is refused until the first view arrives, and says so", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    const ws = FakeWS.all[0]!;
    ws.open();
    expect(c.send({ t: "start" })).toBe(false);
    expect(c.state.notice).toBe("OFFLINE");
    expect(ws.commands).toEqual([{ t: "resume", token: "tok" }]);
    ws.receive({ t: "view", view: lobbyView });
    expect(c.send({ t: "start" })).toBe(true);
    expect(ws.commands.at(-1)).toEqual({ t: "start" });
    c.close();
  });

  it("is refused again after a drop, until the next view", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    const first = FakeWS.all[0]!;
    first.open();
    first.receive({ t: "view", view: lobbyView });
    first.drop();
    expect(c.send({ t: "start" })).toBe(false);
    vi.advanceTimersByTime(1000);
    const second = FakeWS.all[1]!;
    second.open();
    expect(c.send({ t: "start" })).toBe(false);
    second.receive({ t: "view", view: lobbyView });
    expect(c.send({ t: "start" })).toBe(true);
    c.close();
  });
});

describe("frames and sockets", () => {
  it("a frame that is not JSON is ignored and the next frame still works", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    const ws = FakeWS.all[0]!;
    ws.open();
    expect(() => ws.onmessage?.({ data: "<html>proxy error</html>" })).not.toThrow();
    ws.receive({ t: "view", view: lobbyView });
    expect(c.state.view).toEqual(lobbyView);
    c.close();
  });

  it("returning to the tab while a check is pending never leaves two live sockets", async () => {
    saveToken(CODE, "tok");
    let finish: (r: { status: number }) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise((res) => (finish = res)));
    const c = new Connection(CODE, null);
    FakeWS.all[0]!.drop(); // never opened: the page checks the room
    document.dispatchEvent(new Event("visibilitychange"));
    expect(FakeWS.all).toHaveLength(2);
    FakeWS.all[1]!.open();
    finish({ status: 426 }); // the check ends after the new socket is up
    await vi.advanceTimersByTimeAsync(10_000);
    expect(live()).toHaveLength(1);
    expect(FakeWS.all).toHaveLength(2);
    c.close();
  });
});

describe("notice", () => {
  const error = (c: Connection, code: "HOST_ONLY" | "STALE_ROUND") => FakeWS.all[0]!.receive({ t: "error", code });

  it("stays for 4 seconds, and a broadcast view does not wipe it", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    FakeWS.all[0]!.open();
    FakeWS.all[0]!.receive({ t: "view", view: lobbyView });
    error(c, "HOST_ONLY");
    FakeWS.all[0]!.receive({ t: "view", view: lobbyView });
    expect(c.state.notice).toBe("HOST_ONLY");
    vi.advanceTimersByTime(3900);
    expect(c.state.notice).toBe("HOST_ONLY");
    vi.advanceTimersByTime(200);
    expect(c.state.notice).toBeNull();
    c.close();
  });

  it("a repeat of the same error restarts the 4 seconds", () => {
    saveToken(CODE, "tok");
    const c = new Connection(CODE, null);
    FakeWS.all[0]!.open();
    FakeWS.all[0]!.receive({ t: "view", view: lobbyView });
    error(c, "STALE_ROUND");
    vi.advanceTimersByTime(3000);
    error(c, "STALE_ROUND");
    vi.advanceTimersByTime(3000);
    expect(c.state.notice).toBe("STALE_ROUND");
    vi.advanceTimersByTime(1100);
    expect(c.state.notice).toBeNull();
    c.close();
  });
});
