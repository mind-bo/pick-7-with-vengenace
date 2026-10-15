# Flip 7: With a Vengeance — Game Context

Reference for anyone (human or AI) building the scorekeeper. Covers what the game is, how it plays, the full deck, exact scoring, and the rule gaps where the official sources are silent. Standard mode only. **Brutal Mode is out of scope.**

> **Source confidence.** Rules come from the RulesPal transcription of the official rulebook, the Board Game Arena help page, the publisher FAQ (theop.games), and reviews. The printed rulebook PDF and BoardGameGeek could not be opened during research. Before launch, check Section 7 against the physical rulebook.

---

## 1. What the game is

- Publisher: The Op Games (USAopoly). Designers: Eric Olsen and Alyssa Swatek. Sequel to *Flip 7*.
- 3 or more players, ages 8+, about 20 minutes. No stated player maximum; a second deck is recommended above 18 players.
- A push-your-luck game, a little like blackjack. Players flip number cards one at a time. If you flip a number you already hold, you **bust** and score 0 for the round. Otherwise you can keep hitting or **stay** to bank your points.
- Goal: be the highest scorer at the end of the round in which someone reaches **200+** points.
- The "Vengeance" part: Action cards let players hurt each other (force draws, steal, swap, discard) and Modifier cards cut scores.

## 2. Key terms

| Term | Meaning |
|---|---|
| Hit | Take a card. |
| Stay | Take no more cards this round. Your cards stay in play and you can still be targeted by actions. |
| Bust | Flip a second card with the same number. You score 0 this round. |
| Active | A player who has neither stayed nor busted. |
| Round | Dealing continues until every player has stayed or busted, or someone flips 7. |
| Flip 7 | Seven number cards in front of you. Ends the round immediately. Scores a 15-point bonus. |

## 3. The deck (108 cards)

**Number cards: 92.** Value *n* (1 to 13) appears *n* times, so higher numbers are more common. There is one 0.

| Value | Copies | Notes |
|---|---|---|
| 0 | 1 | This is **The Zero** (special) |
| 1 | 1 | |
| 2 | 2 | |
| 3 | 3 | |
| 4 | 4 | |
| 5 | 5 | |
| 6 | 6 | |
| 7 | 7 | One of the seven is **Unlucky 7** (special) |
| 8 | 8 | |
| 9 | 9 | |
| 10 | 10 | |
| 11 | 11 | |
| 12 | 12 | |
| 13 | 13 | One of the thirteen is **Lucky 13** (special) |

Check: 1+2+…+13 = 91, plus the single 0 = 92. The specials are counted within those totals (89 plain 1–13 cards + The Zero + Unlucky 7 + Lucky 13 = 92). Some sources list plain copies only (for example "13 ×12, 7 ×6"), which is why totals look inconsistent between sources. They do not truly conflict.

**Modifier cards: 6**, one each: **−2, −4, −6, −8, −10, ÷2**.

**Action cards: 10**, two each: **Just One More!, Swap, Steal, Discard, Flip Four!**

Total: 92 + 6 + 10 = **108**.

## 4. How a round plays

1. The dealer shuffles and gives each player one face-up card, starting on the dealer's left and going clockwise. Action or Modifier cards are resolved immediately.
2. Clockwise, each active player chooses **hit** or **stay**. Number cards go in a row, Modifiers above them.
3. The round ends when everyone has stayed or busted, **or** a player gets a Flip 7 (ends immediately).
4. Nothing is scored until the round ends. Other players' actions can still change your hand until then.
5. Round cards go aside. The deck passes left and that player deals next. When the deck runs out, shuffle the discards into a new deck. If a reshuffle is needed mid-round, cards in front of players stay where they are.

### Special number cards

- **The Zero (0).** Your round total becomes 0 **unless you Flip 7**. You must keep hitting on your turn. It counts toward your seven cards.
- **Unlucky 7.** When you receive it, discard all your other Number and Modifier cards and keep only the 7. You cannot bust on receiving it. A *later* 7 does bust you (official FAQ). For scoring it is just a 7.
- **Lucky 13.** You may hold one other 13 without busting. Both score and both count toward the Flip 7. A third 13 busts you.

Special cards can be stolen or swapped. Their effect applies only while you hold them.

### Action cards

Resolved immediately when revealed. May be played on any player who has not busted, including yourself and players who have stayed. If you are the only player who has not busted, you must play it on yourself. A player who has stayed and receives one must resolve it but does not re-enter the round.

| Action | Effect |
|---|---|
| Just One More! | Force a player to take the next card, then they must stay. If it is an Action card, that player resolves it. |
| Swap | Swap any two face-up cards, either between you and another player or between two other players. |
| Steal | Take any face-up card from the table and add it to your line. |
| Discard | Force a player to discard one card. You choose which. |
| Flip Four! | Force a player to take the next four cards one at a time. Stops early if they bust or reach a Flip 7. Actions and Modifiers drawn are resolved in order after all four are drawn, if the player has not busted. |

If Swap, Steal or Discard is flipped at the start of a round with nothing to target, it is discarded.

### Modifier cards

Play on any player who has not busted (including players who have stayed). If you are the only player left, you keep it. Modifiers are not Number cards, so they never cause a bust and do not count toward a Flip 7. They can be swapped or discarded.

## 5. Scoring (this is what the calculator implements)

