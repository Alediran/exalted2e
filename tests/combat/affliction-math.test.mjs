import { describe, it, expect } from "vitest";
import { parseAfflictionDamage, poisonNetDamage } from "../../module/combat/affliction-math.mjs";

describe("parseAfflictionDamage", () => {
  it("reads a leading integer; else 0", () => {
    expect(parseAfflictionDamage("3")).toBe(3);
    expect(parseAfflictionDamage("3 lethal")).toBe(3);
    expect(parseAfflictionDamage("")).toBe(0);
    expect(parseAfflictionDamage("abc")).toBe(0);
    expect(parseAfflictionDamage(undefined)).toBe(0);
  });
});

describe("poisonNetDamage", () => {
  it("subtracts successes, floored at 0", () => {
    expect(poisonNetDamage(5, 2)).toBe(3);
    expect(poisonNetDamage(2, 5)).toBe(0);
    expect(poisonNetDamage(4, 0)).toBe(4);
  });
});
