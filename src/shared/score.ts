export const TARGET = 200;
export const MAX_NUMBER_CARDS = 7;
export const FLIP7_BONUS = 15;

export const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export type NumberValue = (typeof NUMBER_VALUES)[number];
export type MinusValue = 2 | 4 | 6 | 8 | 10;

/** Validated, normalized hand. Only parseEntry creates one. */
export interface Hand {
  readonly numbers: readonly NumberValue[]; // unique, sorted ascending; the second 13 is NOT in this list
  readonly lucky13: boolean; // true ⇒ numbers includes 13
  readonly secondThirteen: boolean; // true ⇒ lucky13
  readonly minus: readonly MinusValue[]; // unique, sorted ascending
  readonly halve: boolean;
}
declare const validEntry: unique symbol;
export type Entry = ({ kind: "bust" } | { kind: "hand"; hand: Hand }) & { readonly [validEntry]: true };

export type StepOp = "sum" | "zero" | "halve" | "minus" | "floor" | "flip7" | "bust";
export interface Step {
  op: StepOp;
  before: number;
  after: number;
  detail?: string;
}
export interface RoundScore {
  readonly value: number; // ≥ 0
  readonly kind: "bust" | "flip7" | "normal";
  readonly steps: readonly Step[]; // the working, in order
}

export type EntryError =
  | "MALFORMED"
  | "BAD_CARD"
  | "DUPLICATE_CARD"
  | "TOO_MANY_CARDS"
  | "SECOND_13_NEEDS_LUCKY"
  | "LUCKY_NEEDS_13"
  | "BAD_MODIFIER"
  | "DUPLICATE_MODIFIER";

const MINUS_VALUES: readonly number[] = [2, 4, 6, 8, 10];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const hasDuplicate = (xs: readonly number[]) => new Set(xs).size !== xs.length;
const fail = (error: EntryError) => ({ ok: false, error }) as const;

/** Validate untrusted input and brand the result. The single validator for server and client. */
export function parseEntry(raw: unknown): { ok: true; entry: Entry } | { ok: false; error: EntryError } {
  if (!isRecord(raw)) return fail("MALFORMED");
  if (raw.kind === "bust") return { ok: true, entry: { kind: "bust" } as Entry };
  if (raw.kind !== "hand" || !isRecord(raw.hand)) return fail("MALFORMED");
  const { numbers, lucky13, secondThirteen, minus, halve } = raw.hand;
  if (!Array.isArray(numbers) || !Array.isArray(minus)) return fail("MALFORMED");
  if (typeof lucky13 !== "boolean" || typeof secondThirteen !== "boolean" || typeof halve !== "boolean") {
    return fail("MALFORMED");
  }
  if (!numbers.every((n) => (NUMBER_VALUES as readonly unknown[]).includes(n))) return fail("BAD_CARD");
  if (hasDuplicate(numbers)) return fail("DUPLICATE_CARD");
  if (!minus.every((m) => MINUS_VALUES.includes(m))) return fail("BAD_MODIFIER");
  if (hasDuplicate(minus)) return fail("DUPLICATE_MODIFIER");
  if (secondThirteen && !lucky13) return fail("SECOND_13_NEEDS_LUCKY");
  if (lucky13 && !numbers.includes(13)) return fail("LUCKY_NEEDS_13");
  if (numbers.length + (secondThirteen ? 1 : 0) > MAX_NUMBER_CARDS) return fail("TOO_MANY_CARDS");
  const hand: Hand = {
    numbers: [...numbers].sort((a, b) => a - b),
    lucky13,
    secondThirteen,
    minus: [...minus].sort((a, b) => a - b),
    halve,
  };
  return { ok: true, entry: { kind: "hand", hand } as Entry };
}

/** Score a hand. Rule order is fixed by GAME_CONTEXT §5. */
export function scoreEntry(entry: Entry): RoundScore {
  if (entry.kind === "bust") return { value: 0, kind: "bust", steps: [{ op: "bust", before: 0, after: 0 }] };
  const { hand } = entry;
  const terms: number[] = hand.secondThirteen ? [...hand.numbers, 13] : [...hand.numbers];
  terms.sort((a, b) => b - a);
  const flip7 = terms.length === MAX_NUMBER_CARDS;
  let value = terms.reduce((a, b) => a + b, 0);
  const steps: Step[] = [{ op: "sum", before: 0, after: value, detail: terms.join(" + ") }];
  if (hand.numbers.includes(0) && !flip7) {
    steps.push({ op: "zero", before: value, after: 0 });
    return { value: 0, kind: "normal", steps };
  }
  if (hand.halve) {
    const after = Math.floor(value / 2);
    steps.push({ op: "halve", before: value, after });
    value = after;
  }
  for (const m of hand.minus) {
    steps.push({ op: "minus", before: value, after: value - m, detail: String(m) });
    value -= m;
  }
  if (value < 0) {
    steps.push({ op: "floor", before: value, after: 0 });
    value = 0;
  }
  if (flip7) {
    steps.push({ op: "flip7", before: value, after: value + FLIP7_BONUS });
    value += FLIP7_BONUS;
  }
  return { value, kind: flip7 ? "flip7" : "normal", steps };
}

const signed = (n: number) => (n < 0 ? "−" + -n : String(n));

function formatStep(s: Step): string {
  switch (s.op) {
    case "bust":
      return "Bust = 0";
    case "sum":
      if (s.detail === "") return "No cards = 0";
      return s.detail!.includes("+") ? `${s.detail} = ${s.after}` : s.detail!;
    case "zero":
      return "The Zero = 0";
    case "halve":
      return `÷2 = ${s.after}`;
    case "minus":
      return `−${s.detail} = ${signed(s.after)}`;
    case "floor":
      return "floor at 0 = 0";
    case "flip7":
      return `Flip 7 +${FLIP7_BONUS} = ${s.after}`;
  }
}

/** One line of working, for example "13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13". */
export function formatWorking(score: RoundScore): string {
  return score.steps.map(formatStep).join(" → ");
}
