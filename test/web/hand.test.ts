import { describe, expect, it } from "vitest";
import { parseEntry } from "../../src/shared/score";
import {
  EMPTY_HAND, cardCount, fromEntry, markBust, preview, toRaw, toggleHalve, toggleLucky, toggleMinus, toggleNumber, toggleSecond,
  type HandState,
} from "../../src/web/hand";

const pick = (h: HandState, ...ns: number[]) => ns.reduce(toggleNumber, h);

describe("number tiles", () => {
  it("HE1: a tap selects and a second tap deselects", () => {
    const on = toggleNumber(EMPTY_HAND, 5);
    expect(on.numbers).toEqual([5]);
    expect(toggleNumber(on, 5).numbers).toEqual([]);
  });

  it("HE2: an eighth card is ignored, and a selected tile can still be deselected at 7", () => {
    const full = pick(EMPTY_HAND, 0, 1, 2, 3, 4, 5, 6);
    expect(cardCount(full)).toBe(7);
    expect(toggleNumber(full, 7)).toBe(full);
    expect(toggleNumber(full, 6).numbers).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("Lucky 13", () => {
  it("HE3: the switch works only while 13 is selected", () => {
    expect(toggleLucky(EMPTY_HAND)).toBe(EMPTY_HAND);
    expect(toggleLucky(pick(EMPTY_HAND, 13)).lucky13).toBe(true);
  });

  it("HE3: a second 13 counts as a card", () => {
    const h = toggleSecond(toggleLucky(pick(EMPTY_HAND, 13, 5)));
    expect(h).toMatchObject({ lucky13: true, secondThirteen: true });
    expect(cardCount(h)).toBe(3);
  });

  it("HE3: a second 13 is refused at 7 cards", () => {
    const h = toggleLucky(pick(EMPTY_HAND, 13, 1, 2, 3, 4, 5, 6));
    expect(cardCount(h)).toBe(7);
    expect(toggleSecond(h).secondThirteen).toBe(false);
  });

  it("HE3: turning the switch off removes the second 13", () => {
    const h = toggleLucky(toggleSecond(toggleLucky(pick(EMPTY_HAND, 13))));
    expect(h).toMatchObject({ lucky13: false, secondThirteen: false });
  });

  it("HE3: deselecting 13 turns the switch off and removes the second 13", () => {
    const h = toggleNumber(toggleSecond(toggleLucky(pick(EMPTY_HAND, 13, 4))), 13);
    expect(h).toMatchObject({ numbers: [4], lucky13: false, secondThirteen: false });
  });
});

describe("modifiers and bust", () => {
  it("HE4: each modifier toggles on and off", () => {
    const on = toggleMinus(EMPTY_HAND, 4);
    expect(on.minus).toEqual([4]);
    expect(toggleMinus(on, 4).minus).toEqual([]);
    expect(toggleHalve(EMPTY_HAND).halve).toBe(true);
    expect(toggleHalve(toggleHalve(EMPTY_HAND)).halve).toBe(false);
  });

  it("HE5: a bust stays until the next edit", () => {
    const b = markBust(pick(EMPTY_HAND, 5));
    expect(b.bust).toBe(true);
    for (const next of [toggleNumber(b, 6), toggleMinus(b, 2), toggleHalve(b)]) expect(next.bust).toBe(false);
  });
});

describe("preview", () => {
  it("HE6 and SB1: the working line and the button show the same score", () => {
    const h = toggleMinus(toggleHalve(pick(EMPTY_HAND, 13, 12, 10)), 4);
    expect(preview(h)).toEqual({ score: 13, working: "13 + 12 + 10 = 35 → ÷2 = 17 → −4 = 13", label: "Submit 13" });
  });

  it("HE6: seven cards ends with the Flip 7 step", () => {
    expect(preview(pick(EMPTY_HAND, 1, 2, 3, 4, 5, 6, 7)).working.endsWith("Flip 7 +15 = 43")).toBe(true);
  });

  it("SB3: an empty hand reads Submit 0 (no cards)", () => {
    expect(preview(EMPTY_HAND)).toMatchObject({ score: 0, label: "Submit 0 (no cards)" });
  });

  it("HE5: a bust reads Bust = 0 and Submit 0", () => {
    expect(preview(markBust(pick(EMPTY_HAND, 5, 6)))).toEqual({ score: 0, working: "Bust = 0", label: "Submit 0" });
  });

  it("an empty hand with modifiers is not called no cards when it holds a card", () => {
    expect(preview(toggleMinus(pick(EMPTY_HAND, 2), 10)).label).toBe("Submit 0");
  });
});

describe("wire format", () => {
  it("toRaw gives an entry that parseEntry accepts, and fromEntry restores the hand", () => {
    const h = toggleMinus(toggleHalve(toggleSecond(toggleLucky(pick(EMPTY_HAND, 13, 0, 5)))), 6);
    const parsed = parseEntry(toRaw(h));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(fromEntry(parsed.entry)).toEqual(h);
  });

  it("a bust round-trips", () => {
    const parsed = parseEntry(toRaw(markBust(EMPTY_HAND)));
    expect(parsed.ok && fromEntry(parsed.entry).bust).toBe(true);
  });

  it("HE2 and HE3: no sequence of taps can build an entry that parseEntry refuses", () => {
    let seed = 12345;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let run = 0; run < 300; run++) {
      let h = EMPTY_HAND;
      for (let step = 0; step < 40; step++) {
        const pickOne = Math.floor(rand() * 6);
        if (pickOne === 0) h = toggleLucky(h);
        else if (pickOne === 1) h = toggleSecond(h);
        else if (pickOne === 2) h = toggleMinus(h, [2, 4, 6, 8, 10][Math.floor(rand() * 5)]!);
        else if (pickOne === 3) h = toggleHalve(h);
        else if (pickOne === 4 && rand() < 0.1) h = markBust(h);
        else h = toggleNumber(h, Math.floor(rand() * 14));
        const r = parseEntry(toRaw(h));
        expect(r.ok, JSON.stringify(h)).toBe(true);
      }
    }
  });
});
