# Acceptance criteria: Slice 0

Companion documents: `PRD_SLICE0.md` (requirements), `../GAME_CONTEXT.md` (rules), `ARCHITECTURE.md` (design).

Each criterion has an ID, the requirement it proves, and a test type:

- **U** = unit test on a pure function. Runs with `vitest`, no network.
- **I** = integration test against the room Durable Object.
- **M** = manual check on a real phone.

Slice 0 is accepted when every criterion passes. A failed **U** criterion on scoring blocks the playtest.

---

## 1. Scoring (requirement source: `../GAME_CONTEXT.md` Section 5)

Function under test: `scoreEntry(entry)`. Order of steps: bust → sum → The Zero → ÷2 (round down) → minus modifiers → floor at 0 → Flip 7 bonus.

| ID | Type | Entry | Expected score | What it proves |
|---|---|---|---|---|
| AC-S01 | U | Cards 1, 3, 4, 5, 10, 12, 13 · ÷2 · −4 | **35** | Rulebook example (sum 48 → 24 → 20 → +15) |
| AC-S02 | U | Cards 10, 12, 13 · ÷2 · −4 | **13** | Round down (35 → 17 → 13) |
| AC-S03 | U | Cards 5, 9 · −10 | **4** | Minus modifier |
| AC-S04 | U | Cards 2, 3 · −10 | **0** | Floor at 0 |
| AC-S05 | U | Cards 0, 4, 9 | **0** | The Zero without Flip 7 |
| AC-S06 | U | Cards 0, 1, 2, 3, 4, 5, 6 | **36** | The Zero inside a Flip 7 (21 + 15) |
| AC-S07 | U | Cards 0–6 · −2 −4 −6 −8 −10 | **15** | Floor first, then +15 (21 − 30 → 0 → 15) |
| AC-S08 | U | Bust | **0** | Bust |
| AC-S09 | U | Cards 7 · ÷2 | **3** | 3.5 rounds down |
| AC-S10 | U | Cards 10, 13 and a second 13 (Lucky 13) | **36** | Both 13s score |
| AC-S11 | U | Cards 1, 2, 3, 4, 5, 13 and a second 13 (Lucky 13) | **56** | Both 13s count toward the seven (41 + 15) |
| AC-S12 | U | Cards 0–6 · ÷2 | **25** | ÷2 with The Zero in a Flip 7 (21 → 10 → +15) |
| AC-S13 | U | Cards 10 · ÷2 · −4 | **1** | ÷2 happens before the minus (10 → 5 → 1, not 3) |
| AC-S14 | U | Cards 3 · ÷2 · −2 | **0** | Floor after ÷2 and minus (3 → 1 → −1 → 0) |
| AC-S15 | U | No cards · ÷2 · −4 | **0** | Empty hand never goes below 0 |
| AC-S16 | U | Cards 0–6 | `kind` is `flip7` and `working` ends with `Flip 7 +15` | Flip 7 mark |
| AC-S17 | U | Any entry | `scoreEntry` returns the same result when it runs twice | Pure function |

## 2. Entry validation (requirements HE2, HE3)

Function under test: `parseEntry(raw)`. It returns a valid `Entry` or an error with a code.

| ID | Type | Input | Expected |
|---|---|---|---|
| AC-V01 | U | Eight cards (0–7) | Error `TOO_MANY_CARDS` |
| AC-V02 | U | Cards 0–5 plus 13 and a second 13 (8 cards) | Error `TOO_MANY_CARDS` |
| AC-V03 | U | Second 13 with Lucky 13 off | Error `SECOND_13_NEEDS_LUCKY` |
| AC-V04 | U | Lucky 13 on and no 13 in the hand | Error `LUCKY_NEEDS_13` |
| AC-V05 | U | A card value of 14, −1 or 2.5 | Error `BAD_CARD` |
| AC-V06 | U | The same value twice in the list | Error `DUPLICATE_CARD` |
| AC-V07 | U | A minus value of 3 | Error `BAD_MODIFIER` |
| AC-V08 | U | The same minus value twice | Error `DUPLICATE_MODIFIER` |
| AC-V09 | U | Input is not an object, or has a missing field | Error `MALFORMED` |
| AC-V10 | U | Cards `[13, 5, 0]` (unsorted) | A valid entry with cards stored as `[0, 5, 13]` |
| AC-V11 | U | Exactly seven cards | Valid |
| AC-V12 | U | No cards, no modifiers | Valid |

