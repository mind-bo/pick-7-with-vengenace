import { describe, expect, it } from "vitest";
import { outcome } from "../src/shared/outcome";

const totals = (...v: number[]) => Object.fromEntries(v.map((t, i) => ["p" + i, t]));

describe("outcome", () => {
  it("AC-E01: 199 is not finished", () => {
    expect(outcome(totals(199, 150, 90)).finished).toBe(false);
  });

  it("AC-E02: 200 finishes the game and wins", () => {
    expect(outcome(totals(200, 150, 90))).toMatchObject({ finished: true, winners: ["p0"] });
  });
  it("AC-E03: the highest total alone wins", () => {
    expect(outcome(totals(230, 215, 190))).toMatchObject({ finished: true, winners: ["p0"] });
  });

  it("AC-E04: equal top totals are co-winners", () => {
    expect(outcome(totals(215, 215, 190))).toMatchObject({ finished: true, winners: ["p0", "p1"] });
  });

  it("AC-E05: a 198 total does not win beside a 205", () => {
    expect(outcome(totals(205, 198, 40))).toMatchObject({ finished: true, winners: ["p0"] });
  });

  it("AC-E06: three equal totals are three winners", () => {
    expect(outcome(totals(250, 250, 250)).winners).toEqual(["p0", "p1", "p2"]);
  });

  it("AC-E07: equal totals share a rank and the next rank skips", () => {
    expect(outcome(totals(215, 215, 190)).ranks).toEqual({ p0: 1, p1: 1, p2: 3 });
  });
});
