import { describe, it, expect } from "vitest";
import { resolveNewDotValue } from "../../module/helpers/dot-rating.mjs";

describe("resolveNewDotValue", () => {
  it("clicking pip 1 while current is 1 resets to min", () => {
    expect(resolveNewDotValue(1, 1, 0)).toBe(0);
    expect(resolveNewDotValue(1, 1, 2)).toBe(2);
  });
  it("clicking pip 1 while current is not 1 sets max(min,1)", () => {
    expect(resolveNewDotValue(1, 3, 0)).toBe(1);
  });
  it("clicking a higher pip sets that value, floored at min", () => {
    expect(resolveNewDotValue(4, 2, 0)).toBe(4);
    expect(resolveNewDotValue(2, 5, 3)).toBe(3); // max(3,2)
  });
});