## 3. Rooms and lobby (RM)

| ID | Type | Requirement | Given / When / Then |
|---|---|---|---|
| AC-R01 | I | RM1, RM2 | Given nothing, when the host creates a room, then the code has 4 characters and every character is in the allowed set. |
| AC-R02 | U | RM2 | Given 10,000 generated codes, then none holds `0 O 1 I L` and none is lowercase. |
| AC-R03 | I | RM2 | Given a room `K7QF`, when a player joins with `k7qf`, then the player joins that room. |
| AC-R04 | I | RM3 | Given a room with a player "Sam", when another player joins as " sam ", then the join is refused with `NAME_TAKEN`. |
| AC-R05 | I | RM3 | Given a join with an empty name or a name over 20 characters, then the join is refused with `BAD_NAME`. |
| AC-R06 | I | RM3 | Given a code that does not exist, when a player joins, then the player sees "Room not found". |
| AC-R07 | I | RM4 | Given a lobby, when a player joins or leaves, then every connected phone shows the new list within 2 seconds. |
| AC-R08 | I | RM5 | Given 2 players, when the host starts, then the start is refused with `NEED_3_PLAYERS`. |
| AC-R09 | I | RM5 | Given 3 players, when the host starts, then the phase changes to round 1. |
| AC-R10 | I | RM5 | Given 12 players, when a 13th joins, then the join is refused with `ROOM_FULL`. |
| AC-R11 | I | RM5 | Given a started game, when a new name joins, then the join is refused with `GAME_STARTED`. |
| AC-R12 | I | RM5 | Given a player who is not the host, when the player sends Start, then the command is refused with `HOST_ONLY`. |
| AC-R13 | I | RM6 | Given 4 players in a lobby, when the host removes one, then 3 remain and the removed phone gets `REMOVED`. |
| AC-R14 | I | RM6 | Given 3 players, when the host removes one, then the command is refused with `NEED_3_PLAYERS`. |
| AC-R15 | I | RM6 | Given a host, when the host removes the host, then the command is refused. |
| AC-R16 | I | RM6 | Given a round where 4 of 5 players have submitted, when the host removes the fifth, then the round locks. |
| AC-R17 | I | RM7 | Given a room idle for 24 hours, when the cleanup alarm fires, then all room storage is empty. A join to the code then returns "Room not found". |
| AC-R18 | I | RM7 | Given a room with a command at hour 23, then the alarm moves to 24 hours after that command. |

## 4. Hand entry screen (HE)

| ID | Type | Requirement | Check |
|---|---|---|---|
| AC-H01 | M | HE1 | Tap a tile. It shows a check mark and a fill. Tap again. Both disappear. |
| AC-H02 | M | HE1, NF3 | Each tile is at least 44 px square at 360 px width. |
| AC-H03 | M | HE2 | Select 7 tiles. The other tiles are disabled and a note names the Flip 7. |
| AC-H04 | M | HE3 | Select 13. The Lucky 13 switch appears. Turn it on. A second 13 shows and counts as a card. Deselect 13. The switch turns off and the second 13 goes. |
| AC-H05 | M | HE4 | Each of the six modifier toggles switches on and off. |
| AC-H06 | M | HE5 | Tap **I busted**. A confirmation shows. Confirm. The working line shows `Bust = 0` and the button reads `Submit 0`. |
| AC-H07 | M | HE6 | Select 13, 12, 10, turn on ÷2 and −4. The line reads `13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13`. |
| AC-H08 | M | HE6 | Select 7 cards. The line ends with `Flip 7 +15`. |
| AC-H09 | M | HE7 | Tap **Clear all**. A confirmation shows. Confirm. No tile and no modifier stays selected. |
| AC-H10 | M | HE8, HE10 | The screen shows one line for each of The Zero, Unlucky 7 and Lucky 13, and the duplicate-number note. |
| AC-H11 | M | HE9 | Select a hand. Refresh the page. The same hand shows. |
| AC-H12 | U | HE9 | A saved draft for round 2 does not load in round 3. |
| AC-H13 | U | HE6 | For every vector in Section 1, the working text on the screen comes from `formatWorking(scoreEntry(entry))` and ends in `= <expected score>`. |

