import { describe, expect, it } from "vitest";
import { formatWorking, parseEntry, scoreEntry, type Entry } from "../src/shared/score";

/** Build a raw hand entry as it arrives on the wire. */
function hand(numbers: number[], o: { lucky13?: boolean; secondThirteen?: boolean; minus?: number[]; halve?: boolean } = {}) {
  return {
    kind: "hand",
    hand: { numbers, lucky13: false, secondThirteen: false, minus: [], halve: false, ...o },
  };
}

function entryOf(raw: unknown): Entry {
  const r = parseEntry(raw);
  if (!r.ok) throw new Error("parseEntry refused: " + r.error);
  return r.entry;
}

const score = (raw: unknown) => scoreEntry(entryOf(raw)).value;

describe("scoreEntry", () => {
  it("AC-S03: a minus modifier lowers the sum", () => {
    expect(score(hand([5, 9], { minus: [10] }))).toBe(4);
  });
  it("AC-S04: the score never goes below 0", () => {
    expect(score(hand([2, 3], { minus: [10] }))).toBe(0);
  });

  it("AC-S08: a bust scores 0", () => {
    const s = scoreEntry(entryOf({ kind: "bust" }));
    expect(s.value).toBe(0);
    expect(s.kind).toBe("bust");
  });
  it("AC-S05: The Zero without a Flip 7 scores 0", () => {
    expect(score(hand([0, 4, 9]))).toBe(0);
  });

  it("AC-S06: The Zero inside a Flip 7 scores 21 + 15", () => {
    expect(score(hand([0, 1, 2, 3, 4, 5, 6]))).toBe(36);
  });

  it("AC-S07: the floor applies before the Flip 7 bonus", () => {
    expect(score(hand([0, 1, 2, 3, 4, 5, 6], { minus: [2, 4, 6, 8, 10] }))).toBe(15);
  });

  it("AC-S16: seven cards is kind flip7", () => {
    expect(scoreEntry(entryOf(hand([0, 1, 2, 3, 4, 5, 6]))).kind).toBe("flip7");
  });
  it("AC-S09: ÷2 rounds 3.5 down", () => {
    expect(score(hand([7], { halve: true }))).toBe(3);
  });

  it("AC-S13: ÷2 happens before the minus", () => {
    expect(score(hand([10], { halve: true, minus: [4] }))).toBe(1);
  });

  it("AC-S14: the floor applies after ÷2 and minus", () => {
    expect(score(hand([3], { halve: true, minus: [2] }))).toBe(0);
  });

  it("AC-S15: an empty hand never goes below 0", () => {
    expect(score(hand([], { halve: true, minus: [4] }))).toBe(0);
  });

  it("AC-S02: ÷2 rounds down before the minus", () => {
    expect(score(hand([10, 12, 13], { halve: true, minus: [4] }))).toBe(13);
  });

  it("AC-S12: ÷2 on a Flip 7 with The Zero", () => {
    expect(score(hand([0, 1, 2, 3, 4, 5, 6], { halve: true }))).toBe(25);
  });

  it("AC-S01: the rulebook example", () => {
    expect(score(hand([1, 3, 4, 5, 10, 12, 13], { halve: true, minus: [4] }))).toBe(35);
  });
  it("AC-S10: both 13s score under Lucky 13", () => {
    expect(score(hand([10, 13], { lucky13: true, secondThirteen: true }))).toBe(36);
  });

  it("AC-S11: both 13s count toward the seven", () => {
    const raw = hand([1, 2, 3, 4, 5, 13], { lucky13: true, secondThirteen: true });
    expect(scoreEntry(entryOf(raw))).toMatchObject({ value: 56, kind: "flip7" });
  });

  it("AC-S17: scoring the same entry twice gives the same result", () => {
    const e = entryOf(hand([1, 3, 4, 5, 10, 12, 13], { halve: true, minus: [4] }));
    expect(scoreEntry(e)).toEqual(scoreEntry(e));
  });
});

const errorOf = (raw: unknown) => {
  const r = parseEntry(raw);
  return r.ok ? "OK" : r.error;
};