Per player, per round, using the player's **final face-up hand at the end of the round**:

1. **Bust** → round score **0**. Stop.
2. **Sum** the values of all Number cards in the hand.
3. **The Zero:** if the hand contains The Zero and is **not** a Flip 7, the round score is **0**. Stop.
4. **÷2:** if the hand holds ÷2, halve the sum, **rounding down**.
5. **Minus modifiers:** subtract every −2/−4/−6/−8/−10 held.
6. **Floor at 0:** the score cannot go below zero (standard mode).
7. **Flip 7 bonus:** if the hand has seven Number cards, **add 15** (after the floor).

Round scores are added to the player's running total.

### Worked examples

| Hand | Working | Round score |
|---|---|---|
| Number cards total 48, ÷2, −4, Flip 7 (rulebook's own example) | 48 → 24 → 20 → +15 | **35** |
| 13 + 12 + 10, ÷2, −4 | 35 → 17 (rounded down) → 13 | **13** |
| 5 + 9, −10 | 14 − 10 | **4** |
| 3 + 2, −10 | 5 − 10 = −5 → floored | **0** |
| 0, 4, 9 (no Flip 7) | The Zero without a Flip 7 | **0** |
| 0, 1, 2, 3, 4, 5, 6 (Flip 7 with The Zero) | 21 + 15 | **36** |
| 0, 1, 2, 3, 4, 5, 6 with all five minus modifiers (−2, −4, −6, −8, −10 = −30), floor before bonus | 21 − 30 → 0, then +15 | **15** |
| Bust | — | **0** |

Note on the last row: one third-party transcription adds the 15 *before* flooring, which would give 6. This product follows the rulebook text (floor first, then +15). A competing app has already shipped an order-of-operations bug, so correctness here is a selling point.

### Round and game flow

- A **Flip 7** ends the round at once. Every player who has not busted still scores the cards in front of them. Only the Flip 7 player gets the +15.
- After each round, check totals. If **at least one player is at 200 or more**, the game ends and the **highest total wins**. It is not "first to cross 200": all players finish the round, then totals are compared.
- If nobody is at 200, the deal passes left and the next round starts.

## 6. Why the calculator can stay simple

Players enter their **final hand**, not the sequence of draws. So the calculator never has to model Swap, Steal, Discard, Flip Four or Just One More. It only needs to know what is in front of the player now.

Consequences for implementation:
- A value 1–13 can appear **at most once** in a hand, except **13**, which can appear twice only if the player holds Lucky 13.
- Unlucky 7 scores as a normal 7. Its only effect on the calculator is a validity check: a hand cannot contain both Unlucky 7 and a normal 7 (that would be a bust).
- At most one ÷2, and at most one of each minus modifier (there is one of each in the deck).
- A hand with more than 7 Number cards cannot happen; the round ends at 7.
- Physical hands are face-up on the table, so players can check each other's cards. What is secret is each player's **running total**, not the cards.

## 7. Rule gaps and the defaults this product uses

| Gap | What the sources say | Default |
|---|---|---|
| Tie at the top with 200+ | Vengeance rulebook and BGA are silent. A Dized FAQ for the *original* Flip 7 says everyone plays another round. | Players who share the highest total are **co-winners**. No tiebreak round (product decision, 2026-10-14). |
| What counts as the "seven" in Flip 7 | RulesPal says seven different Number cards. BGA and others say both 13s (Lucky 13) count toward the seven. | Count **seven Number cards, both 13s included**. Host setup toggle for the strict reading. |
| Floor vs +15 order | Rulebook: floor at the modifier step, then +15. One transcription reverses it. | Floor first, then +15. |
| The Zero via Swap/Steal | No ruling. | Trust the hand the player enters. |
| Losing Lucky 13 while holding two 13s | No ruling. Most likely a bust. | Player enters what is in front of them. A double 13 without Lucky 13 is flagged as a bust with a "check your cards" prompt. |
| Unlucky 7 arriving by Swap/Steal | No ruling. | Same: trust the entered hand. |

## 8. Strategy notes (for flavour, not for the product)

High numbers are common, so they bust you most often. Low numbers are rare and safer. Lucky 13 gives some safety on 13s. Unlucky 7 is a reset. Players stay once they have banked a decent total because Steal, Swap, Discard and Flip Four can still hurt them.

## 9. Sources

- [RulesPal: Flip 7 With a Vengeance rulebook](https://rulespal.com/flip-7-with-a-vengeance/rulebook)
- [Board Game Arena help page](https://en.doc.boardgamearena.com/Gamehelpflipsevenwithavengeance)
- [The Op Games FAQ](https://theop.games/pages/flip-7-wav-faqs)
- [Geeky Hobbies rules summary](https://www.geekyhobbies.com/flip-7-with-a-vengeance-rules/)
- [officialgamerules.org summary](https://officialgamerules.org/game-rules/flip-7-with-a-vengeance-rules/)
- [Opinionated Gamers review](https://opinionatedgamers.com/2026/04/21/dale-yu-review-of-flip-7-with-a-vengeance/)
- [Dized FAQ on ties (original Flip 7)](https://rules.dized.com/game/dPDRM857TU-BFRF7LzGE0g/lApmR_KkSYWdLUeuAJ2lSQ/there-is-a-tie-for-highest-score-greater-than-or-equal-to-200-what-do-we-do)