## 5. Submit, edit and lock (SB, RD)

| ID | Type | Requirement | Given / When / Then |
|---|---|---|---|
| AC-L01 | M | SB1 | The Submit button shows the same number as the working line. It sits below a gap, away from the grid. |
| AC-L02 | I | RD1 | Given a started game, when a player sends an entry, then the server stores the entry and the player's status is Submitted. |
| AC-L03 | I | RD1 | Given a command that carries a `score` field, then the server ignores the field and computes the score itself. |
| AC-L04 | I | SB2 | Given a Submitted player and an unlocked round, when the player sends a new entry, then the new entry replaces the old one. |
| AC-L05 | I | RD1 | Given 4 of 5 players submitted, then the round has not locked and no total has changed. |
| AC-L06 | I | RD1 | Given the last player submits, then the round locks, each total increases by the player's round score, and round 2 opens. |
| AC-L07 | I | SB2 | Given round 3 is open, when a player sends an entry for round 2, then the server refuses it with `STALE_ROUND`. Nothing changes. Every Submit command names its round. |
| AC-L08 | I | SB3 | Given an empty entry, then it is accepted and scores 0. |
| AC-L09 | I | RD1 | Given a player who sends an invalid entry (any code in Section 2), then the server refuses it with that code. The stored entry stays the same. |
| AC-L10 | I | RD1 | Given the same Submit command sent twice, then the state after the second command equals the state after the first. |
| AC-L11 | I | RD1 | Given a command from a player who was removed, then the command is refused with `NOT_IN_ROOM`. |

## 6. Waiting and roster (WT)

| ID | Type | Requirement | Given / When / Then |
|---|---|---|---|
| AC-W01 | I | WT1 | Given 7 players with 5 submitted, then every phone shows `5 of 7 submitted`. |
| AC-W02 | I | WT1 | Given a player whose phone closes the socket, then the roster shows that player as Offline on the other phones within 5 seconds. |
| AC-W03 | I | WT1 | Given the player reconnects, then the roster shows the player as Entering or Submitted again. |
| AC-W04 | M | WT1 | Each status shows an icon and text, not colour alone. |

## 7. Ending the game (EN)

The function under test is `outcome(totals)`. It returns `{ finished, winners }`.

| ID | Type | Totals after a lock | Expected |
|---|---|---|---|
| AC-E01 | U | 199, 150, 90 | Not finished |
| AC-E02 | U | 200, 150, 90 | Finished. Winner: the 200 player |
| AC-E03 | U | 230, 215, 190 | Finished. Winner: the 230 player only |
| AC-E04 | U | 215, 215, 190 | Finished. Winners: both 215 players |
| AC-E05 | U | 205, 198, 40 | Finished. Winner: the 205 player only. The 198 player is not a winner |
| AC-E06 | U | 250, 250, 250 | Finished. Winners: all three |
| AC-E07 | U | 215, 215, 190 | Ranks: 1, 1, 3 |
| AC-E08 | I | After a lock leaves a total of 200 or more | The phase is Finished. No further entry is accepted. |
| AC-E09 | I | A game where round 4 locks with a total at 200 or more | Every phone gets the same Final view. |
| AC-E10 | I | A Final view | The rounds table holds one score for each player in each locked round. It holds no hand. |
| AC-E11 | M | EN3 | A bust round and a Flip 7 round each show a mark in the table. |
| AC-E12 | I | EN4 | Given a finished game, when a player reloads, then the player gets the Final view again. |
| AC-E13 | I | D10 | Given a player removed in round 2, then the Final view lists no row or column for that player. |

