# Implementation plan: Slice 0

For the agent that builds Slice 0. Read this file first, then the documents in Section 1.

Companion documents: `PRD_SLICE0.md` (what), `ACCEPTANCE_CRITERIA.md` (tests), `ARCHITECTURE.md` (design), `../GAME_CONTEXT.md` (rules).

---

## 1. Read before you write code

Read these files in this order:

1. `../GAME_CONTEXT.md`. It wins over every other file on a game rule.
2. `PRD_SLICE0.md`. Section 4 lists what is in scope and what is not. Do not build anything from "Out of scope".
3. `ARCHITECTURE.md`. The type sketch is the contract. Do not change a signature without writing the reason in `ARCHITECTURE.md` first.
4. `ACCEPTANCE_CRITERIA.md`. Each criterion has an ID. Write the test first. Name the test with its ID, for example `AC-S07`.
5. `ui-prototype/index.html`, with `?variant=A`. Variant A is the chosen design. Variants B and C are not chosen. Do not build from them.

## 2. Rules for the build

- Server decides. A phone never sends a score. The server computes every score with `scoreEntry`.
- One writer: `reduce` is the only function that changes a `Room`. One exit: `project` is the only function that makes data for a phone.
- `src/web/` must not import `src/worker/`. `src/worker/room.ts` must not import Cloudflare APIs.
- Write the test first. Then write the smallest code that passes it.
- Make surgical changes. Every changed line traces to a requirement ID or an acceptance ID.
- Prose written to files follows ASD-STE100 (STE-flavored mode). Run `python .claude/skills/asd-ste100/scripts/ste-lint.py <file>` on each new document.
- Stop and ask the user at each point in Section 6.
- Do not add a deferred feature. If a feature seems needed, write it in `NOTES.md` and continue.

## 3. Git setup (Phase 0)

The project folder is not a git repo. The parent folders hold a git repo with unrelated files. Do not commit to the parent repo.

1. In `pick-7-with-vengenance`, run `git init`. Add `.gitignore` with `node_modules`, `dist`, `.wrangler`, `.dev.vars`.
2. Ask the user for approval. Then commit the existing documents and the prototype to `main`.
3. Create the branch `proto/ui-variants` from that commit. It keeps Variants B and C. Do not change it after that.
4. Create the build worktree outside the repo folder: `git worktree add ../pick-7-wt/build -b slice0/build`. Do all code work in that worktree.
5. After Phase 4, make two more worktrees: `slice0/worker` for Phase 5 and `slice0/web` for Phase 6. Merge both into `slice0/build` in Phase 7.

## 4. Phases

Each phase ends with a gate. Do not start the next phase until the gate passes.

### Phase 1: Scaffold

Files: `package.json`, `tsconfig.json`, `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, and the folders in `ARCHITECTURE.md` Section 3.

- Dependencies: `typescript`, `vite`, `preact`, `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`.
- Write `wrangler.jsonc` from `ARCHITECTURE.md` Section 9. Check each key against the current Wrangler documentation.
- Add a lint rule or a `tsconfig` split that enforces the import rules in Section 2.
- Scripts: `dev`, `build`, `test`, `deploy`.

Gate: `npm test` runs with no failure, `npm run build` succeeds, and `wrangler dev` starts on this Windows machine. Record the result for open question 2 in `ARCHITECTURE.md`.

### Phase 2: Scoring module

Create `src/shared/score.ts` and `test/score.test.ts`.

- Port the logic from `ui-prototype/score.proto.js`. That file already passes the 16 scoring checks in `ui-prototype/check-score.cjs`.
- Add `parseEntry` (validation and branding), `formatWorking`, and the constants `TARGET`, `MAX_NUMBER_CARDS`, `FLIP7_BONUS`.
- Tests: AC-S01 to AC-S17, AC-V01 to AC-V12, AC-H13.

Gate: all these tests pass. Nothing else starts before this.

### Phase 3: Outcome module

Create `src/shared/outcome.ts` and `test/outcome.test.ts`. Tests: AC-E01 to AC-E07.

Gate: tests pass.

### Phase 4: Protocol and room reducer

Create `src/shared/protocol.ts` and `src/worker/room.ts`.

- Types: `Command`, `ServerMsg`, `View`, `RosterItem`, `ErrorCode`, `Room`. `RosterItem` has no score field.
- Functions: `reduce`, `totals`, `project`, and the room-code generator (alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`).
- Rules to implement:
  - Join and name rules. Start with 3 to 12 players.
  - Remove: host only, minimum 3 players. If the removed player was the last one missing, the round locks.
  - Submit: check the round number, allow a replace, and make a repeat safe.
  - Lock and advance, and end detection.
  - A removed player disappears from all rounds.
- Tests (`test/room.test.ts`, `test/privacy.test.ts`): reducer-level versions of AC-R, AC-L, AC-E08 to AC-E13, AC-P01, AC-P04 (distinct sentinel scores, 200 random rooms), AC-R02.

Gate: all these tests pass.

### Phase 5: Durable Object shell and router

