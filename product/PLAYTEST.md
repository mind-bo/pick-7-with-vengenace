# Playtest: Slice 0

Status: ready for the session. The bars in Section 2 are proposals.
Companion documents: `slice0/PRD_SLICE0.md` Section 8 (the template), `slice0/ACCEPTANCE_RESULTS.md` (the manual checks), `PRD.md` Section 12 (the build order after a pass).

The user leads this session. Claude does not run it.

---

## 1. The question

Do players want their running totals hidden from the table?

The playtest answers only this question. It does not test whether the app is easy to build on, or how it looks on every phone.

## 2. The bars

Read each bar. Change any bar that you do not accept. **Change the bars before the session. Never change them after.** Write the date of the lock in the last line of this section.

| # | Measure | Bar |
|---|---|---|
| 1 | The game reaches a final screen without outside help | Yes |
| 2 | Time from the end of a real-world round to the lock, median over all rounds | Under 90 seconds |
| 3 | Players who say they would use hidden totals again | A majority |
| 4 | Scoring disagreements with the physical rulebook | None |

How to read measure 1. "Without outside help" means that nobody removes a player, restarts the app, or asks the builder for help. The Slice 0 app has no host editing, so a host edit cannot happen.

Bars locked on: ____________ (date), by: ____________

## 3. The stop rule

Stop the full build if one of these happens:

- The group goes back to paper before the game ends.
- Fewer than half the players would use the app again.
- A score disagrees with the rulebook, and the fix is not a change to the scoring module.

If none of these happens and the bars hold, build the deferred features in the order of `PRD.md` Section 12.

## 4. Before the session

Do these steps one day before.

1. Pick 4 or more players. All of them must know the game. Each player needs a phone with a web browser. The group needs one physical copy of *Flip 7: With a Vengeance*.
2. Open `https://pick-7.projectdarkinblade.workers.dev` on your own phone. The page must show "Pick 7 scorekeeper".
3. Pick one observer. The observer does not play. The observer keeps the logs in Sections 6 and 7 and a clock.
4. Print Sections 6, 7 and 8, or keep this file open.

Tell the players these facts before the game:

- The app keeps each total private. It shows a total only to its owner, until someone reaches 200.
- Use the same phone and the same browser for the whole game. A player who clears the browser data loses the seat.
- A round locks when every player presses Submit. A player can press Edit before the lock.
- The host can remove a player who is stuck. A removed player cannot come back.
- The app removes the room after 24 hours without activity.
- Nobody should look at another player's phone.

## 5. The session

1. The host opens the address, types a name, and presses **Create game**.
2. The host reads the 4-letter room code aloud, or sends the join link.
3. Each other player opens the link, types a name, and presses **Join game**.
4. The host presses **Start game** when everyone is in the list.
5. The group plays round 1 with the physical cards. Nobody keeps score on paper.
6. When the round ends, each player taps the cards on the table and presses **Submit**.
7. The observer logs the times in Section 6 for every round.
8. Repeat from step 5 until the Final screen shows.
9. The observer asks each player the question in Section 8.

The observer must not help during the game. If a player cannot continue, the observer writes the problem in Section 9 and then helps. That round counts as "outside help" for measure 1.

If the group goes back to paper, write the round number and the reason in Section 9. This triggers the stop rule.

## 6. Timing log

The observer fills one row for each round.

- **Round end.** The clock time when the last player finishes the real-world round. Examples: the last player stays, or busts, or the Flip 7 ends the round.
- **Lock.** The clock time when the phones show the next round, or the Final screen.

| Round | Round end (hh:mm:ss) | Lock (hh:mm:ss) | Seconds |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |

Median of the Seconds column: ____________

## 7. Scoring log

For every round, each player compares the score on the phone with the score from the rulebook. The rulebook example in `GAME_CONTEXT.md` Section 5 shows the order of the steps.

Write one row for each disagreement. Write "none" if there is no disagreement.

| Round | Player | Hand (cards and modifiers) | Score on the phone | Score from the rulebook |
|---|---|---|---|---|
| | | | | |
| | | | | |

## 8. Player question

After the Final screen, the observer asks each player this question:

> Would you use hidden totals again in your next game?

| Player | Yes or no | One comment (optional) |
|---|---|---|
| | | |
| | | |
| | | |
| | | |
| | | |
| | | |

Count of "yes": ______ of ______ players.

## 9. Problems and notes

Write every problem, even a small one. Write what the player did and what the app did.

| Time | Player | What happened |
|---|---|---|
| | | |
| | | |
| | | |

## 10. Result

Fill this section after the session.

| # | Measure | Bar | Result | Met? |
|---|---|---|---|---|
| 1 | Final screen without outside help | Yes | | |
| 2 | Median seconds from round end to lock | Under 90 | | |
| 3 | Players who would use it again | A majority | | |
| 4 | Scoring disagreements | None | | |

Stop rule triggered? Tick all that apply.

- [ ] The group went back to paper before the game ended.
- [ ] Fewer than half the players would use the app again.
- [ ] A score disagreed with the rulebook, and the fix is not a change to the scoring module.

Decision: ____________ (stop the full build, or build the deferred features)

Date: ____________  Group size: ______  Rounds played: ______
