import { describe, it, expect } from "vitest";
import { clampBackgroundRating, lookupBackgroundTableValue } from "../../module/helpers/background-tables.mjs";

describe("clampBackgroundRating", () => {
  it("clamps to 0..5 and coerces", () => {
    expect(clampBackgroundRating(3)).toBe(3);
    expect(clampBackgroundRating(-2)).toBe(0);
    expect(clampBackgroundRating(9)).toBe(5);
    expect(clampBackgroundRating(undefined)).toBe(0);
  });
});

describe("lookupBackgroundTableValue", () => {
  const table = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
  it("looks up by clamped rating; missing → 0", () => {
    expect(lookupBackgroundTableValue(2, table)).toBe(4);
    expect(lookupBackgroundTableValue(9, table)).toBe(10); // clamped to 5
    expect(lookupBackgroundTableValue(2, undefined)).toBe(0);
  });
});
