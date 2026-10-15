# Acceptance results: Slice 0, manual checks (Phase 8)

Companion documents: `ACCEPTANCE_CRITERIA.md` (the criteria), `IMPLEMENTATION_PLAN.md` (Phase 8).

## How the checks ran

- **Phones.** Three emulated phones, each in its own browser context. The browser was Microsoft Edge (Chromium). Each phone had a 360 px by 780 px screen, a pixel ratio of 3, a mobile user agent, and touch input. Every tap was a touch tap.
- **Players.** The names were `WWWWWWWWWWWWWWWWWWWW` (20 wide letters), `Samantha-Jane-Smith!`, and `<i>Lee</i>`. They test long names and markup.
- **Run 1.** The live address, `https://pick-7.projectdarkinblade.workers.dev`, on 2026-10-15.
- **Run 2.** A local `wrangler dev` of the fixed build. Run 2 repeated Run 1 after two defect fixes.
- **Game.** One full 10-round game. It had a bust, three Flip 7 rounds, a 10-column Final table, and a network drop.
- **Screenshots.** A screenshot of every screen in dark and light, in `%TEMP%\p7-e2e-out`. They are not in the repository.

## Result

| Run | Checks | Failed |
|---|---|---|
| 1 (live, before fixes) | 55 of 56 | 1 (not a defect, see below) |
| 1, with the new clipping check | 60 of 63 | 3 (2 clipping defects, 1 not a defect) |
| 2 (local, after fixes) | 62 of 63 | 1 (not a defect, see below) |

The one failure left in Run 2 is not a defect. The page logs a console error for each `426` reply. The app sends a plain GET to learn whether a room exists while the network is down. An existing room answers `426`.

## Criteria marked M

| ID | Result | Evidence |
|---|---|---|
| AC-H01 | Pass | A tap set the fill and the check mark. A second tap removed both. |
| AC-H02 | Pass | No button, input or summary was smaller than 44 px in either direction. Checked on Home, Lobby, Entry, Waiting and Final. |
| AC-H03 | Pass | At 7 cards the app disabled the other tiles. The header read "7 of 7 · Flip 7". |
| AC-H04 | Pass | 13 showed the switch. The switch gave a second 13 that counted as a card. Deselecting 13 removed both. |
| AC-H05 | Pass | All six modifiers switched on and off. |
| AC-H06 | Pass | A confirmation showed. The line read `Bust = 0` and the button read `Submit 0`. |
| AC-H07 | Pass | The line read `13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13`. |
| AC-H08 | Pass | Seven cards ended with `Flip 7 +15 = 43`. |
| AC-H09 | Pass | A confirmation showed. No tile or modifier stayed selected. |
| AC-H10 | Pass | The help lines and the duplicate-number note were present. |
| AC-H11 | Pass | A selected hand and its working line survived a refresh. |
| AC-L01 | Pass | The button number matched the last number in the working line. The gap from the Clear and Bust row to Submit was 22 px. The gap from the modifier row was 259 px. |
| AC-W04 | Pass | The statuses read `✓ Submitted` and `✎ Entering`. A status never relies on colour alone. |
| AC-E11 | Pass | The Final table marked a bust round and the Flip 7 rounds. |
| AC-C02 | Pass | A refresh returned each phone to Lobby, Entry, Waiting and Final, with data intact. |
| AC-C03 | Pass | The network was cut for 10 seconds. See the note below. |
| AC-N01 | Pass | From the link to the lobby took 1.2 s and 0.6 s on the live address. |
| AC-N02 | Pass | No screen scrolled sideways at 360 px. Final with 10 rounds fit in the screen. Final also fit at 320 px. |
| AC-N03 | Pass | Every screen showed the notice. |
| AC-N05 | Pass | The page background was `rgb(16, 19, 24)` with a dark phone and `rgb(245, 247, 250)` with a light phone. |
| AC-N07 | Pass, with one correction | See `ARCHITECTURE.md` Section 9. The live page lists 5 million rows read per day. The document said 50 million. |

Note on AC-C03. A browser test tool cannot cut an open WebSocket by switching the network off. The test closed the socket and refused new sockets for 10 seconds instead. During the cut:

1. The "Reconnecting…" banner showed.
2. The app refused Submit with the text "Not connected yet". The hand stayed on screen.
3. The other two players finished round 1, so the round locked.
4. After the 10 seconds the banner cleared. The phone then showed Round 2 with the right total.

## Defects found and fixed

1. **A clipped total on the Final screen.** A 20-letter winner name pushed the total out of its row. The row hides overflow, so the sideways-scroll check did not see the problem. A screenshot showed it. The fix is in `src/web/styles.css`. The test script now has a check for clipped row content. That check failed before the fix and passes after it.
2. **A wrapped button in the Lobby.** The text "Copy link" wrapped onto two lines. The fix is in `src/web/styles.css`.

## Not covered

- **A physical phone.** Emulation does not test thumb reach, real touch accuracy, screen glare, or a real operating-system theme switch.
- **A phone browser other than Chromium.** Safari on iPhone and Firefox were not tested. The page uses `100dvh`, `position: sticky` and the CSS `content` alternative-text form. Test these on an iPhone.
- **A real network loss.** AC-C03 used a socket drop, as described above.
- **The deployed fix.** Run 2 tested the fixes on a local build. The live address still runs the version from before the two fixes until the next deploy.
