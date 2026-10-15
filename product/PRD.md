# PRD — Private Scorekeeper for Flip 7: With a Vengeance

Status: Draft v2 (full vision; the first build is `slice0/PRD_SLICE0.md`) · Owner: projectdarkinblade · Date: 2026-10-14
Companion docs: `GAME_CONTEXT.md` (game rules and scoring). The PRD is based on `GAME_CONTEXT.md`. If the two documents disagree on a game rule, `GAME_CONTEXT.md` is correct.

Decisions made in v2: ties at the top give co-winners (no tiebreak round); the final scorecard shows scores only, not hands; hosting is a small free web service (Section 16).

---

## 1. Summary

A free, lightweight web page that works on phones. A group playing Flip 7: With a Vengeance at a table joins one shared room by code. After each round, every player privately enters the cards in front of them. The page calculates their round score using the game's real rules and adds it to their private running total. Nobody sees anyone else's total until the game ends. When a round finishes with anyone at 200+, the page names the winner and shows a full scorecard to everyone.

Standard mode only. Brutal Mode is not included.

## 2. Problem

Today each player tracks their own total on paper or in their head, keeps it secret, and calls out when they pass 200. This causes:

- **Manual burden.** Everyone does their own arithmetic every round, including halving (rounded down), subtracting modifiers, the floor at zero and the 15-point Flip 7 bonus.
- **Math mistakes.** The scoring order is easy to get wrong.
- **Trust.** Nobody can check whether a player really reached 200 or skipped a round.
- **Messy endings.** Someone says "I'm at 200" and the group has to work out who actually won.

## 3. Goals

1. Remove manual arithmetic. A player taps their cards and sees the correct score.
2. Keep each player's running total private during the game.
3. Make the end clear: one winner announcement, one scorecard, no arguing.
4. Be fast to start: no installs, no accounts, join in under 30 seconds.
5. Be correct: scoring matches the official rulebook, and ambiguous cases follow stated defaults.

## 4. Non-goals

- Brutal Mode or any other variant (negative scores, modifiers on busted players, subtracting the Flip 7 bonus).
- Playing the game itself (no virtual deck, dealing, turns, or Action card handling).
- Tracking draws, Swap/Steal/Discard sequences, or verifying that a typed hand matches the physical cards.
- Accounts, profiles, friends lists, stats across games, or chat.
- Other games.
- Monetisation.

## 5. Users

- **Host.** The person who starts the room. Usually the dealer or the person who owns the game. Wants setup to take seconds and wants control if something goes wrong.
- **Player.** Everyone else at the table, on their own phone. Wants to enter cards quickly and trust the number.
- Context: a living-room or café table, phones in hand, possibly dim light, people talking. Groups of 3 to 12 (assumption; the game allows 3+ with no stated maximum).

## 6. Core concept in one line

> Everyone submits their own hand each round in private. The round locks when all have submitted. Totals stay hidden until the game ends.

## 7. User journey

1. **Host creates a room.** Taps "Create game", enters a name, and gets a short room code, a join link and a QR code.
2. **Players join.** Open the link (or enter the code), type a name, and appear on the lobby list.
3. **Host starts the game.** Round 1 opens for entry.
4. **Round is played at the table** (outside the product).
5. **Each player enters their final hand** and submits. They see a confirmation of their round score and their own running total, nobody else's.
6. **Waiting.** Players see who has submitted (not scores) until everyone has.
7. **Round locks.** The product updates every total. If nobody is at 200+, the next round opens (go to step 4).
8. **Game ends.** Once a locked round leaves anyone at 200+, every player sees the winner announcement and the full scorecard.
9. **After the game.** The group can play again in the same room with the same players.

## 8. Functional requirements

Priority: **Must** = needed for first release, **Should** = strongly wanted, **Could** = later.

### 8.1 Rooms and joining

| ID | Requirement | Priority |
|---|---|---|
| R1 | Host can create a room and receives a short room code (4 characters; letters/digits that are hard to confuse when read aloud, so no 0/O or 1/I/L). | Must |
| R2 | Players join by entering the code and a display name. No account or app install. | Must |
| R3 | Join link and QR code so people can skip typing the code. | Should |
| R4 | Lobby shows who has joined. Names must be unique in a room; duplicates are asked to change. | Must |
| R5 | Joining closes when the host starts the game. Players who were already in can always rejoin. (See open question Q5 on late joiners.) | Must |
| R6 | Supports 3 to 12 players in the first release. | Must |
| R7 | Rooms expire automatically after a period of inactivity, so old codes stop working. | Should |

