# Architecture: Slice 0

Companion documents: `PRD_SLICE0.md` (requirements), `ACCEPTANCE_CRITERIA.md` (tests), `../GAME_CONTEXT.md` (rules).

The sketch below is a contract. Function bodies read `not implemented`. Implementation replaces the bodies and does not change the signatures without a recorded reason.

---

## 1. Problem

Build a room where 3 to 12 phones submit hands and the server keeps every total private until the game ends. The server must enforce the rules, because a phone cannot be trusted to hide data it already holds. The service must run on the Cloudflare free plan.

Constraints from the grounding documents:

- Scoring order is fixed by `../GAME_CONTEXT.md` Section 5. One wrong step breaks trust.
- The private data is the running total and the round scores. Hands are face-up in the real game, but the product never shows them to other players either (`PRD_SLICE0.md` D3).
- The product has no accounts. A phone proves who it is with a random token.
- Slice 0 code may be rough. The scoring module and the privacy projection may not be.

Phase A (grounding) was skipped. The project is greenfield and there is no surrounding system.

## 2. Usage (caller's view)

The caller is the browser client. It talks to one module surface: the protocol in `src/shared/protocol.ts`. It never sees storage, sockets or the reducer.

**Create a room** (host phone):

```ts
const { code, token } = await api.createRoom({ name: "Ana" });   // POST /api/rooms
const room = connect(code, { resume: token });                     // opens the WebSocket
room.view.subscribe(view => render(view));                         // View is the only state the UI reads
```

**Join and submit** (player phone):

```ts
const room = connect("K7QF", { join: { name: "Sam" } });  // token saved to localStorage on first view
// Entry screen, on every change:
const preview = scoreEntry(entry);                         // same function the server uses
showWorking(formatWorking(preview));
// Submit button:
room.send({ t: "submit", round: view.round, entry });      // entry is untrusted JSON on the wire
```

**Render** (every screen switches on `view.phase`):

```ts
switch (view.phase) {
  case "lobby":    return <Lobby view={view} />;     // players, canStart
  case "playing":  return view.you.submitted ? <Waiting view={view} /> : <Entry view={view} />;
  case "finished": return <Final view={view} />;     // winners, ranking, rounds
}
```

The client holds no game rules except the call to `scoreEntry` for the preview. The server holds all rules.

## 3. Module map

```
src/
  shared/            runs in the browser and in the Worker
    score.ts         types Hand, Entry, RoundScore · parseEntry · scoreEntry · formatWorking
    outcome.ts       outcome(totals) → winners, ranks
    protocol.ts      Command, ServerMsg, View, ErrorCode (the wire contract)
  worker/
    room.ts          Room state · reduce · project · totals   (pure, no I/O)
    room-do.ts       Durable Object shell: sockets, storage, tokens, alarm
    index.ts         Worker router: POST /api/rooms, WS /api/rooms/:code/ws, static assets
  web/
    conn.ts          WebSocket, reconnect, view store
    draft.ts         localStorage draft per room and round
    screens/         Home · Lobby · Entry · Waiting · Final
    main.tsx
test/
  score.test.ts  outcome.test.ts  room.test.ts  privacy.test.ts  room-do.test.ts
wrangler.jsonc
```

`PlayerId` lives in `shared/outcome.ts`. Reason: `outcome` and `protocol.ts` use it, and `shared/` must not import `worker/`. `room.ts` re-exports it.

Dependency direction: `web` and `worker` import `shared`. `web` never imports `worker`. `worker/room.ts` imports only `shared`. Only `room-do.ts` touches Cloudflare APIs.

## 4. Shape

### 4.1 Core types