Create `src/worker/room-do.ts` and `src/worker/index.ts`. Work in the `slice0/worker` worktree.

- `POST /api/rooms` returns `{code, token}`. It retries on `CODE_TAKEN`, at most 5 times.
- `GET /api/rooms/:code/ws` forwards the upgrade to the Durable Object.
- The Durable Object uses the WebSocket Hibernation API. It stores `{playerId}` as the socket attachment and keeps tokens outside `Room`.
- For each message it runs load, reduce, save, broadcast. The actor is always the socket's player, never an id in the message body.
- An alarm 24 hours after the last activity calls `deleteAll()` and closes the sockets.
- First, test whether `getWebSockets()` lists a closing socket inside `webSocketClose` (open question 3).
- Tests (`test/room-do.test.ts`, Workers pool, real WebSockets):
  - AC-R01, AC-R03 to AC-R18.
  - AC-L02 to AC-L11, AC-W01 to AC-W03.
  - AC-P01 to AC-P03, AC-P05 to AC-P08.
  - AC-C01, AC-C04 to AC-C06, AC-N06.

Gate: all these tests pass.

### Phase 6: Web client

Create `src/web/conn.ts`, `draft.ts`, `main.tsx`, `screens/{Home,Lobby,Entry,Waiting,Final}.tsx`, and CSS. Work in the `slice0/web` worktree.

- Match Variant A in the prototype for layout and style. Rewrite the code properly. Do not copy B or C.
- `conn.ts`: one WebSocket, token in `localStorage` under `p7:token:<code>`, reconnect after 1 s, 2 s, 4 s, then every 5 s, banner "Reconnecting…".
- `draft.ts`: unsent hand in `localStorage` under `p7:draft:<code>:<round>`.
- The Entry screen calls `scoreEntry` and `formatWorking` from `src/shared/` for the live working line.
- Names show as plain text. Light and dark themes follow the phone. Every screen shows the unofficial notice. The join link `/?room=CODE` fills the code field.
- The Final screen renders only when `phase` is `finished`.

Gate: three browser tabs play a full game against `wrangler dev`.

### Phase 7: Integrate and deploy

1. Merge `slice0/worker` and `slice0/web` into `slice0/build`. Run all tests.
2. Ask the user to create a free Cloudflare account and run `npx wrangler login`. Then run `wrangler deploy` after the user says yes.
3. Smoke test the live `*.workers.dev` address with 3 phones.
4. Run AC-N07: compare the live Cloudflare free-plan page with `ARCHITECTURE.md` Section 9.

Gate: the smoke test passes.

### Phase 8: Manual acceptance

Run every criterion marked **M** on a real phone at 360 px width. Write the results in `ACCEPTANCE_RESULTS.md`. Fix defects.

Gate: all **U** and **I** tests pass and all **M** checks pass.

### Phase 9: Playtest (the user leads)

Prepare `PLAYTEST.md` from the template in `PRD_SLICE0.md` Section 8. The user runs the session. The user fills in the four measures. Apply the stop rule.

## 5. Definition of done

- Every criterion in `ACCEPTANCE_CRITERIA.md` passes.
- No file in `src/` implements anything from "Out of scope" in `PRD_SLICE0.md`.
- `ARCHITECTURE.md` matches the code. Every changed signature has a recorded reason.
- The deployed address works on 3 phones.
- `ste-lint.py` shows no hard violation in any new document.

## 6. Stop and ask the user

- Before the first git commit.
- Before `wrangler login` and before `wrangler deploy`.
- When a requirement and `GAME_CONTEXT.md` disagree. `GAME_CONTEXT.md` wins, but tell the user.
- When a test cannot pass without a change to a signature in `ARCHITECTURE.md`.
- Before the playtest.
- When any step takes more than twice its estimate.

## 7. Estimates (not measured)

Phases 0 and 1: half a day. Phases 2 to 4: one day. Phase 5: one day. Phase 6: one and a half days. Phases 7 and 8: one day. Playtest: one evening. Total: about 5 to 6 working days.

## 8. How to start the agent

Open the agent in `C:\Users\kisho\K\repo\pick-7-with-vengenance`. Use a session under `C:\Users\kisho\K\repo`. The project rules in `CLAUDE.md` then load by themselves.

First message:

```
/claude-mem:do
Execute product/slice0/IMPLEMENTATION_PLAN.md, one phase at a time.
Read Section 1 files first. Use /tdd for Phases 2 to 5. Stop at each gate and at every point in Section 6.
Start with Phase 0 and Phase 1.
```

Skills by phase:

| Phase | Skill |
|---|---|
| All | `claude-mem:do` (runs the plan phase by phase). `karpathy-guidelines` and `asd-ste100` load from `CLAUDE.md` |
| 2 to 5 | `tdd` |
| A failing test or a Wrangler problem | `diagnosing-bugs` |
| Before merge in Phase 7 | `code-review` |
| After the playtest | `claude-mem:handoff`, to record the state for the next session |

Do not use `implement` or `implement-spec`. They need an issue tracker and tickets. This project has neither.