### 8.2 Hand entry (the calculator)

| ID | Requirement | Priority |
|---|---|---|
| H1 | Entry screen shows a grid of large tiles for the Number cards **0 to 13**. Tapping a tile adds or removes it from the hand. | Must |
| H2 | Special cards are shown clearly: **The Zero** (the 0 tile), **Unlucky 7** and **Lucky 13**, each with a short explanation. The 7 tile has an "Unlucky 7" switch. The 13 tile has a "Lucky 13" switch, and it allows a second 13 only when the switch is on. Unlucky 7 scores as a normal 7. | Must |
| H3 | Modifier toggles: **−2, −4, −6, −8, −10, ÷2**. | Must |
| H4 | A prominent **"I busted"** option that sets the round score to 0 with one tap and confirmation. | Must |
| H5 | A **live preview** shows the working in plain words as the hand changes, for example "13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13", so the player can check it against their cards. | Must |
| H6 | The preview marks a Flip 7 automatically when the hand has seven Number cards and shows the +15. | Must |
| H7 | Impossible hands are prevented or explained, not silently accepted. Examples: two of the same number (except two 13s with Lucky 13); Unlucky 7 together with a normal 7; more than seven Number cards. Messages say what to check (for example "A second 13 is only allowed with Lucky 13"). A repeated number, or Unlucky 7 with a normal 7, is a bust under the rules (`GAME_CONTEXT.md` Sections 4 and 7). The message tells the player to check their cards and offers "I busted" (score 0). | Must |
| H8 | **Undo** and **Clear all** (with confirmation) are always visible. | Must |
| H9 | Tiles do not rely on colour alone to show selection (use check marks or counts as well). Tap targets are comfortably large for one-handed use. | Must |
| H10 | Unsubmitted selections survive a page refresh or accidental navigation. | Should |
| H11 | Dark mode / low-light friendly appearance. | Should |

### 8.3 Submitting and locking

| ID | Requirement | Priority |
|---|---|---|
| S1 | The submit button shows the score it will submit (for example "Submit 13") and sits apart from the card grid to avoid accidental taps. | Must |
| S2 | A player may **edit** their submission until every player has submitted. | Must |
| S3 | When the last player submits, the round **locks**. No further edits by players. | Must |
| S4 | A busted player submits 0 through the same flow. A player cannot skip a round. | Must |
| S5 | After a round locks, running totals update and the next round opens, unless the game is over. | Must |
| S6 | Host can correct a mistake in the most recently locked round by reopening it (shown to all as "round reopened by host"). | Should |

### 8.4 Waiting for others

| ID | Requirement | Priority |
|---|---|---|
| W1 | After submitting, the player sees a roster with each player marked **Entering / Submitted / Offline** (icon plus text) and a count, for example "5 of 7 submitted". | Must |
| W2 | The roster never shows scores. | Must |
| W3 | Host can send a **nudge** to players who have not submitted. | Should |
| W4 | If a player is gone (phone died, left the table), host can **enter a hand on their behalf** or **remove them**. Host-entered hands are marked "entered by host" on the final scorecard. | Must |
| W5 | No automatic timeouts. People may still be counting cards. | Must |

### 8.5 What each person can see (privacy rules)

| Information | During the game | At game end |
|---|---|---|
| Own hand and round score | Own player only | Own hand: own player only. Round score: everyone |
| Own running total | Own player only | Everyone |
| Others' hands | **Hidden** | **Hidden** (never shown) |
| Others' round scores and totals | **Hidden** | Everyone |
| Who has submitted this round | Everyone | — |
| Number of players at 200+ | Hidden until the game ends | Everyone |
| Host-entered or host-corrected hands | Visible to the affected player | Marked on the scorecard |

A player sees their own running total and round history throughout. The per-round values for other players are also hidden because they would reveal the totals.

### 8.6 Round end and winner

| ID | Requirement | Priority |
|---|---|---|
| E1 | Each time a round locks, the product checks whether **any player has 200 or more**. | Must |
| E2 | If no one does, the next round opens. | Must |
| E3 | If at least one does, the game ends and the **highest total** wins. This is not "first to cross 200": everyone has already finished the round (`GAME_CONTEXT.md` Section 5). | Must |
| E4 | The target of 200 is shown in the room. The host may change it before round 1 (for shorter games). | Could |

### 8.7 Ties