```ts
// shared/score.ts
export const TARGET = 200;
export const MAX_NUMBER_CARDS = 7;
export const FLIP7_BONUS = 15;

export type NumberValue = 0|1|2|3|4|5|6|7|8|9|10|11|12|13;
export type MinusValue = 2|4|6|8|10;

/** Validated, normalized hand. Only parseEntry creates one. */
export interface Hand {
  readonly numbers: readonly NumberValue[];   // unique, sorted ascending; the second 13 is NOT in this list
  readonly lucky13: boolean;                  // true ⇒ numbers includes 13
  readonly secondThirteen: boolean;           // true ⇒ lucky13
  readonly minus: readonly MinusValue[];      // unique, sorted ascending
  readonly halve: boolean;
}
declare const validEntry: unique symbol;
export type Entry = ({ kind: "bust" } | { kind: "hand"; hand: Hand }) & { readonly [validEntry]: true };

export type StepOp = "sum" | "zero" | "halve" | "minus" | "floor" | "flip7" | "bust";
export interface Step { op: StepOp; before: number; after: number; detail?: string }
export interface RoundScore {
  readonly value: number;                     // ≥ 0
  readonly kind: "bust" | "flip7" | "normal";
  readonly steps: readonly Step[];            // the working, in order
}

export type EntryError =
  | "MALFORMED" | "BAD_CARD" | "DUPLICATE_CARD" | "TOO_MANY_CARDS"
  | "SECOND_13_NEEDS_LUCKY" | "LUCKY_NEEDS_13" | "BAD_MODIFIER" | "DUPLICATE_MODIFIER";

export function parseEntry(raw: unknown): { ok: true; entry: Entry } | { ok: false; error: EntryError } {
  // validate at the boundary, normalize (sort, dedupe check), brand the result
  throw new Error("not implemented");
}
export function scoreEntry(entry: Entry): RoundScore {
  // pseudocode, order is fixed by GAME_CONTEXT §5:
  //  bust → {0, "bust"}
  //  cards = numbers.length + (secondThirteen ? 1 : 0)
  //  s = sum(numbers) + (secondThirteen ? 13 : 0)
  //  flip7 = cards === 7
  //  if numbers includes 0 and !flip7 → {0, "normal"}   (The Zero)
  //  if halve → s = floor(s / 2)
  //  s -= sum(minus)
  //  s = max(s, 0)                                      (floor BEFORE the bonus)
  //  if flip7 → s += 15
  throw new Error("not implemented");
}
export function formatWorking(score: RoundScore): string {
  // "13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13"; ends with "Flip 7 +15 = 28" when flip7
  throw new Error("not implemented");
}
```

```ts
// shared/outcome.ts
export type PlayerId = string;                // server-generated, opaque. Moved here from worker/room.ts
export interface Outcome { finished: boolean; winners: readonly PlayerId[]; ranks: Readonly<Record<PlayerId, number>> }
/** finished ⇔ max total ≥ TARGET. winners = every player whose total equals the max. Ranks use 1,1,3 style. */
export function outcome(totals: Readonly<Record<PlayerId, number>>): Outcome { throw new Error("not implemented"); }
```

```ts
// worker/room.ts  (pure)
export type { PlayerId } from "../shared/outcome";   // re-export. The type lives in shared/
export interface Player { id: PlayerId; name: string }
export interface LockedRound { number: number; scores: Record<PlayerId, RoundScore> }  // scores only, no entries

interface Base { code: string; hostId: PlayerId; players: Player[]; lastActiveAt: number }
export type Room =
  | (Base & { phase: "lobby" })
  | (Base & { phase: "playing"; locked: LockedRound[]; current: { number: number; entries: Record<PlayerId, Entry> } })
  | (Base & { phase: "finished"; locked: LockedRound[] });

export type Command =
  | { t: "join"; name: string }
  | { t: "start" }
  | { t: "submit"; round: number; entry: unknown }
  | { t: "remove"; playerId: PlayerId };

export type ErrorCode =
  | EntryError
  | "BAD_NAME" | "NAME_TAKEN" | "ROOM_FULL" | "GAME_STARTED" | "NEED_3_PLAYERS"
  | "HOST_ONLY" | "STALE_ROUND" | "NOT_IN_ROOM" | "BAD_STATE" | "REMOVED";

/** The ONLY function that changes a Room. Pure. Idempotent for submit and start. */
export function reduce(
  room: Room, actor: PlayerId | null, cmd: Command, now: number, newId: () => PlayerId
): { ok: true; room: Room; joined?: PlayerId } | { ok: false; error: ErrorCode } {
  throw new Error("not implemented");
  // after a submit or remove in "playing": if every player has an entry →
  //   scores = entries mapped through scoreEntry; locked.push; totals = totals(room);
  //   outcome(totals).finished ? phase "finished" : next round with empty entries
}

/** Derived, never stored. */
export function totals(room: Room): Record<PlayerId, number> { throw new Error("not implemented"); }

/** The ONLY function that produces data for a phone. */
export function project(room: Room, viewer: PlayerId, online: ReadonlySet<PlayerId>): View {
  throw new Error("not implemented");
}
```

Changes made in Phase 4. The reason for each change is in the list:

