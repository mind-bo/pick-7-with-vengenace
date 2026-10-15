import type { Command, ErrorCode, ServerMsg, View } from "../shared/protocol";
import { backoffMs } from "./backoff";

/** Why a session ended. The app returns to the Home screen and shows the text for this reason. */
export type Fatal = ErrorCode | "ROOM_NOT_FOUND";

/** A short message that does not end the session. "OFFLINE" means the phone could not send. */
export type Notice = ErrorCode | "OFFLINE";

export interface ConnState {
  view: View | null;
  /** True from the first view after a (re)connect until the socket closes. */
  connected: boolean;
  notice: Notice | null;
  fatal: Fatal | null;
}

const NOTICE_MS = 4000;

const tokenKey = (code: string) => `p7:token:${code}`;

/** Tokens are also kept in memory, so a phone with blocked storage still works until the page closes. */
const memoryTokens = new Map<string, string>();

export function loadToken(code: string): string | null {
  const remembered = memoryTokens.get(code);
  if (remembered) return remembered;
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}
export function saveToken(code: string, token: string): void {
  memoryTokens.set(code, token);
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    // Without storage the player cannot come back after a refresh.
  }
}
export function clearToken(code: string): void {
  memoryTokens.delete(code);
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    // Nothing to clear.
  }
}

/** Errors after which no retry can help. */
const ENDS_SESSION = new Set<ErrorCode>(["NOT_IN_ROOM", "REMOVED", "BAD_NAME", "NAME_TAKEN", "ROOM_FULL", "GAME_STARTED"]);

/**
 * One WebSocket to one room. Sends "resume" with the saved token, or "join" with the name on the first visit.
 * Reconnects by itself, with the schedule in backoff.ts.
 */
export class Connection {
  state: ConnState = { view: null, connected: false, notice: null, fatal: null };
  private listeners = new Set<(s: ConnState) => void>();
  private ws: WebSocket | null = null;
  /** What the open socket sent first. A refused resume falls back to join when the player typed a name. */
  private firstMessage: "resume" | "join" = "resume";
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private readonly onVisible = () => {
    if (document.visibilityState !== "visible" || this.stopped) return;
    clearTimeout(this.timer);
    this.open();
  };

  constructor(
    private readonly code: string,
    private readonly joinName: string | null,
  ) {
    document.addEventListener("visibilitychange", this.onVisible);
    this.open();
  }

  subscribe(fn: (s: ConnState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Returns false, with a notice, when the phone cannot send now. The caller must keep the hand in that case. */
  send(cmd: Command): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.state.connected) {
      this.showNotice("OFFLINE");
      return false;
    }
    this.ws.send(JSON.stringify(cmd));
    return true;
  }

  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.noticeTimer);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.ws?.close(1000);
  }

  private set(change: Partial<ConnState>): void {
    this.state = { ...this.state, ...change };
    for (const fn of this.listeners) fn(this.state);
  }

  private showNotice(notice: Notice): void {
    clearTimeout(this.noticeTimer);
    this.set({ notice });
    this.noticeTimer = setTimeout(() => this.set({ notice: null }), NOTICE_MS);
  }

  private end(fatal: Fatal): void {
    this.close();
    this.set({ fatal, connected: false });
  }

  private open(): void {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return; // a socket is up or coming up
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/api/rooms/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      const token = loadToken(this.code);
      if (token) {
        this.firstMessage = "resume";
        ws.send(JSON.stringify({ t: "resume", token }));
      } else if (this.joinName !== null) {
        this.firstMessage = "join";
        ws.send(JSON.stringify({ t: "join", name: this.joinName }));
      } else this.end("NOT_IN_ROOM");
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string) as ServerMsg);
      } catch {
        // A frame that is not JSON came from something other than the server. Ignore it.
      }
    };
    ws.onclose = () => {
      if (this.stopped || this.ws !== ws) return;
      this.set({ connected: false });
      if (opened) return this.retry();
      void this.checkRoomThenRetry(ws);
    };
  }

  private onMessage(msg: ServerMsg): void {
    if (msg.t === "joined") saveToken(this.code, msg.token);
    else if (msg.t === "view") this.set({ view: msg.view, connected: true });
    else if (msg.code === "NOT_IN_ROOM" && this.firstMessage === "resume" && this.joinName !== null) {
      // The saved token is stale, for example from an expired room. The player typed a name, so join with it.
      clearToken(this.code);
      this.firstMessage = "join";
      this.ws?.send(JSON.stringify({ t: "join", name: this.joinName }));
    } else if (ENDS_SESSION.has(msg.code)) {
      if (msg.code === "NOT_IN_ROOM" || msg.code === "REMOVED") clearToken(this.code);
      this.end(msg.code);
    } else this.showNotice(msg.code);
  }

  /** A failed upgrade gives the page no status. A plain GET tells a missing room (404) from a bad network. */
  private async checkRoomThenRetry(failed: WebSocket): Promise<void> {
    try {
      const res = await fetch(`/api/rooms/${this.code}/ws`);
      if (res.status === 404 && !this.stopped) return this.end("ROOM_NOT_FOUND");
    } catch {
      // Offline. Try again below.
    }
    if (!this.stopped && this.ws === failed) this.retry(); // another socket may have started meanwhile
  }

  private retry(): void {
    this.timer = setTimeout(() => this.open(), backoffMs(this.attempt++));
  }
}