| ID | Requirement | Priority |
|---|---|---|
| T1 | If two or more players share the top total at 200+, all of them are **co-winners**. The product announces them together. No tiebreak round is played. | Must |
| T2 | A tie below the top total does not matter. Only players who share the highest total are winners. | Must |

The official sources do not rule on ties (`GAME_CONTEXT.md` Section 7). Co-winners is the product's chosen default.

### 8.8 Final scorecard

| ID | Requirement | Priority |
|---|---|---|
| F1 | Everyone sees the same end screen: **winner (or co-winners) and final score first**, then a ranked list of all players with totals. | Must |
| F2 | Below the ranking, a round-by-round table (rounds × players) of **scores** lets everyone verify the result. Busts and Flip 7s are visibly marked. The table shows scores only, not hands. | Must |
| F3 | Layout works well as a screenshot on a phone. | Should |
| F4 | A **"Play again"** action keeps the room and the players and resets scores. | Should |
| F5 | A copy-results option (text) so the result is never lost if the room expires. | Should |

### 8.9 Returning to the game

| ID | Requirement | Priority |
|---|---|---|
| X1 | A player who refreshes, switches tabs, or loses connection lands back on the screen they were on, with their name and data intact. | Must |
| X2 | If a player returns on a different phone or cleared their browser, they can pick their name from a "Continue as…" list of players who are currently offline. | Should |
| X3 | Accidental destructive actions (Leave game, End game) sit away from Submit and require confirmation. | Must |
| X4 | If the host disappears, another player can be made host. | Should |

### 8.10 Host controls summary

Start game · Nudge · Enter hand for a player · Remove player · Reopen last round · End game early (shows the scorecard as it stands, with confirmation) · Play again · Transfer host.

### 8.11 Setup options (kept minimal)

| Option | Default |
|---|---|
| Target score | 200 |
| "Seven" counts Number cards, with both 13s counting under Lucky 13 | On (alternative: strict seven *different values*) |

## 9. Scoring behaviour

The calculator follows `GAME_CONTEXT.md`, Section 5. In plain terms, for each player:

1. A bust scores 0.
2. Add up the Number cards.
3. The Zero makes the score 0 unless the hand is a Flip 7.
4. ÷2 halves the total, rounding down.
5. Minus modifiers are subtracted. The score cannot go below 0.
6. A Flip 7 (seven Number cards) adds 15 after that.

A Flip 7 ends the round at once. Every other player who has not busted still enters and scores the cards in front of them. Only the Flip 7 player gets the +15. A player cannot skip a round (S4).

Every entered hand shows its working so players can see *why* they got that number.

## 10. Experience principles

- **One job per screen.** Join, enter, wait, finish. Each screen says what happens next.
- **Show the working.** The score is never a mystery. The equation sits under the card grid.
- **Prevent, then explain.** Impossible combinations are blocked with a short reason.
- **Calm at a noisy table.** Large controls, readable in dim light, no timers, no sounds required.
- **No surprises on leave.** Nothing destructive is one tap away.

## 11. Success measures

- A group of four goes from opening the link to submitting round 1 in under two minutes.
- At least 90% of rounds are submitted without needing the host to edit or enter on someone's behalf.
- Playtest at a real table: players report fewer disputes and less time spent on math than with paper.
- No known scoring disagreement with the rulebook across a test set of hands (see Section 13).
- Players choose to use it for a second game.

## 12. Release scope

**First release (must-haves):** rooms with code, join by name, lobby, hand entry with live working and validation, bust option, submit and edit-until-lock, waiting roster, privacy rules, winner check at round end, tie handling, final scorecard, refresh recovery, host enter-for-player and remove.

**Next:** QR/join link, nudges, reopen last round, play again, copy results, dark mode polish, transfer host, "Continue as…" on a new phone, room expiry.

**Later:** shareable result image, saved groups, other house rules.

## 13. Acceptance checks for scoring

A short set of hands the calculator must get right (details in `GAME_CONTEXT.md`):

| Hand | Expected |
|---|---|
| Total 48 with ÷2, −4, Flip 7 | 35 |
| 13, 12, 10 with ÷2, −4 | 13 |
| 3, 2 with −10 | 0 |
| 0, 4, 9 | 0 (The Zero, no Flip 7) |
| 0, 1, 2, 3, 4, 5, 6 | 36 (Flip 7 with The Zero) |
| 0–6 with all five minus modifiers | 15 (floor, then +15) |
| Any bust | 0 |