- `Command` and `ErrorCode` live in `shared/protocol.ts`, not in `room.ts`. Reason: the web client sends commands, and `web/` must not import `worker/`. `room.ts` imports both types.
- `room.ts` also exports `createRoom(code, hostName, now, newId)`, `generateCode(random?)`, `CODE_ALPHABET`, `CODE_LENGTH`, `MIN_PLAYERS` and `MAX_PLAYERS`. Reason: `Room` needs a host id before the first `reduce` call, and the code generator belongs with the room rules. These are additions. No signature in the sketch changed.
- `reduce` refuses `remove` of the host with `BAD_STATE`, because `ErrorCode` has no more specific code. A `join` with an actor id also gets `BAD_STATE`.
- `project` shows a player as `offline` when the player has no open socket, even if the player submitted. The `submittedCount` still counts that player.

```ts
// shared/protocol.ts  (wire contract)
export type ServerMsg =
  | { t: "joined"; token: string }                 // sent once, to the joining socket
  | { t: "view"; view: View }
  | { t: "error"; code: ErrorCode };

export interface RosterItem { id: PlayerId; name: string; isHost: boolean; status: "entering" | "submitted" | "offline" }
// RosterItem has no score field by design: PV1/WT2 are enforced by the type.

export type View =
  | { phase: "lobby"; code: string; you: PlayerId; players: RosterItem[]; canStart: boolean }
  | {
      phase: "playing"; code: string; you: PlayerId; round: number;
      players: RosterItem[]; submittedCount: number;
      yourEntry: Entry | null; yourScore: RoundScore | null;
      yourTotal: number;                             // through the last LOCKED round
      yourHistory: { round: number; score: number }[];
    }
  | {
      phase: "finished"; code: string; you: PlayerId;
      winners: PlayerId[];
      ranking: { id: PlayerId; name: string; total: number; rank: number }[];
      rounds: { number: number; cells: Record<PlayerId, { score: number; kind: "bust" | "flip7" | "normal" }> }[];
    };
```

### 4.2 Durable Object shell

```ts
// worker/room-do.ts
export class RoomDO extends DurableObject {
  // One object per room, addressed by idFromName(code).
  // Storage (SQLite-backed, key/value API):
  //   "room"   → Room            (whole state, one JSON value; ≤ 12 players × few rounds)
  //   "tokens" → Record<token, PlayerId>      (auth lives here, never inside Room)
  // Sockets use the WebSocket Hibernation API. Each socket's attachment = { playerId } after auth.
  // Memory holds nothing between messages: every message loads "room", reduces, writes, broadcasts.

  async create(code: string, hostName: string): Promise<{ token: string } | { error: "CODE_TAKEN" | "BAD_NAME" }>  // RPC from the Worker. Changed in Phase 5: see the note below
  async fetch(req: Request): Promise<Response>                  // WebSocket upgrade only
  async webSocketMessage(ws: WebSocket, data: string): Promise<void> {
    // 1. parse JSON → Command | { t:"resume", token } ; reject malformed
    // 2. if socket has no attachment: only "join" or "resume" allowed
    //      join   → reduce(room, null, join) → mint token → attach
    //      resume → tokens[token] → attach, or error NOT_IN_ROOM
    // 3. actor = attachment.playerId   (NEVER a playerId from the message body: AC-P08)
    // 4. reduce → persist (room + alarm = now + 24h) → broadcast project(room, p, online) to each socket
    throw new Error("not implemented");
  }
  async webSocketClose(ws: WebSocket): Promise<void>   // re-broadcast so the roster shows Offline
  async alarm(): Promise<void>                          // ctx.storage.deleteAll(); close sockets
}
```

`online` is computed from `ctx.getWebSockets()` and their attachments. It is never stored.

Phase 5 changed `create` to take the room code as its first argument. Reason: a Durable Object cannot read the code that made its id (`idFromName` is a hash), and `Room` stores the code. The Worker router already holds the code, so it passes the code in. `create` also returns `BAD_NAME` when the host name fails the name rules.

Phase 5 also fixed the wire messages that the sketch left open. A phone sends `{t:"resume", token}` or `{t:"join", name}` first. Any other first message gets `NOT_IN_ROOM`. A message that is not valid JSON, or has the wrong shape, gets `MALFORMED`. A removed player gets `REMOVED` and the Durable Object closes that socket with code 4001. A WebSocket upgrade for a code with no room gets HTTP 404 with the text `Room not found`.

### 4.3 Worker router

