import { describe, it, expect } from "vitest";
import {
  computeAttackPool,
  computeNetDamage,
  computeRoutDifficulty,
  computeIsRouted,
  computeMagnitudeAfterDamage,
  computeMagnitudeAfterRout
} from "../../module/rolls/mass-combat-math.mjs";

describe("computeAttackPool", () => {
  it("adds commanderWarDice and drill", () => {
    expect(computeAttackPool(2, 3)).toBe(5);
  });
  it("treats null commanderWarDice as 0", () => {
    expect(computeAttackPool(null, 2)).toBe(2);
  });
  it("treats undefined commanderWarDice as 0", () => {
    expect(computeAttackPool(undefined, 4)).toBe(4);
  });
});

describe("computeNetDamage", () => {
  it("returns positive difference when might exceeds endurance", () => {
    expect(computeNetDamage(4, 2)).toBe(2);
  });
  it("returns 0 when endurance equals might", () => {
    expect(computeNetDamage(3, 3)).toBe(0);
  });
  it("returns 0 when endurance exceeds might", () => {
    expect(computeNetDamage(1, 4)).toBe(0);
  });
});

describe("computeRoutDifficulty", () => {
  it("equals netDamage", () => {
    expect(computeRoutDifficulty(3)).toBe(3);
  });
  it("equals 0 when no damage dealt", () => {
    expect(computeRoutDifficulty(0)).toBe(0);
  });
});

describe("computeIsRouted", () => {
  it("true when magnitude is 0", () => {
    expect(computeIsRouted(0)).toBe(true);
  });
  it("false when magnitude is positive", () => {
    expect(computeIsRouted(1)).toBe(false);
    expect(computeIsRouted(5)).toBe(false);
  });
});

describe("computeMagnitudeAfterDamage", () => {
  it("subtracts netDamage from current magnitude", () => {
    expect(computeMagnitudeAfterDamage(5, 2)).toBe(3);
  });
  it("floors at 0 when damage exceeds magnitude", () => {
    expect(computeMagnitudeAfterDamage(1, 3)).toBe(0);
  });
  it("unchanged when netDamage is 0", () => {
    expect(computeMagnitudeAfterDamage(4, 0)).toBe(4);
  });
});

describe("computeMagnitudeAfterRout", () => {
  it("unchanged when unit holds", () => {
    expect(computeMagnitudeAfterRout(3, true)).toBe(3);
  });
  it("decrements by 1 when unit routs", () => {
    expect(computeMagnitudeAfterRout(3, false)).toBe(2);
  });
  it("floors at 0 when rout from magnitude 0", () => {
    expect(computeMagnitudeAfterRout(0, false)).toBe(0);
  });
});