describe("parseEntry", () => {
  it("AC-V01: eight cards is TOO_MANY_CARDS", () => {
    expect(errorOf(hand([0, 1, 2, 3, 4, 5, 6, 7]))).toBe("TOO_MANY_CARDS");
  });

  it("AC-V02: eight cards with a second 13 is TOO_MANY_CARDS", () => {
    expect(errorOf(hand([0, 1, 2, 3, 4, 5, 13], { lucky13: true, secondThirteen: true }))).toBe("TOO_MANY_CARDS");
  });

  it("AC-V03: a second 13 needs Lucky 13", () => {
    expect(errorOf(hand([5, 13], { secondThirteen: true }))).toBe("SECOND_13_NEEDS_LUCKY");
  });

  it("AC-V04: Lucky 13 needs a 13 in the hand", () => {
    expect(errorOf(hand([5], { lucky13: true }))).toBe("LUCKY_NEEDS_13");
  });

  it.each([14, -1, 2.5])("AC-V05: card value %s is BAD_CARD", (v) => {
    expect(errorOf(hand([v]))).toBe("BAD_CARD");
  });

  it("AC-V06: the same value twice is DUPLICATE_CARD", () => {
    expect(errorOf(hand([5, 5]))).toBe("DUPLICATE_CARD");
  });

  it("AC-V07: a minus value of 3 is BAD_MODIFIER", () => {
    expect(errorOf(hand([5], { minus: [3] }))).toBe("BAD_MODIFIER");
  });

  it("AC-V08: the same minus value twice is DUPLICATE_MODIFIER", () => {
    expect(errorOf(hand([5], { minus: [4, 4] }))).toBe("DUPLICATE_MODIFIER");
  });

  it.each([
    ["a string", "hand"],
    ["null", null],
    ["an unknown kind", { kind: "other" }],
    ["a hand kind with no hand", { kind: "hand" }],
    ["a missing numbers field", { kind: "hand", hand: { lucky13: false, secondThirteen: false, minus: [], halve: false } }],
    ["a non-boolean halve", { kind: "hand", hand: { numbers: [], lucky13: false, secondThirteen: false, minus: [], halve: "yes" } }],
  ])("AC-V09: %s is MALFORMED", (_name, raw) => {
    expect(errorOf(raw)).toBe("MALFORMED");
  });
  it("AC-V10: unsorted cards are stored sorted", () => {
    const e = entryOf(hand([13, 5, 0], { lucky13: true, minus: [10, 2] }));
    expect(e).toMatchObject({ kind: "hand", hand: { numbers: [0, 5, 13], minus: [2, 10] } });
  });

  it("AC-V11: exactly seven cards is valid", () => {
    expect(errorOf(hand([0, 1, 2, 3, 4, 5, 6]))).toBe("OK");
  });

  it("AC-V12: no cards and no modifiers is valid", () => {
    expect(errorOf(hand([]))).toBe("OK");
  });
});

const working = (raw: unknown) => formatWorking(scoreEntry(entryOf(raw)));

describe("formatWorking", () => {
  it("HE6: shows each step", () => {
    expect(working(hand([10, 12, 13], { halve: true, minus: [4] }))).toBe("13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13");
  });

  it("AC-S16: a Flip 7 ends with the bonus step", () => {
    expect(working(hand([0, 1, 2, 3, 4, 5, 6]))).toBe("6 + 5 + 4 + 3 + 2 + 1 + 0 = 21 → Flip 7 +15 = 36");
  });

  it("shows the floor step", () => {
    expect(working(hand([2, 3], { minus: [10] }))).toBe("3 + 2 = 5 → −10 = −5 → floor at 0 = 0");
  });

  it("shows The Zero", () => {
    expect(working(hand([0, 4, 9]))).toBe("9 + 4 + 0 = 13 → The Zero = 0");
  });

  it("shows both 13s", () => {
    expect(working(hand([10, 13], { lucky13: true, secondThirteen: true }))).toBe("13 + 13 + 10 = 36");
  });

  it("shows an empty hand", () => {
    expect(working(hand([], { halve: true, minus: [4] }))).toBe("No cards = 0 → ÷2 = 0 → −4 = −4 → floor at 0 = 0");
  });

  it("shows a bust", () => {
    expect(working({ kind: "bust" })).toBe("Bust = 0");
  });

  it("shows a lone card", () => {
    expect(working(hand([7], { halve: true }))).toBe("7 → ÷2 = 3");
  });

  it("AC-H13: for every scoring vector the working ends in = <score>", () => {
    const vectors: [string, unknown, number][] = [
      ["S01", hand([1, 3, 4, 5, 10, 12, 13], { halve: true, minus: [4] }), 35],
      ["S02", hand([10, 12, 13], { halve: true, minus: [4] }), 13],
      ["S03", hand([5, 9], { minus: [10] }), 4],
      ["S04", hand([2, 3], { minus: [10] }), 0],
      ["S05", hand([0, 4, 9]), 0],
      ["S06", hand([0, 1, 2, 3, 4, 5, 6]), 36],
      ["S07", hand([0, 1, 2, 3, 4, 5, 6], { minus: [2, 4, 6, 8, 10] }), 15],
      ["S08", { kind: "bust" }, 0],
      ["S09", hand([7], { halve: true }), 3],
      ["S10", hand([10, 13], { lucky13: true, secondThirteen: true }), 36],
      ["S11", hand([1, 2, 3, 4, 5, 13], { lucky13: true, secondThirteen: true }), 56],
      ["S12", hand([0, 1, 2, 3, 4, 5, 6], { halve: true }), 25],
      ["S13", hand([10], { halve: true, minus: [4] }), 1],
      ["S14", hand([3], { halve: true, minus: [2] }), 0],
      ["S15", hand([], { halve: true, minus: [4] }), 0],
    ];
    for (const [id, raw, expected] of vectors) {
      expect(working(raw).endsWith("= " + expected), id).toBe(true);
    }
  });
});