## 14. Risks and assumptions

| Risk or assumption | Impact | Plan |
|---|---|---|
| **Players may not want hidden totals.** Cards are face-up, so only totals are secret. No community evidence either way. | The core differentiator may matter less than expected. | Playtest at one real table before polishing. Consider a "show totals each round" room option later. |
| **Typed hands can't be verified** against physical cards. | A player could mistype or cheat. | Hands are face-up, so the table can check. The end scorecard shows all round scores for review. Host can reopen the last round. |
| **Rule ambiguity.** Ties, "seven different" with two 13s, and a few Swap/Steal edge cases have no official ruling. | Disagreements about who won or who got +15. | Stated defaults (Sections 8.7, 8.11 and `GAME_CONTEXT.md` Section 7), shown in the room's setup. |
| **Scoring order mistakes.** A competing app shipped a multiplier-order bug. | Wrong scores destroy trust. | Acceptance checks above; show the working. |
| **Players need to join with no friction.** | If players must sign up or install anything, the table won't bother. | Requirement: no accounts, no installs, works from a link. This also constrains how the product is hosted (see Q1). |
| **Official scoring tool not inspected.** The Op Games site links a "Flip 7 Scoring Web App" (see Q8). Its content could not be read during research. | The product may duplicate it. | Open it on a phone before launch and note any overlap (Q8). |
| **Rooms are guessable** if codes are short. | A stranger could join a room. | Rooms expire; host can remove players; games with a started round are closed to new joiners. |
| **Assumption:** 3–12 players per room. | — | Confirm. |

## 15. Open questions (decisions needed)

| # | Question | Suggested default |
|---|---|---|
| Q1 | **Hosting route.** Decided: a small free web service, not Claude.ai. See Section 16. | Closed. |
| Q2 | Tiebreak round. Decided: no tiebreak. Players who share the top total are co-winners. | Closed. |
| Q3 | Hands on the final scorecard. Decided: no. The scorecard shows scores only. | Closed. |
| Q4 | Should the product reveal anything between rounds (for example "someone is above 150")? | No. Hidden until the end, as stated. |
| Q5 | Can a player join after round 1 has started? | No. Closed once the game starts. Host can add a late player only at a round boundary (they start at 0). |
| Q6 | Should the app allow a host to set a lower target (for example 100) for short games? | Yes, as a Could. |
| Q7 | Max players: 12 enough? | Yes for the first release. |
| Q8 | What is the official Op Games scoring app? The Op Games Flip 7 page (theop.games/pages/flip-7) links a "Flip 7 Scoring Web App" at flip7-46611.web.app, next to a paper score sheet. I could not read the app (it needs JavaScript to load). I could not confirm that it covers *With a Vengeance*, that it is multi-phone, or that it hides totals. Several third-party apps (for example Score Keeper for Flip 7, FlipScore) list Vengeance support in their store text. None of those listings mention private totals across phones. | Open it on a phone before launch and note what it does. Treat the private multi-phone room as the differentiator only if it is missing there. |

## 16. Hosting decision (Q1)

Requirements that drive the choice: free; light; **each phone receives only its own player's data until the game ends**; players need no account or install; one room is a few phones talking in real time.

| Option | Fit | Notes |
|---|---|---|
| **Cloudflare Workers + Durable Objects (free plan). Recommended.** | Good | One Durable Object per room holds the state and the phone connections. The server sends each phone only its own data, so secrecy is enforced on the server. Static page and server come from one project. Free plan: 100,000 requests per day, 5 GB storage. WebSocket messages count toward requests (incoming at a 20:1 ratio). Use WebSocket hibernation so idle rooms cost no duration. Cloudflare's pricing page and a preview copy of it disagree on the daily duration allowance (313,000 vs 13,000 GB-s). Check the live page before launch. Estimate (not measured): one game is well under 1,000 messages, so the free limit fits many games per day. |
| Supabase free plan | Possible | Real-time database. Third-party sources (not Supabase's own page) list 200 concurrent realtime connections and 2 million messages per month. The project pauses after 7 days of inactivity, so a first player may meet a sleeping server. Hidden data needs row-level security rules, which is more work to get right than a server that only sends what each phone may see. |
| Page inside Claude.ai | Rejected | Viewers of shared artifacts may need Claude accounts. Per-player secrecy is not documented. Use only as a throwaway prototype. |

Other hosts (for example Firebase) were not evaluated. Storage, the message format and the exact room-expiry rules belong to the technical plan.
