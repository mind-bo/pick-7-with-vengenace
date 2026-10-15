import { describe, expect, it } from "vitest";
import { parseEntry, type Entry } from "../src/shared/score";
import { project, type LockedRound, type Player, type Room } from "../src/worker/room";

/** Small seeded generator, so a failure repeats. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENTINEL_BASE = 1_000_000;

interface Fixture {
  room: Room;
  sentinels: Record<string, number[]>; // player id → that player's round scores
}

/** A playing room where every locked round score is a distinct number no other value can equal. */
function randomPlayingRoom(seed: number): Fixture {
  const rand = mulberry32(seed);
  const pick = (n: number) => Math.floor(rand() * n);
  const players: Player[] = Array.from({ length: 3 + pick(10) }, (_, i) => ({ id: "p" + i, name: "Player " + i }));
  let next = SENTINEL_BASE;
  const sentinels: Record<string, number[]> = Object.fromEntries(players.map((p) => [p.id, []]));
  const locked: LockedRound[] = Array.from({ length: pick(7) }, (_, r) => {
    const scores: LockedRound["scores"] = {};
    for (const p of players) {
      const value = next++;
      sentinels[p.id]!.push(value);
      scores[p.id] = { value, kind: "normal", steps: [] };
    }
    return { number: r + 1, scores };
  });
  const entries: Record<string, Entry> = {};
  for (const p of players) {
    if (rand() < 0.5) continue;
    const parsed = parseEntry({
      kind: "hand",
      hand: { numbers: [pick(14)], lucky13: false, secondThirteen: false, minus: [], halve: false },
    });
    if (parsed.ok) entries[p.id] = parsed.entry;
  }
  const room: Room = {
    phase: "playing",
    code: "K7QF",
    hostId: "p0",
    players,
    lastActiveAt: 0,
    locked,
    current: { number: locked.length + 1, entries },
  };
  return { room, sentinels };
}

/** The first seed that gives a room with at least 2 locked rounds. */
const RICH_SEED = Array.from({ length: 200 }, (_, i) => i + 1).find((s) => {
  const { room } = randomPlayingRoom(s);
  return room.phase === "playing" && room.locked.length >= 2;
})!;

const leaks = (json: string, value: number) => new RegExp(String.raw`\b${value}\b`).test(json);

describe("privacy", () => {
  it("the scan detects a leak (self-check)", () => {
    const { room, sentinels } = randomPlayingRoom(RICH_SEED);
    const values = Object.values(sentinels).flat();
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(leaks(JSON.stringify(room), value)).toBe(true);
  });

  it("AC-P04: 200 random rooms, no view holds another player's round score", () => {
    let comparisons = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { room, sentinels } = randomPlayingRoom(seed);
      for (const viewer of room.players) {
        const json = JSON.stringify(project(room, viewer.id, new Set(room.players.map((p) => p.id))));
        for (const [owner, values] of Object.entries(sentinels)) {
          if (owner === viewer.id) continue;
          for (const value of values) comparisons++, expect(leaks(json, value), `seed ${seed}, viewer ${viewer.id}, owner ${owner}`).toBe(false);
        }
      }
    }
    expect(comparisons).toBeGreaterThan(1000);
  });

  it("a viewer still sees the viewer's own round scores", () => {
    const { room, sentinels } = randomPlayingRoom(RICH_SEED);
    const own = sentinels.p0!;
    expect(own.length).toBeGreaterThan(0);
    const json = JSON.stringify(project(room, "p0", new Set()));
    for (const value of own) expect(leaks(json, value)).toBe(true);
  });

  it("AC-P02: a view holds no hand of another player", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { room } = randomPlayingRoom(seed);
      for (const viewer of room.players) {
        const json = JSON.stringify(project(room, viewer.id, new Set()));
        const handsInView = (json.match(/"kind":"hand"/g) ?? []).length;
        const ownHand = room.phase === "playing" && room.current.entries[viewer.id] ? 1 : 0;
        expect(handsInView, `seed ${seed}, viewer ${viewer.id}`).toBe(ownHand);
      }
    }
  });
});