```ts
// worker/index.ts
// POST /api/rooms {name}      → pick code (retry on CODE_TAKEN, max 5), stub.create(name) → {code, token}
// GET  /api/rooms/:code/ws    → Upgrade → forward to the room's Durable Object
// everything else             → static assets (the built web app)
```

### 4.4 Client

`web/conn.ts` owns the one WebSocket. It stores the token in `localStorage` under `p7:token:<code>`, reconnects with backoff (1 s, 2 s, 4 s, then every 5 s), and exposes `view` and `send`. Screens read `view` and call `send`. `web/draft.ts` saves the unsent hand under `p7:draft:<code>:<round>`.

### 4.5 Load-bearing decisions

1. **The server is the only writer.** `reduce` is the only function that changes a Room. A phone sends commands and never state or scores (per `separate-before-serializing-shared-state`: no shared writers).
2. **`project` is the only exit.** Nothing leaves the Durable Object except `project(room, viewer)` output. `RosterItem` has no score field, so a roster cannot leak a score by accident. Privacy is a property of the types plus one test (AC-P01, AC-P04), not of care.
3. **Totals are derived.** `totals(room)` sums locked rounds. No stored total exists, so none can drift (single source of truth).
4. **Scores are computed from entries.** The server recomputes with `scoreEntry`. The phone's preview uses the same function from `shared/`. There is one scoring implementation.
5. **Auth sits outside game state.** Tokens map to player ids in the shell. `Room` and `reduce` stay pure and testable with no sockets.
6. **Entries carry their round number.** A late edit after a lock fails with `STALE_ROUND` instead of landing in the next round (AC-L07).
7. **Invalid hands cannot be built in the UI, and are rejected on the server.** `parseEntry` is the single validator. The UI disables tiles at 7 cards. The server never trusts the UI.
8. **Idempotent commands.** `submit` replaces the stored entry. `start` on a started game returns `BAD_STATE` without change. A repeated command changes nothing (AC-L10).

### 4.6 Interface depth

The room module has two entry points, `reduce` and `project`. They hide the whole rulebook: validation, locking, round advance, end detection, ranking and privacy. A caller learns two functions and one `Command` union. The shell calls them and does I/O. The scoring module has three entry points (`parseEntry`, `scoreEntry`, `formatWorking`) and hides the rule order, the floor-before-bonus rule and the Lucky 13 card count.

Screen files know nothing about rooms beyond `View` and `Command`.

### 4.7 Red-flag screen (`design-red-flags.md`)

| Flag | Result |
|---|---|
| Shallow module | No. Two functions hide the rules |
| Information leakage | `View` and `Command` are the only shared shapes. Storage layout is private to `room-do.ts` |
| Temporal decomposition | No validate / apply / save pipeline. `reduce` owns the whole transition |
| Pass-through method | None. `room-do.ts` adds auth, persistence and broadcast |
| Split ownership | One writer (`reduce`). Totals derived. Tokens owned by the shell only |
| Two ways to do one task | One way to score (`scoreEntry`), one way to change a room (`reduce`), one way to read (`project`) |
| Importable internals | Keep `room.ts` free of Cloudflare imports. Add a lint rule: `web/` may not import `worker/` |
| Hand-synced list | Error codes live in one union. The code alphabet lives in one constant. The 14 tiles come from `NumberValue` through one `NUMBER_VALUES` array, which a type test checks against the union |

## 5. Synthesis decision

The `arena` skill can only be started by the user, so it did not run. Instead, three structurally different candidates were compared directly (Section 7). Candidate A won. No part of B, C or D was grafted. The mutual exclusion is deliberate: each loser fails on privacy or on the free plan, and those failures come from its structure.

## 6. Tradeoffs accepted

- We accept one whole-state JSON value in storage in exchange for a simple load-reduce-save loop. A room is small, so the cost is negligible. The shape would change if a room held thousands of rounds.
- We accept that a player can submit a wrong hand in exchange for a product with no card verification. The table can check face-up cards. The final table shows scores so a mistake is visible.
- We accept that a dead phone stalls a round until the host removes the player. Host entry for a player is deferred.
- We accept plain tokens in storage (not hashes) in exchange for fewer parts. Durable Object storage is private to the room. A leaked token only gives access to one room for 24 hours.
- We accept no multi-device sign-in recovery. A cleared browser loses the seat.
- We accept that `shared/score.ts` ships to the browser. The rules are public, so this is not a leak. Hidden data never ships.
- We accept `formatWorking` English text inside `shared/`. Slice 0 has one language.

## 7. Alternatives considered

