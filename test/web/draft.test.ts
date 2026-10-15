import { beforeEach, describe, expect, it, vi } from "vitest";
import { backoffMs } from "../../src/web/backoff";
import { clearDraft, loadDraft, saveDraft } from "../../src/web/draft";
import { EMPTY_HAND, toggleHalve, toggleNumber } from "../../src/web/hand";

const hand = toggleHalve(toggleNumber(toggleNumber(EMPTY_HAND, 13), 4));

beforeEach(() => localStorage.clear());

describe("draft", () => {
  it("HE9: a saved draft loads again for the same room and round", () => {
    saveDraft("K7QF", 2, hand);
    expect(loadDraft("K7QF", 2)).toEqual(hand);
  });

  it("AC-H12: a draft for round 2 does not load in round 3", () => {
    saveDraft("K7QF", 2, hand);
    expect(loadDraft("K7QF", 3)).toBeNull();
  });

  it("a draft does not load in another room", () => {
    saveDraft("K7QF", 2, hand);
    expect(loadDraft("ABCD", 2)).toBeNull();
  });

  it("the draft key is p7:draft:<code>:<round>", () => {
    saveDraft("K7QF", 2, hand);
    expect(localStorage.getItem("p7:draft:K7QF:2")).not.toBeNull();
  });

  it("clearDraft removes it", () => {
    saveDraft("K7QF", 2, hand);
    clearDraft("K7QF", 2);
    expect(loadDraft("K7QF", 2)).toBeNull();
  });

  it("damaged or invalid stored data loads as no draft", () => {
    for (const bad of ["{nope", '{"kind":"hand"}', '{"kind":"hand","hand":{"numbers":[99],"lucky13":false,"secondThirteen":false,"minus":[],"halve":false}}']) {
      localStorage.setItem("p7:draft:K7QF:1", bad);
      expect(loadDraft("K7QF", 1), bad).toBeNull();
    }
  });

  it("a storage that throws does not break the page", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    try {
      expect(() => saveDraft("K7QF", 1, hand)).not.toThrow();
      expect(() => clearDraft("K7QF", 1)).not.toThrow();
      expect(loadDraft("K7QF", 1)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("reconnect schedule", () => {
  it("RC2: 1 s, 2 s, 4 s, then every 5 s", () => {
    expect([0, 1, 2, 3, 4, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 5000, 5000, 5000]);
  });
});
