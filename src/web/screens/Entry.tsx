import { useEffect, useState } from "preact/hooks";
import type { Command, View } from "../../shared/protocol";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import {
  EMPTY_HAND, cardCount, fromEntry, markBust, preview, toRaw, toggleHalve, toggleLucky, toggleMinus, toggleNumber, toggleSecond,
  type HandState,
} from "../hand";
import { ConfirmDialog, Notice, Screen } from "../ui";

type PlayingView = Extract<View, { phase: "playing" }>;

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const MINUS = [2, 4, 6, 8, 10];

interface Props {
  view: PlayingView;
  send: (cmd: Command) => boolean;
  /** Called after Submit, so the app can show the Waiting screen. */
  onSubmitted: () => void;
}

export function Entry({ view, send, onSubmitted }: Props) {
  const [hand, setHand] = useState<HandState>(() =>
    view.yourEntry ? fromEntry(view.yourEntry) : (loadDraft(view.code, view.round) ?? EMPTY_HAND),
  );
  const [modal, setModal] = useState<"bust" | "clear" | null>(null);
  useEffect(() => saveDraft(view.code, view.round, hand), [hand, view.code, view.round]);

  const count = cardCount(hand);
  const full = count >= 7;
  const { working, label } = preview(hand);
  const has13 = hand.numbers.includes(13);

  const submit = () => {
    // The hand stays on screen, and the draft stays saved, when the phone cannot send now.
    if (!send({ t: "submit", round: view.round, entry: toRaw(hand) })) return;
    clearDraft(view.code, view.round);
    onSubmitted();
  };

  return (
    <Screen>
      <div class="hd">
        <b>Round {view.round}</b>
        <span>Room {view.code}</span>
      </div>
      <div class="sub">
        Your total so far: <b>{view.yourTotal}</b> · private
      </div>

      <h3>
        Number cards{" "}
        <span>
          {count} of 7{count === 7 ? " · Flip 7" : ""}
        </span>
      </h3>
      <div class="grid">
        {NUMBERS.map((n) => {
          const on = hand.numbers.includes(n);
          return (
            <button key={n} class={`tile ${on ? "on" : ""}`} aria-pressed={on} disabled={full && !on} onClick={() => setHand(toggleNumber(hand, n))}>
              {n}
            </button>
          );
        })}
        {!has13 && <div class="lucky dim">Lucky 13</div>}
        {has13 && !hand.lucky13 && (
          <button class="lucky" aria-pressed={false} onClick={() => setHand(toggleLucky(hand))}>
            Lucky 13: off
          </button>
        )}
        {has13 && hand.lucky13 && (
          <>
            <button class="lucky on one" aria-pressed={true} onClick={() => setHand(toggleLucky(hand))}>
              Lucky 13 ✓
            </button>
            <button
              class={`tile ${hand.secondThirteen ? "on" : ""}`}
              aria-pressed={hand.secondThirteen}
              disabled={full && !hand.secondThirteen}
              onClick={() => setHand(toggleSecond(hand))}
            >
              +13
            </button>
          </>
        )}
      </div>

      <h3>Modifiers</h3>
      <div class="mods">
        {MINUS.map((m) => {
          const on = hand.minus.includes(m);
          return (
            <button key={m} class={`tile ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setHand(toggleMinus(hand, m))}>
              −{m}
            </button>
          );
        })}
        <button class={`tile ${hand.halve ? "on" : ""}`} aria-pressed={hand.halve} onClick={() => setHand(toggleHalve(hand))}>
          ÷2
        </button>
      </div>

      <div class="working" aria-live="polite">
        {working}
      </div>
      <p class="note">Drew a number you already hold? That is a bust. Tap I busted.</p>
      <details>
        <summary>What do the special cards do?</summary>
        <p>
          <b>The Zero:</b> a hand with a 0 scores 0, unless it is a Flip 7.
          <br />
          <b>Unlucky 7:</b> scores as a normal 7. Tap 7.
          <br />
          <b>Lucky 13:</b> you may hold two 13s. Turn on the switch.
        </p>
      </details>

      <div class="actions">
        <button class="ghost" onClick={() => setModal("clear")}>
          Clear all
        </button>
        <button class="ghost warn" onClick={() => setModal("bust")}>
          I busted
        </button>
      </div>
      <div class="submit">
        <button class="primary" onClick={submit}>
          {label}
        </button>
      </div>
      <Notice />

      {modal === "bust" && (
        <ConfirmDialog
          title="Mark this round as a bust?"
          body="Your score for this round will be 0."
          confirmLabel="Yes, I busted"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            setHand(markBust(hand));
            setModal(null);
          }}
        />
      )}
      {modal === "clear" && (
        <ConfirmDialog
          title="Clear the whole hand?"
          body="All selected cards and modifiers will be removed."
          confirmLabel="Clear all"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            setHand(EMPTY_HAND);
            setModal(null);
          }}
        />
      )}
    </Screen>
  );
}