| Candidate | Shape | Interface depth | Why it lost |
|---|---|---|---|
| **A (chosen)** | One Durable Object per room. Server-authoritative `reduce` and `project`. WebSocket push | Two functions hide the rulebook | — |
| B | Phones compute the score and send only the number. Server is a relay and a vault | Looks small, but each phone must hold and apply the rules | The server cannot check a score or lock a round by rule. Host removal and later host entry cannot work. The phone holds the private data. Rejected on privacy and correctness |
| C | Stateless Worker plus KV or D1. Phones poll every few seconds | Callers coordinate polling, merging and version checks | Polling burns the 100,000 daily requests quickly. KV is eventually consistent, so two phones can lock a round twice. Rejected on the free plan and on consistency |
| D | Peer-to-peer: the host's phone is the server (WebRTC) | Hides the least. Host code is a second server | The host phone sees every score, which breaks the product. A host refresh loses the game. Rejected on privacy and recovery |

A Supabase-based variant of A is possible. It needs row-level security rules to hide totals, and its free projects pause after 7 days idle. The Durable Object keeps privacy in plain code, so it won.

## 8. Testing plan

| Layer | Tool | Covers |
|---|---|---|
| `shared/score.ts`, `shared/outcome.ts` | `vitest`, table tests | `ACCEPTANCE_CRITERIA.md` Sections 1, 2, 7 |
| `worker/room.ts` | `vitest`, scripted games and seeded random games | Sections 3, 5, 7, and AC-P04 |
| `worker/room-do.ts` | `vitest` with the Workers pool, real WebSockets in a test runtime | Sections 3, 6, 8, 9 |
| `web/` | Manual on a phone (Playwright later) | Sections 4, 10 |

Build order matches test order: `score.ts` first, then `outcome.ts`, then `room.ts`, then the shell, then the UI.

## 9. Open questions and risks

1. **Free-plan numbers.** Resolved on 2026-10-15. The pasted Cloudflare free-plan text gives 13,000 GB-s per day, not 313,000. Question: does a normal game stay inside that number? Answer: yes. Rule used (from Cloudflare's billing description, as I understand it): duration bills at 128 MB, so one room active for one hour costs about 450 GB-s. The daily allowance covers about 28 room-hours. Hibernation lowers the cost. Run AC-N07 before launch to confirm the page has not changed.
2. **Wrangler on Windows.** Does the local dev server (`wrangler dev`) handle Durable Object WebSockets on this machine? Answer: yes. Result on 2026-10-15, Wrangler 4.151.0, Windows 11. A test Durable Object accepted two WebSockets with the Hibernation API, replied to each message, and showed one open socket after the other socket closed. Static assets from `dist` also loaded.
3. **Hibernation and `online`.** Does `getWebSockets()` list a socket during `webSocketClose`? Answer: yes. Result on 2026-10-15, Wrangler 4.151.0: inside `webSocketClose`, the closing socket is in the list with `readyState` 2 (CLOSING). The Offline broadcast must leave it out. `room-do.ts` filters it out of the list. It also calls `ws.close()` before the broadcast, and after that call the socket is no longer in the list.
4. **Playtest bars.** Are the proposed bars in `PRD_SLICE0.md` Section 8 the ones you want? Change them before the playtest.
5. **Product name.** The folder says "pick-7-with-vengenance". Any public name must avoid implying official status (NF4).

Wrangler configuration sketch. Check keys against the current Wrangler documentation at scaffold time:

```jsonc
{
  "name": "pick-7",
  "main": "src/worker/index.ts",
  "compatibility_date": "<set at scaffold>",
  "assets": { "directory": "./dist" },
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "RoomDO" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["RoomDO"] }]
}
```

Free-plan numbers used in this design (from text pasted by the owner on 2026-10-15, taken from Cloudflare's documentation): 100,000 requests per day, 13,000 GB-s duration per day, 50 million SQL rows read per day, 100,000 SQL rows written per day, 5 GB stored data, 100 Durable Object classes, SQLite backend only. Incoming WebSocket messages bill at 20 to 1 (from search-result summaries of the pricing page). The pricing page itself was not opened. Open question 1 covers the check.

Estimate (not measured): a 6-player, 8-round game sends about 110 incoming messages. That is about 6 billed requests.

## 10. Next implementation step

Create `src/shared/score.ts` and `test/score.test.ts` with the 17 scoring vectors from `ACCEPTANCE_CRITERIA.md` Section 1, then make them pass.
