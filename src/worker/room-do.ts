import { DurableObject } from "cloudflare:workers";
import type { Command, ErrorCode, ServerMsg } from "../shared/protocol";
import { createRoom, project, reduce, type PlayerId, type Room } from "./room";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a socket remembers across hibernation. Set only after the socket proves who it is. */
interface Attachment {
  playerId: PlayerId;
}

type Tokens = Record<string, PlayerId>;
type ClientMsg = Command | { t: "resume"; token: string };

/** Check the shape of an untrusted message. The values inside are checked later, by the rules. */
function parseClientMsg(data: string | ArrayBuffer): ClientMsg | null {
  if (typeof data !== "string") return null;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof m !== "object" || m === null) return null;
  switch (m.t) {
    case "start":
      return { t: "start" };
    case "join":
      return typeof m.name === "string" ? { t: "join", name: m.name } : null;
    case "resume":
      return typeof m.token === "string" ? { t: "resume", token: m.token } : null;
    case "submit":
      return typeof m.round === "number" ? { t: "submit", round: m.round, entry: m.entry } : null;
    case "remove":
      return typeof m.playerId === "string" ? { t: "remove", playerId: m.playerId } : null;
    default:
      return null;
  }
}

export class RoomDO extends DurableObject {
  async create(code: string, hostName: string): Promise<{ token: string } | { error: "CODE_TAKEN" | "BAD_NAME" }> {
    if (await this.ctx.storage.get("room")) return { error: "CODE_TAKEN" };
    const created = createRoom(code, hostName, Date.now(), () => crypto.randomUUID());
    if (!created.ok) return { error: "BAD_NAME" };
    const token = crypto.randomUUID();
    await this.save(created.room, { [token]: created.joined! });
    return { token };
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!(await this.ctx.storage.get("room"))) return new Response("Room not found", { status: 404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const msg = parseClientMsg(data);
    if (!msg) return this.reject(ws, "MALFORMED");
    const room = await this.ctx.storage.get<Room>("room");
    if (!room) return this.reject(ws, "NOT_IN_ROOM");
    const tokens = (await this.ctx.storage.get<Tokens>("tokens")) ?? {};
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment) return this.command(ws, room, tokens, attachment.playerId, msg);
    if (msg.t === "resume") {
      const playerId = tokens[msg.token];
      if (!playerId) return this.reject(ws, "NOT_IN_ROOM");
      ws.serializeAttachment({ playerId } satisfies Attachment);
      return this.broadcast(room);
    }
    if (msg.t !== "join") return this.reject(ws, "NOT_IN_ROOM");
    const result = reduce(room, null, msg, Date.now(), () => crypto.randomUUID());
    if (!result.ok) return this.reject(ws, result.error);
    const token = crypto.randomUUID();
    ws.serializeAttachment({ playerId: result.joined! } satisfies Attachment);
    await this.save(result.room, { ...tokens, [token]: result.joined! });
    this.send(ws, { t: "joined", token });
    this.broadcast(result.room);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code);
    } catch {
      ws.close(1000);
    }
    const room = await this.ctx.storage.get<Room>("room");
    if (room) this.broadcast(room, ws);
  }

  /** A message from a socket that proved who it is. The actor is always that socket's player. */
  private async command(ws: WebSocket, room: Room, tokens: Tokens, actor: PlayerId, msg: ClientMsg): Promise<void> {
    if (msg.t === "resume") return this.reject(ws, "BAD_STATE");
    const result = reduce(room, actor, msg, Date.now(), () => crypto.randomUUID());
    if (!result.ok) return this.reject(ws, result.error);
    const kept = new Set(result.room.players.map((p) => p.id));
    const removed = new Set(room.players.map((p) => p.id).filter((id) => !kept.has(id)));
    const liveTokens = Object.fromEntries(Object.entries(tokens).filter(([, id]) => !removed.has(id)));
    await this.save(result.room, liveTokens);
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment() as Attachment | null;
      if (a && removed.has(a.playerId)) {
        this.reject(s, "REMOVED");
        s.close(4001, "removed");
      }
    }
    this.broadcast(result.room);
  }

  /** Idle for 24 hours: close every socket and delete the room and its tokens. */
  async alarm(): Promise<void> {
    for (const s of this.ctx.getWebSockets()) s.close(1000, "room expired");
    await this.ctx.storage.deleteAll();
  }

  private async save(room: Room, tokens: Tokens): Promise<void> {
    await this.ctx.storage.put({ room, tokens });
    await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
  }

  private reject(ws: WebSocket, code: ErrorCode): void {
    this.send(ws, { t: "error", code });
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    ws.send(JSON.stringify(msg));
  }

  /** Send each connected player that player's own view. A closing socket does not count as online. */
  private broadcast(room: Room, closing?: WebSocket): void {
    const sockets = this.ctx.getWebSockets().filter((s) => s !== closing);
    const inRoom = new Set(room.players.map((p) => p.id));
    const attached = sockets.map((s) => {
      const a = s.deserializeAttachment() as Attachment | null;
      return [s, a && inRoom.has(a.playerId) ? a : null] as const;
    });
    const online = new Set<PlayerId>();
    for (const [, a] of attached) if (a) online.add(a.playerId);
    for (const [s, a] of attached) if (a) this.send(s, { t: "view", view: project(room, a.playerId, online) });
  }
}
