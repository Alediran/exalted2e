import { describe, it, expect } from "vitest";
import { computeThaumPool } from "../../module/rolls/thaumaturgy.mjs";

describe("computeThaumPool", () => {
  it("sums attribute + occult + art degree", () => {
    expect(computeThaumPool(3, 2, 1)).toBe(6);
  });

  it("returns 0 for all-zero inputs", () => {
    expect(computeThaumPool(0, 0, 0)).toBe(0);
  });

  it("treats null/undefined values as 0", () => {
    expect(computeThaumPool(null, undefined, 2)).toBe(2);
  });

  it("adds correctly for max values", () => {
    expect(computeThaumPool(5, 5, 3)).toBe(13);
  });
});
