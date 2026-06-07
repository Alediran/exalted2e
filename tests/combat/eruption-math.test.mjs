import { describe, it, expect } from "vitest";
import { eruptionTotal, canIncrementCategory } from "../../module/combat/eruption-math.mjs";

describe("eruptionTotal", () => {
  it("sums values, flooring negatives at 0", () => {
    expect(eruptionTotal([1, 2, 3])).toBe(6);
    expect(eruptionTotal([2, -5, 4])).toBe(6);   // negative treated as 0
    expect(eruptionTotal([])).toBe(0);
  });
});

describe("canIncrementCategory", () => {
  it("allows a step that stays within [0,5] and total budget", () => {
    expect(canIncrementCategory(2, 1, 3, 5)).toBe(true);   // newVal 3, total 3 < 5
  });
  it("rejects exceeding the per-category cap of 5", () => {
    expect(canIncrementCategory(5, 1, 3, 10)).toBe(false); // newVal 6 > 5
  });
  it("rejects going below 0", () => {
    expect(canIncrementCategory(0, -1, 3, 5)).toBe(false); // newVal -1
  });
  it("rejects an increment once total budget is reached", () => {
    expect(canIncrementCategory(2, 1, 5, 5)).toBe(false);  // step>0 && total>=points
  });
  it("allows a decrement even when budget is reached", () => {
    expect(canIncrementCategory(3, -1, 5, 5)).toBe(true);  // step<0 ignores budget gate
  });
});