## 8. Privacy (PV)

| ID | Type | Requirement | Given / When / Then |
|---|---|---|---|
| AC-P01 | I | PV1 | Given a game with 5 players and a distinct sentinel number for each round score, when the game reaches round 3, then check every message each phone received. Those messages hold no round score and no total of another player. |
| AC-P02 | I | PV1 | Given the same game, then no message to any phone contains another player's entry (cards or modifiers). |
| AC-P03 | I | PV1, WT2 | Given a roster in any phase before Finished, then each roster item holds only `id`, `name`, `status` and `isHost`. |
| AC-P04 | U | PV1 | Given 200 random rooms before Finished, where every round score is a distinct sentinel number, then the JSON of `project(room, viewer)` holds no sentinel of another player. |
| AC-P05 | I | PV3 | Given a game where 2 players have 180 or more, then no message says how many players are near or above 200. |
| AC-P06 | I | PV1 | Given a Final view, then it holds all totals and all round scores. This is the only phase that does. |
| AC-P07 | I | PV1 | Given a connection with no valid token, then the server sends no room data. |
| AC-P08 | I | PV1 | Given a token for player A, when a client sends a command with player B's id, then the server uses A as the actor. |

## 9. Recovery (RC)

| ID | Type | Requirement | Given / When / Then |
|---|---|---|---|
| AC-C01 | I | RC1 | Given a player in Entry with a stored token, when the socket reconnects with the token, then the player gets the current view. The data is the same. |
| AC-C02 | M | RC1 | Refresh the page in each of: Lobby, Entry, Waiting, Final. Each returns to the same screen. |
| AC-C03 | M | RC2 | Turn off the phone's network for 10 seconds, then turn it on. A "Reconnecting…" banner shows, then clears, and the screen is current. |
| AC-C04 | I | RC1 | Given a player who submitted before a disconnect, then after the reconnect the player's status is still Submitted and Edit works. |
| AC-C05 | I | RC1 | Given two sockets for one token (two tabs), then both receive the same view and both can send commands. |
| AC-C06 | I | RM5 | Given a started game and a join with the name of an offline player but no token, then the join is refused with `GAME_STARTED`. |

## 10. Non-functional (NF)

| ID | Type | Requirement | Check |
|---|---|---|---|
| AC-N01 | M | NF1 | A new player goes from the link to the lobby in under 30 seconds, with no sign-up and no install. |
| AC-N02 | M | NF3 | No screen scrolls sideways at 360 px width. |
| AC-N03 | M | NF4 | Every screen shows the unofficial notice. |
| AC-N04 | U | NF5 | A name `<img src=x onerror=alert(1)>` shows as literal text in the lobby and in the Final view. |
| AC-N05 | M | NF6 | The page follows the phone's light or dark setting. |
| AC-N06 | I | NF2 | A 6-player, 8-round game sends fewer than 300 incoming WebSocket messages. (Counted in the test. Cloudflare bills incoming messages at 20 to 1 against the daily request limit.) |
| AC-N07 | M | NF2 | Before launch, the live Cloudflare Durable Objects pricing page still lists the free-plan limits recorded in `ARCHITECTURE.md` Section 9. |

## 11. Playtest acceptance

The bars in `PRD_SLICE0.md` Section 8 are the acceptance bars for the playtest. They are not unit tests. Record the results in `product/PLAYTEST.md` after the session.
