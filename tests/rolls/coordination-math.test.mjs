import { describe, it, expect } from "vitest";
import { coordinationPool, coordinationDifficulty } from "../../module/rolls/coordination-math.mjs";

describe("coordinationPool", () => {
  it("sums charisma + war", () => {
    expect(coordinationPool({ attributes: { charisma: { value: 4 } }, abilities: { war: { value: 3 } } })).toBe(7);
  });
  it("treats missing traits as 0", () => {
    expect(coordinationPool({})).toBe(0);
    expect(coordinationPool(undefined)).toBe(0);
  });
});

describe("coordinationDifficulty", () => {
  it("is floor(participants/2) with a floor of 2 participants", () => {
    expect(coordinationDifficulty(2)).toBe(1);
    expect(coordinationDifficulty(5)).toBe(2);
    expect(coordinationDifficulty(6)).toBe(3);
  });
  it("clamps participants up to 2 (never below)", () => {
    expect(coordinationDifficulty(1)).toBe(1);  // max(2,1)=2 → floor(2/2)=1
    expect(coordinationDifficulty(0)).toBe(1);
  });
});
