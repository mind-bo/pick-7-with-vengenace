# PRD: Slice 0 — Private Scorekeeper for Flip 7: With a Vengeance

Status: Draft v1 · Owner: projectdarkinblade · Date: 2026-10-15
Companion documents: `../GAME_CONTEXT.md` (rules, wins over this file on any game rule), `../PRD.md` (full vision), `ACCEPTANCE_CRITERIA.md` (tests), `ARCHITECTURE.md` (design).

---

## 1. Purpose

Slice 0 is the smallest build that can answer one question: **do players want their running totals hidden from the table?**

Research found no existing scorekeeper that hides totals. The official Op Games web app shows all scores to everyone. Five third-party apps list no private mode. Nobody has shown that players want one. Slice 0 tests that need with a real group before the full product (`PRD.md`) is built.

Slice 0 is a throwaway-quality product with production-quality scoring. The scoring rules must be exactly right. Everything else may be rough.

## 2. Product in one paragraph

A free web page for phones. A host creates a room and gets a 4-character code. Three to twelve players join by code and name. Each round, every player privately taps the cards in front of them. The page shows the working, scores the hand, and adds the score to that player's private total. The round locks when everyone has submitted. When a locked round leaves anyone at 200 or more, everyone sees the winner (or co-winners) and a scores-only scorecard.

Standard mode only. Brutal Mode is out of scope.

## 3. Decisions taken

| # | Decision | Choice | Source |
|---|---|---|---|
| D1 | Hosting | Cloudflare Workers and Durable Objects, free plan | `PRD.md` Section 16 |
| D2 | Tie at the top | Players with the highest total (at least 200) are all winners | User, 2026-10-14 |
| D3 | Hands on the final scorecard | Never shown. Scores only | User, 2026-10-14 |
| D4 | Target score | Fixed at 200. No setting | Slice 0 |
| D5 | Meaning of "seven" | Seven Number cards. Both 13s count under Lucky 13. No strict toggle | `../GAME_CONTEXT.md` Section 7 |
| D6 | Player count | 3 to 12 | `PRD.md` R6 |
| D7 | Room lifetime | Delete a room and its data 24 hours after the last activity | Slice 0 |
| D8 | Unlucky 7 | Scores as a normal 7. It has no control in the app (see Section 6) | `../GAME_CONTEXT.md` Section 6 |
| D9 | Empty hand | Allowed. It scores 0 | Slice 0 |
| D10 | Removed player | Removed from the scorecard completely, including past rounds | Slice 0 |
| D11 | UI direction | Variant A, the dark tile grid (Section 7) | User, 2026-10-15 |

## 4. Scope

### In scope

| Area | What ships |
|---|---|
| Rooms | Create, join by code or link, live lobby, start, host removes a player |
| Hand entry | Tile grid 0–13, Lucky 13 switch, six modifier toggles, "I busted", live working, validation, clear all, draft survives refresh |
| Submit and lock | Submit, edit until the last player submits, automatic lock |
| Waiting | Roster with Entering / Submitted / Offline and a count. No scores |
| Privacy | Each phone receives only its own player's data until the game ends |
| End | 200 check after each lock, winner or co-winners, ranked list, round-by-round scores table |
| Recovery | Refresh or reconnect returns the player to the same screen |

### Out of scope (deferred to `PRD.md`)

These items wait:

- QR code, nudge, reopen last round, play again, copy results.
- Host enters a hand for a player, transfer host, "Continue as…" on a new phone.
- End game early, target-score setting, strict-seven toggle, Unlucky 7 switch, shareable image.

These items never ship: accounts, other games.

## 5. Users and journey

- **Host.** Creates the room, starts the game, can remove a player. Also plays.
- **Player.** Joins, enters hands, reads own score.

Journey:

1. Host opens the page, taps **Create game**, enters a name. The page shows the code and a join link.
2. Players open the link (or enter the code) and type a name. All see the lobby list.
3. Host taps **Start** (3 to 12 players). Joining closes.
4. The group plays round 1 at the table, outside the product.
5. Each player enters the final hand and taps **Submit**. The player sees the round score and the private total so far.
6. The player waits. The roster shows who has submitted.
7. The last submit locks the round. Totals update. If nobody has 200 or more, round 2 opens (go to step 4).
8. When the lock leaves anyone at 200 or more, every phone shows the final screen.

## 6. Requirements

Every requirement has one or more tests in `ACCEPTANCE_CRITERIA.md`. The test IDs name the requirement ID.

### Rooms (RM)

