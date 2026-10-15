import type { Command, ErrorCode, ServerMsg, View } from "../shared/protocol";
import { backoffMs } from "./backoff";

/** Why a session ended. The app returns to the Home screen and shows the text for this reason. */
export type Fatal = ErrorCode | "ROOM_NOT_FOUND";

export interface ConnState {
  view: View | null;
  connected: boolean;
  /** The last error that does not end the session, for a short message. */
  notice: ErrorCode | null;
  fatal: Fatal | null;
}

const tokenKey = (code: string) => `p7:token:${code}`;

export function loadToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}
export function saveToken(code: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    // Without storage the player cannot come back after a refresh.
  }
}
export function clearToken(code: string): void {
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
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private readonly onVisible = () => {
    if (document.visibilityState !== "visible" || this.stopped) return;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
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

  send(cmd: Command): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(cmd));
  }

  clearNotice(): void {
    this.set({ notice: null });
  }

  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.ws?.close(1000);
  }

  private set(change: Partial<ConnState>): void {
    this.state = { ...this.state, ...change };
    for (const fn of this.listeners) fn(this.state);
  }

  private end(fatal: Fatal): void {
    this.close();
    this.set({ fatal, connected: false });
  }

  private open(): void {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/api/rooms/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      const token = loadToken(this.code);
      if (token) ws.send(JSON.stringify({ t: "resume", token }));
      else if (this.joinName !== null) ws.send(JSON.stringify({ t: "join", name: this.joinName }));
      else this.end("NOT_IN_ROOM");
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as ServerMsg);
    ws.onclose = () => {
      if (this.stopped || this.ws !== ws) return;
      this.set({ connected: false });
      if (opened) return this.retry();
      void this.checkRoomThenRetry();
    };
  }

  private onMessage(msg: ServerMsg): void {
    if (msg.t === "joined") saveToken(this.code, msg.token);
    else if (msg.t === "view") this.set({ view: msg.view, connected: true, notice: null });
    else if (ENDS_SESSION.has(msg.code)) {
      if (msg.code === "NOT_IN_ROOM" || msg.code === "REMOVED") clearToken(this.code);
      this.end(msg.code);
    } else this.set({ notice: msg.code });
  }

  /** A failed upgrade gives the page no status. A plain GET tells a missing room (404) from a bad network. */
  private async checkRoomThenRetry(): Promise<void> {
    try {
      const res = await fetch(`/api/rooms/${this.code}/ws`);
      if (res.status === 404) return this.end("ROOM_NOT_FOUND");
    } catch {
      // Offline. Try again below.
    }
    if (!this.stopped) this.retry();
  }

  private retry(): void {
    this.timer = setTimeout(() => this.open(), backoffMs(this.attempt++));
  }
}
