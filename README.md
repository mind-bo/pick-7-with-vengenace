# Pick 7 scorekeeper

Pick 7 scorekeeper is a free web page that keeps score for the card game *Flip 7: With a Vengeance*. It keeps every player's total private.

**Run it now: https://pick-7.projectdarkinblade.workers.dev**

*Unofficial fan tool. Not made by The Op Games. This project uses no logos and no card art.*

## What it does

In the real game, players add up their own scores on paper, and everyone can see the totals. Pick 7 hides them.

- A host creates a room and gets a 4-letter code and a join link.
- Three to twelve players join with the code or the link.
- Each player taps the cards that sit on the table and sees the score at once.
- The server scores every hand. A phone never sends a score.
- Each phone shows only its own total. No phone shows another player's total.
- The game ends when a round leaves someone at 200 or more. Then every phone shows the winner and a table of all round scores.

Only Standard mode exists. Brutal Mode is out of scope.

## How to play

1. Open the address above. Type a name. Press **Create game**.
2. Send the join link to the other players. They type a name and press **Join game**.
3. The host presses **Start game**.
4. Play a round with the real cards.
5. Each player taps the cards on the table, then presses **Submit**. A player can press **Edit** until the last player submits.
6. When everyone submits, the round locks. The next round opens.
7. When someone reaches 200 or more, every phone shows the Final screen.

Use the same phone and browser for the whole game. A player who clears the browser data loses the seat. The app deletes a room after 24 hours without activity.

## Why it exists

The official app shows every score to every player. No other scorekeeper found during research hides the totals. No data shows that players want hidden totals.

This build, called Slice 0, answers one question with a real group: do players want their totals hidden? The scoring rules are exact. Everything else is rough on purpose.

## Status

- The Slice 0 build is live.
- All 199 automated tests pass. The manual checks passed on three emulated 360 px phones. See `product/slice0/ACCEPTANCE_RESULTS.md`.
- The playtest with a real group has not run yet. The plan and the log are in `product/PLAYTEST.md`.

## Run it yourself

You need Node.js 22 and npm.

```
npm ci
npm test
npm run dev
```

`npm run dev` builds the page and starts a local server at `http://localhost:8787`. Open that address in several browser tabs to play with yourself.

To deploy your own copy, you need a free Cloudflare account.

```
npx wrangler login
npm run deploy
```

The Worker name is in `wrangler.jsonc`. Change it to get your own `workers.dev` address.

The `.npmrc` file sets `legacy-peer-deps=true`. Without it, `npm install` fails on this dependency tree.

## How it works

- Each room is one Cloudflare Durable Object. It uses WebSocket hibernation and the Cloudflare free plan.
- One function, `reduce`, is the only code that changes a room. One function, `project`, is the only code that makes data for a phone. The roster type has no score field, so a roster cannot leak a score.
- The scoring order never changes: bust, sum, The Zero, ÷2 rounded down, minus cards, floor at 0, then the Flip 7 bonus of 15.
- The page uses Preact. It shares the scoring code with the server, so the live working line always matches the server.

```
src/shared   scoring, outcome, wire types (runs in the browser and the Worker)
src/worker   room rules, Durable Object, router
src/web      the page: screens, connection, drafts
test         unit tests, Workers tests with real WebSockets, web tests
product      requirements, design, acceptance results, playtest plan
```

## Documents

| File | Content |
|---|---|
| `product/GAME_CONTEXT.md` | The rules, the deck, and the exact scoring order |
| `product/PRD.md` | The full product vision |
| `product/slice0/PRD_SLICE0.md` | What Slice 0 builds |
| `product/slice0/ARCHITECTURE.md` | The design and the decisions |
| `product/slice0/ACCEPTANCE_CRITERIA.md` | Every test, with an ID |
| `product/slice0/ACCEPTANCE_RESULTS.md` | The manual check results |
| `product/slice0/IMPLEMENTATION_PLAN.md` | The build plan |
| `product/PLAYTEST.md` | The playtest plan and the result log |
| `NOTES.md` | Changes from the plan and the code review outcome |