| ID | Requirement |
|---|---|
| RM1 | The host creates a room with a display name. The page returns a 4-character code and a join link (`/?room=CODE`). |
| RM2 | The code uses only the characters `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. The code field accepts any letter case. |
| RM3 | A player joins with a code and a name. A name is 1 to 20 characters after trimming. A name must be unique in the room, ignoring letter case. |
| RM4 | The lobby shows every player live, marks the host, and marks players who are offline. |
| RM5 | The host starts the game when 3 to 12 players are present. A room holds at most 12 players. Joining closes at start. |
| RM6 | The host can remove any other player, in the lobby or during play, after a confirmation. The game must keep at least 3 players. |
| RM7 | A room and all its data are deleted 24 hours after the last activity. |

### Hand entry (HE)

| ID | Requirement |
|---|---|
| HE1 | The grid shows 14 tiles for Number cards 0 to 13. A tap selects or deselects a tile. A selected tile shows a check mark and a filled background. |
| HE2 | A hand holds at most 7 Number cards. At 7, the unselected tiles are disabled and a note says "7 cards is a Flip 7". |
| HE3 | After 13 is selected, a **Lucky 13** switch appears. When the switch is on, a second 13 can be added and counts as a card. Deselecting 13 turns the switch off and removes the second 13. |
| HE4 | Six toggles: −2, −4, −6, −8, −10, ÷2. Each toggles on and off. |
| HE5 | **I busted** opens a confirmation. Confirming sets the entry to a bust. A bust scores 0. |
| HE6 | A working line updates on every change. It shows each step, for example `13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13`. A hand with seven Number cards shows `Flip 7 +15`. |
| HE7 | **Clear all** asks for confirmation and then empties the hand. |
| HE8 | The screen explains The Zero, Unlucky 7 and Lucky 13 in one short line each. |
| HE9 | A draft hand survives a page refresh. A draft is kept per room and per round on the phone only. |
| HE10 | A note under the grid reads: "Drew a number you already hold? That is a bust. Tap I busted." |

Unlucky 7 has no control. It scores as a normal 7 and the calculator cannot tell it apart (`../GAME_CONTEXT.md` Section 6). Tapping 7 selects a 7. A second 7 is a bust, and HE10 tells the player so.

### Submit and lock (SB, RD)

| ID | Requirement |
|---|---|
| SB1 | The **Submit** button shows the score it will send, for example `Submit 13`. It sits apart from the grid. |
| SB2 | A player can change a submission until the round locks. The player taps **Edit**, changes the hand, and submits again. |
| SB3 | An empty hand can be submitted. It scores 0. The button reads `Submit 0 (no cards)`. |
| RD1 | The round locks when every player in the room has submitted. The server computes every score from the entries. The phone never sends a score. |
| RD2 | After a lock, if no player has a total of 200 or more, the next round opens at once. |
| RD3 | After a lock, a player sees only own round scores and own total. |

### Waiting (WT)

| ID | Requirement |
|---|---|
| WT1 | After a player submits, the screen shows a roster. Each player is **Entering**, **Submitted** or **Offline** (icon and text). A count reads, for example, `5 of 7 submitted`. |
| WT2 | The roster never shows a score or a total. |

### Ending (EN)

| ID | Requirement |
|---|---|
| EN1 | After each lock, the server finds the highest total. If it is 200 or more, the game ends. Every player whose total equals the highest total is a winner. |
| EN2 | Every phone shows the same final screen: winners and their total first, then all players ranked by total. Equal totals share a rank. |
| EN3 | Below the ranking, a table lists the score of every player in every round. Busts and Flip 7 rounds are marked. The table never shows hands. |
| EN4 | After the game ends, a reload shows the final screen until the room is deleted (RM7). |

### Recovery (RC)

| ID | Requirement |
|---|---|
| RC1 | A refresh, a tab switch or a lost connection returns the player to the screen they were on, with data intact. |
| RC2 | The page reconnects by itself. While it reconnects, a banner reads "Reconnecting…". |

### Privacy (PV)

| ID | Requirement |
|---|---|
| PV1 | Until the game ends, a phone receives its own player's hand, round scores and total, and nothing about the score of any other player. |
| PV2 | The roster shows submission status only (WT2). |
| PV3 | Nothing, at any time, shows how many players are at 200 or more. |

### Non-functional (NF)

| ID | Requirement |
|---|---|
| NF1 | No account and no install. The page works from a link on a current phone browser. |
| NF2 | The service runs on the Cloudflare free plan. |
| NF3 | The layout works at 360 px width with no sideways scroll. Tap targets are at least 44 px. |
| NF4 | Every screen carries the line "Unofficial fan tool. Not made by The Op Games." |
| NF5 | Names show as plain text. The page never interprets a name as markup. |
| NF6 | The page follows the phone's light or dark setting. |

## 7. Screens and layout

Six screens. One job per screen.

| Screen | Job | Main elements |
|---|---|---|
| Home | Start or join | **Create game**, **Join game** (code field, name field) |
| Lobby | Gather players | Code, join link with copy button, player list, **Start** (host), **Remove** (host) |
| Entry | Build a hand | See the wireframe below |
| Waiting | Show who is left | Own score and own total, roster, **Edit** |
| Final | End the game | Winners, ranking, rounds table |
| Reconnecting | Show a lost link | A banner above the current screen. It is not a separate page |

Entry screen at 360 px width:

```
┌──────────────────────────────┐
│ Round 3               Room K7QF │
│ Your total so far: 87         │
├──────────────────────────────┤
│ Number cards   3 of 7         │
│ [ 0][ 1][ 2][ 3]              │
│ [ 4][ 5][ 6][ 7]              │
│ [ 8][ 9][10][11]              │
│ [12][13]  Lucky 13  [ off ]   │
│ Modifiers                     │
│ [−2][−4][−6][−8][−10][÷2]     │
├──────────────────────────────┤
│ 13 + 12 + 10 = 35 → ÷2 = 17   │
│ → −4 = 13                     │
├──────────────────────────────┤
│ [Clear all]        [I busted] │
│                               │
│        [  Submit 13  ]        │
└──────────────────────────────┘
```

Layout rules:

- The working line sits directly under the controls it explains.
- **Submit** sits at the bottom, with space above it. **Clear all** and **I busted** sit above that space, on separate sides.
- Selection shows a check mark and a fill, not colour alone.
- **Remove**, **I busted** and **Clear all** always ask for confirmation.

**Chosen design: Variant A, tile grid.** The prototype is in `ui-prototype/index.html` (open with `?variant=A`). Variants B (hand tray and keypad) and C (score-first ledger rows) are not chosen. Their code stays in the prototype file for reference only. Do not build from them.

Details from the Variant A prototype that the build keeps:

- Dark theme by default. A light theme follows the phone setting (NF6).
- The Lucky 13 control is one cell in the grid. It reads "Lucky 13: off" and is dimmed until 13 is selected. When on, it splits into "Lucky 13 ✓" and a "+13" tile for the second 13.
- The header shows the round and the room code. A line under it shows "Your total so far: N · private".
- The special-card help sits in a collapsed "What do the special cards do?" section.
- Final screen: a green winner banner ("Winner" or "Co-winners"), the ranked list, then the rounds table. Busts and Flip 7 rounds carry a small label.
- The final screen shows only when the game phase is finished (EN1, PV1).

The prototype is throwaway code. Rewrite it in the real client. It was not committed to git.

## 8. Playtest and stop rule

Run Slice 0 once with a real group of 4 or more players who know the game. Record:

| Measure | Proposed bar |
|---|---|
| The game reaches a final screen without the host editing anything | Yes |
| Time from the last real-world round end to lock, median per round | Under 90 seconds |
| Players who say they would use hidden totals again | A majority |
| Scoring disagreements with the physical rulebook | None |

**Stop rule.** Stop the full build if any one of these happens:

- The group goes back to paper before the game ends.
- Fewer than half the players would use it again.
- A score disagrees with the rulebook, and the fix is not a change to the scoring module.

If the group likes it, build the deferred features in the order of `PRD.md` Section 12.

The bars are proposals. Change them before the playtest, never after.

## 9. Differences from `PRD.md`

| `PRD.md` | Slice 0 |
|---|---|
| H2: Unlucky 7 switch | No switch. Help text only (D8) |
| H7: block or explain impossible hands | Impossible hands cannot be built: tiles are single-select and capped at 7. A duplicate is a bust, and HE10 says so |
| H8: Undo and Clear all | Tap to deselect replaces Undo. Clear all stays |
| W4: host enters a hand for a player, or removes the player | Remove only (RM6) |
| R5: players can rejoin after start | Players rejoin only on the same phone and browser, with the saved token. A name typed after start is refused |
| E4, 8.11 settings | Fixed 200 and fixed seven-card rule |

## 10. Risks accepted

| Risk | Effect | Plan |
|---|---|---|
| A player's phone dies before submit | The round cannot lock | The host removes the player (RM6). If the player returns on the same browser, the player has lost the place |
| A typed hand does not match the table | A wrong score stays hidden until the end | The table can check face-up cards. Reopen is deferred |
| The official app adds hidden totals | The gap closes | Run the playtest soon |
| Cloudflare free-plan limits change | The service stops or costs money | `ARCHITECTURE.md` Section 9 lists the numbers to check before launch |
| Use of the "Flip 7" name | Possible takedown request | NF4 notice. No logos or card art |
