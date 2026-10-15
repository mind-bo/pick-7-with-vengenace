import { MAX_NUMBER_CARDS, formatWorking, parseEntry, scoreEntry, type Entry } from "../shared/score";

/** What the Entry screen edits. `toRaw` turns it into the wire entry. */
export interface HandState {
  readonly numbers: readonly number[];
  readonly lucky13: boolean;
  readonly secondThirteen: boolean;
  readonly minus: readonly number[];
  readonly halve: boolean;
  readonly bust: boolean;
}

export const EMPTY_HAND: HandState = { numbers: [], lucky13: false, secondThirteen: false, minus: [], halve: false, bust: false };

export function cardCount(h: HandState): number {
  return h.numbers.length + (h.secondThirteen ? 1 : 0);
}

/** Any change to the hand cancels a bust. */
const edited = (h: HandState, change: Partial<HandState>): HandState => ({ ...h, ...change, bust: false });

export function toggleNumber(h: HandState, n: number): HandState {
  if (h.numbers.includes(n)) {
    const numbers = h.numbers.filter((x) => x !== n);
    return edited(h, n === 13 ? { numbers, lucky13: false, secondThirteen: false } : { numbers });
  }
  if (cardCount(h) >= MAX_NUMBER_CARDS) return h;
  return edited(h, { numbers: [...h.numbers, n].sort((a, b) => a - b) });
}

export function toggleLucky(h: HandState): HandState {
  if (!h.numbers.includes(13)) return h;
  return edited(h, h.lucky13 ? { lucky13: false, secondThirteen: false } : { lucky13: true });
}

export function toggleSecond(h: HandState): HandState {
  if (h.secondThirteen) return edited(h, { secondThirteen: false });
  if (!h.numbers.includes(13) || cardCount(h) >= MAX_NUMBER_CARDS) return h;
  return edited(h, { lucky13: true, secondThirteen: true });
}

export function toggleMinus(h: HandState, m: number): HandState {
  const minus = h.minus.includes(m) ? h.minus.filter((x) => x !== m) : [...h.minus, m].sort((a, b) => a - b);
  return edited(h, { minus });
}

export function toggleHalve(h: HandState): HandState {
  return edited(h, { halve: !h.halve });
}

export function markBust(h: HandState): HandState {
  return { ...h, bust: true };
}

/** The entry as it goes on the wire. The server checks it again with parseEntry. */
export function toRaw(h: HandState): unknown {
  if (h.bust) return { kind: "bust" };
  const { numbers, lucky13, secondThirteen, minus, halve } = h;
  return { kind: "hand", hand: { numbers, lucky13, secondThirteen, minus, halve } };
}

export function fromEntry(e: Entry): HandState {
  if (e.kind === "bust") return { ...EMPTY_HAND, bust: true };
  const { numbers, lucky13, secondThirteen, minus, halve } = e.hand;
  return { numbers, lucky13, secondThirteen, minus, halve, bust: false };
}

export interface Preview {
  score: number;
  working: string;
  label: string;
}

/** The score, the working line and the button text, all from the shared scoring code. */
export function preview(h: HandState): Preview {
  const parsed = parseEntry(toRaw(h));
  if (!parsed.ok) return { score: 0, working: "Check your cards", label: "Submit 0" };
  const result = scoreEntry(parsed.entry);
  const noCards = !h.bust && h.numbers.length === 0;
  return {
    score: result.value,
    working: formatWorking(result),
    label: noCards ? "Submit 0 (no cards)" : `Submit ${result.value}`,
  };
}
