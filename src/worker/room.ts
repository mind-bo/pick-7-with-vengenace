import type { Command, ErrorCode, RosterItem, View } from "../shared/protocol";
import type { PlayerId } from "../shared/outcome";
import { outcome } from "../shared/outcome";
import { parseEntry, scoreEntry, type Entry, type RoundScore } from "../shared/score";

export type { PlayerId } from "../shared/outcome";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

export interface Player {
  id: PlayerId;
  name: string;
}
export interface LockedRound {
  number: number;
  scores: Record<PlayerId, RoundScore>;
} // scores only, no entries

interface Base {
  code: string;
  hostId: PlayerId;
  players: Player[];
  lastActiveAt: number;
}
export type Room =
  | (Base & { phase: "lobby" })
  | (Base & { phase: "playing"; locked: LockedRound[]; current: { number: number; entries: Record<PlayerId, Entry> } })
  | (Base & { phase: "finished"; locked: LockedRound[] });

type Result = { ok: true; room: Room; joined?: PlayerId } | { ok: false; error: ErrorCode };

export function generateCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

const MAX_NAME_LENGTH = 20;

/** Trimmed name, or an error. Names are unique ignoring case. */
function checkName(name: string, players: readonly Player[]): { name: string } | { error: ErrorCode } {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_NAME_LENGTH) return { error: "BAD_NAME" };
  if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return { error: "NAME_TAKEN" };
  return { name: trimmed };
}

/** A new lobby with the host as the only player. */
export function createRoom(code: string, hostName: string, now: number, newId: () => PlayerId): Result {
  const checked = checkName(hostName, []);
  if ("error" in checked) return { ok: false, error: checked.error };
  const id = newId();
  return { ok: true, room: { phase: "lobby", code, hostId: id, players: [{ id, name: checked.name }], lastActiveAt: now }, joined: id };
}

const refuse = (error: ErrorCode) => ({ ok: false, error }) as const;

function join(room: Room, name: string, now: number, newId: () => PlayerId): Result {
  if (room.phase !== "lobby") return refuse("GAME_STARTED");
  const checked = checkName(name, room.players);
  if ("error" in checked) return refuse(checked.error);
  if (room.players.length >= MAX_PLAYERS) return refuse("ROOM_FULL");
  const id = newId();
  return { ok: true, room: { ...room, players: [...room.players, { id, name: checked.name }], lastActiveAt: now }, joined: id };
}

function without<T>(record: Record<PlayerId, T>, id: PlayerId): Record<PlayerId, T> {
  const { [id]: _removed, ...rest } = record;
  return rest;
}

type Playing = Extract<Room, { phase: "playing" }>;

/** When every player has an entry: score the entries, store the round, then open the next one or finish. */
function lockIfComplete(room: Playing): Room {
  const { entries, number } = room.current;
  if (!room.players.every((p) => entries[p.id])) return room;
  const scores: Record<PlayerId, RoundScore> = {};
  for (const p of room.players) scores[p.id] = scoreEntry(entries[p.id]!);
  const locked = [...room.locked, { number, scores }];
  if (outcome(totals({ ...room, locked })).finished) {
    const { current: _current, phase: _phase, ...base } = room;
    return { ...base, phase: "finished", locked };
  }
  return { ...room, locked, current: { number: number + 1, entries: {} } };
}

/** The ONLY function that changes a Room. Pure. */
export function reduce(room: Room, actor: PlayerId | null, cmd: Command, now: number, newId: () => PlayerId): Result {
  if (cmd.t === "join") return actor === null ? join(room, cmd.name, now, newId) : refuse("BAD_STATE");
  if (actor === null || !room.players.some((p) => p.id === actor)) return refuse("NOT_IN_ROOM");
  switch (cmd.t) {
    case "start": {
      if (actor !== room.hostId) return refuse("HOST_ONLY");
      if (room.phase !== "lobby") return refuse("BAD_STATE");
      if (room.players.length < MIN_PLAYERS) return refuse("NEED_3_PLAYERS");
      const { phase: _, ...base } = room;
      return { ok: true, room: { ...base, phase: "playing", locked: [], current: { number: 1, entries: {} }, lastActiveAt: now } };
    }
    case "submit": {
      if (room.phase !== "playing") return refuse("BAD_STATE");
      if (cmd.round !== room.current.number) return refuse("STALE_ROUND");
      const parsed = parseEntry(cmd.entry);
      if (!parsed.ok) return refuse(parsed.error);
      const entries = { ...room.current.entries, [actor]: parsed.entry };
      return { ok: true, room: lockIfComplete({ ...room, lastActiveAt: now, current: { ...room.current, entries } }) };
    }
    case "remove": {
      if (actor !== room.hostId) return refuse("HOST_ONLY");
      if (room.phase === "finished") return refuse("BAD_STATE");
      if (!room.players.some((p) => p.id === cmd.playerId)) return refuse("NOT_IN_ROOM");
      if (cmd.playerId === room.hostId) return refuse("BAD_STATE");
      if (room.players.length <= MIN_PLAYERS) return refuse("NEED_3_PLAYERS");
      const players = room.players.filter((p) => p.id !== cmd.playerId);
      if (room.phase === "lobby") return { ok: true, room: { ...room, players, lastActiveAt: now } };
      const locked = room.locked.map((r) => ({ number: r.number, scores: without(r.scores, cmd.playerId) }));
      const entries = without(room.current.entries, cmd.playerId);
      return { ok: true, room: lockIfComplete({ ...room, players, locked, current: { ...room.current, entries }, lastActiveAt: now }) };
    }
  }
}

/** Derived, never stored. */
export function totals(room: Room): Record<PlayerId, number> {
  const sums: Record<PlayerId, number> = {};
  for (const p of room.players) sums[p.id] = 0;
  if (room.phase === "lobby") return sums;
  for (const round of room.locked) for (const [id, s] of Object.entries(round.scores)) sums[id] = (sums[id] ?? 0) + s.value;
  return sums;
}

/** The ONLY function that produces data for a phone. */
export function project(room: Room, viewer: PlayerId, online: ReadonlySet<PlayerId>): View {
  const entries = room.phase === "playing" ? room.current.entries : {};
  const players: RosterItem[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    status: !online.has(p.id) ? "offline" : entries[p.id] ? "submitted" : "entering",
  }));
  if (room.phase === "playing") {
    const yourEntry = entries[viewer] ?? null;
    return {
      phase: "playing",
      code: room.code,
      you: viewer,
      round: room.current.number,
      players,
      submittedCount: Object.keys(entries).length,
      yourEntry,
      yourScore: yourEntry && scoreEntry(yourEntry),
      yourTotal: totals(room)[viewer] ?? 0,
      yourHistory: room.locked.map((r) => ({ round: r.number, score: r.scores[viewer]?.value ?? 0 })),
    };
  }
  if (room.phase === "finished") {
    const sums = totals(room);
    const result = outcome(sums);
    const ranking = room.players
      .map((p) => ({ id: p.id, name: p.name, total: sums[p.id] ?? 0, rank: result.ranks[p.id] ?? 0 }))
      .sort((a, b) => a.rank - b.rank);
    const rounds = room.locked.map((r) => ({
      number: r.number,
      cells: Object.fromEntries(Object.entries(r.scores).map(([id, s]) => [id, { score: s.value, kind: s.kind }])),
    }));
    return { phase: "finished", code: room.code, you: viewer, winners: [...result.winners], ranking, rounds };
  }
  const canStart = viewer === room.hostId && room.players.length >= MIN_PLAYERS;
  return { phase: "lobby", code: room.code, you: viewer, players, canStart };
}
