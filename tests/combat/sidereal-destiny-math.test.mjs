import { describe, it, expect } from "vitest";
import { prayerBonusDice, destinyEffectPool } from "../../module/combat/sidereal-destiny-math.mjs";

describe("prayerBonusDice", () => {
  it("is ceil(successes / 4)", () => {
    expect(prayerBonusDice(0)).toBe(0);
    expect(prayerBonusDice(1)).toBe(1);
    expect(prayerBonusDice(4)).toBe(1);
    expect(prayerBonusDice(5)).toBe(2);
    expect(prayerBonusDice(8)).toBe(2);
  });
});

describe("destinyEffectPool", () => {
  it("sums essence + college dots + bonus dice", () => {
    expect(destinyEffectPool(3, 2, 1)).toBe(6);
    expect(destinyEffectPool(0, 0, 0)).toBe(0);
  });
});
