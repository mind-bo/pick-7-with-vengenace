# Notes

## Scaffold changes from the plan

- The plan names `@cloudflare/vitest-pool-workers`. The maintainers deprecated that package and renamed it. Use `@cloudflare/vitest-plugin` instead. The test config uses its `cloudflareTest` plugin.
- `npm install` fails with the error "Cannot read properties of null (reading 'edgesOut')" when it adds `vitest`. The file `.npmrc` sets `legacy-peer-deps=true` to avoid the error.
- `compatibility_date` is `2026-08-15`. This is the last date that the installed `workerd` supports.

## Web client (Phase 6)

- `happy-dom` is a new test dependency. The `web` test project needs it for `localStorage` and for rendering the screens (AC-H12, AC-N04).
- The product title is "Pick 7 scorekeeper", not "Flip 7 Scorekeeper". `ARCHITECTURE.md` open question 5 asks that a public name does not imply official status. The Home screen names the game in the lead text only.
- Home has one name field above both actions. Variant A had the name field only in the Join box.
- The host sees a Remove button on each player row in the Lobby and in the Waiting screen. Variant A showed one "Remove…" button. The Waiting screen needs the button, because a stuck round has no other way out (RM6).
- The Final table scrolls inside its own box when a game has many rounds. The page never scrolls sideways.
- The "Reconnecting…" banner shows from the moment the socket closes until the first view arrives again.
- A removed player, an expired room, or a code that does not exist returns the player to Home with a message.

## Code review of the web client (Phase 7)

The review found 10 issues. Seven led to a fix with a test:

- Two sockets after a tab switch.
- A Submit lost while reconnecting.
- A stale token that blocked a join.
- A seat lost to a command sent before the resume finished.
- A host locked out by blocked storage.
- A message that disappeared early.
- A frame that was not JSON.

Three findings did not lead to a change:

- `setHand(toggleNumber(hand, n))` reads the hand from the last render. Two taps cannot reach it before a render, because Preact renders between two click events.
- After "Edit my hand" and Submit, the Waiting screen shows the old score for one round trip. The send gate prevents any loss, so the cost is only a short flash.
- Old drafts stay in `localStorage`. Each one is a few hundred bytes. A reused room code within 24 hours is very unlikely.
