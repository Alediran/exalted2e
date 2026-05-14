import { describe, it, expect } from "vitest";
import {
  computeWoundReduction,
  isCharmPassivelyActive,
  aggregateExtraActionsMaxFromAEs,
  aggregateSpeedModifierFromAEs,
  getMasteryDiscount,
} from "../../module/rolls/charm-passive-math.mjs";

// ── computeWoundReduction ────────────────────────────────────────────
// The function now takes (bonusReduction: number, baseWoundPenalty: number)
// where bonusReduction is the integer accumulated in system.bonuses.woundPenaltyReduction
// by charmSource AEs during applyActiveEffects.
describe("computeWoundReduction", () => {
  it("returns base penalty unchanged when bonus is 0", () => {
    expect(computeWoundReduction(0, -2)).toBe(-2);
  });
  it("bonus 1 reduces -2 to -1", () => {
    expect(computeWoundReduction(1, -2)).toBe(-1);
  });
  it("bonus 3 reduces -4 to -1", () => {
    expect(computeWoundReduction(3, -4)).toBe(-1);
  });
  it("result is clamped to 0 (never positive)", () => {
    expect(computeWoundReduction(3, -2)).toBe(0);
  });
  it("stacking: multiple reductions accumulate (bonus=2)", () => {
    expect(computeWoundReduction(2, -4)).toBe(-2);
  });
  it("full negation: bonus=4 eliminates -4 penalty", () => {
    expect(computeWoundReduction(4, -4)).toBe(0);
  });
  it("undefined/null bonus is treated as 0", () => {
    expect(computeWoundReduction(undefined, -2)).toBe(-2);
    expect(computeWoundReduction(null, -3)).toBe(-3);
  });
});

// ── isCharmPassivelyActive ───────────────────────────────────────────
describe("isCharmPassivelyActive", () => {
  it("permanent charm is always active", () => {
    expect(isCharmPassivelyActive({ system: { duration: "permanent", active: false } })).toBe(true);
  });
  it("permanent charm is active even when active=false", () => {
    expect(isCharmPassivelyActive({ system: { duration: "permanent", active: false } })).toBe(true);
  });
  it("oneScene charm is active when active=true", () => {
    expect(isCharmPassivelyActive({ system: { duration: "oneScene", active: true } })).toBe(true);
  });
  it("oneScene charm is inactive when active=false", () => {
    expect(isCharmPassivelyActive({ system: { duration: "oneScene", active: false } })).toBe(false);
  });
  it("instant charm with active=false is inactive", () => {
    expect(isCharmPassivelyActive({ system: { duration: "instant", active: false } })).toBe(false);
  });
  it("charmType=permanent is active even when duration defaults to instant", () => {
    expect(isCharmPassivelyActive({ system: { charmType: "permanent", duration: "instant", active: false } })).toBe(true);
  });
  it("undefined item returns false", () => {
    expect(isCharmPassivelyActive(undefined)).toBe(false);
  });
});

// ── aggregateExtraActionsMaxFromAEs ──────────────────────────────────
describe("aggregateExtraActionsMaxFromAEs", () => {
  const makeActor = (aes) => ({ effects: aes });
  const ae = (extraActionsMax) => ({
    disabled: false,
    flags: { exalted2e: { extraActionsMax } }
  });

  it("returns 0 when no AEs", () => {
    expect(aggregateExtraActionsMaxFromAEs(makeActor([]))).toBe(0);
  });

  it("returns the single charm's max", () => {
    expect(aggregateExtraActionsMaxFromAEs(makeActor([ae(2)]))).toBe(2);
  });

  it("takes the maximum across multiple charms, not the sum", () => {
    expect(aggregateExtraActionsMaxFromAEs(makeActor([ae(2), ae(3)]))).toBe(3);
  });

  it("skips disabled AEs", () => {
    const disabledAE = { disabled: true, flags: { exalted2e: { extraActionsMax: 5 } } };
    expect(aggregateExtraActionsMaxFromAEs(makeActor([disabledAE, ae(1)]))).toBe(1);
  });

  it("skips AEs without the flag", () => {
    const unrelated = { disabled: false, flags: { exalted2e: { charmSource: "abc" } } };
    expect(aggregateExtraActionsMaxFromAEs(makeActor([unrelated, ae(2)]))).toBe(2);
  });
});

// ── aggregateSpeedModifierFromAEs ────────────────────────────────────
describe("aggregateSpeedModifierFromAEs", () => {
  const makeActor = (aes) => ({ effects: aes });
  const ae = (delta, minimum = 3) => ({
    disabled: false,
    flags: { exalted2e: { speedModifier: { delta, minimum } } }
  });

  it("returns baseSpeed when no AEs", () => {
    expect(aggregateSpeedModifierFromAEs(makeActor([]), 5)).toBe(5);
  });

  it("applies a flat negative delta", () => {
    expect(aggregateSpeedModifierFromAEs(makeActor([ae(-2)]), 5)).toBe(3);
  });

  it("sums deltas from multiple charms", () => {
    expect(aggregateSpeedModifierFromAEs(makeActor([ae(-1), ae(-1)]), 5)).toBe(3);
  });

  it("clamps at the highest minimum across charms", () => {
    expect(aggregateSpeedModifierFromAEs(makeActor([ae(-5, 3)]), 5)).toBe(3);
  });

  it("skips disabled AEs", () => {
    const disabledAE = { disabled: true, flags: { exalted2e: { speedModifier: { delta: -10, minimum: 1 } } } };
    expect(aggregateSpeedModifierFromAEs(makeActor([disabledAE]), 5)).toBe(5);
  });
});

describe("getMasteryDiscount", () => {
  const makeAE = (ability, commitment) => ({
    disabled: false,
    flags: { exalted2e: { masteryAbility: ability, masteryCommitment: commitment } }
  });
  const makeActor = (aes) => ({ effects: aes });

  it("returns 0 when actor has no effects", () => {
    expect(getMasteryDiscount(makeActor([]), "melee")).toBe(0);
  });

  it("returns 0 when no AE matches the ability", () => {
    expect(getMasteryDiscount(makeActor([makeAE("archery", 6)]), "melee")).toBe(0);
  });

  it("returns floor(commitment/2): 6 motes → discount 3", () => {
    expect(getMasteryDiscount(makeActor([makeAE("melee", 6)]), "melee")).toBe(3);
  });

  it("odd commitment rounds down: 5 motes → discount 2", () => {
    expect(getMasteryDiscount(makeActor([makeAE("melee", 5)]), "melee")).toBe(2);
  });

  it("2 motes → discount 1", () => {
    expect(getMasteryDiscount(makeActor([makeAE("melee", 2)]), "melee")).toBe(1);
  });

  it("0 motes → discount 0 (AE with 0 commitment excluded)", () => {
    expect(getMasteryDiscount(makeActor([makeAE("melee", 0)]), "melee")).toBe(0);
  });

  it("skips disabled AEs", () => {
    const disabled = { disabled: true, flags: { exalted2e: { masteryAbility: "melee", masteryCommitment: 6 } } };
    expect(getMasteryDiscount(makeActor([disabled]), "melee")).toBe(0);
  });

  it("discount applied: 6 committed motes covers 3 First Exc dice (3m raw, net 0)", () => {
    const discount = getMasteryDiscount(makeActor([makeAE("melee", 6)]), "melee");
    const rawCost = 3; // 3 dice × 1m
    expect(Math.max(0, rawCost - discount)).toBe(0);
  });

  it("discount applied: 6 committed motes covers 1 Second Exc success + 1 First Exc die (3m raw, net 0)", () => {
    const discount = getMasteryDiscount(makeActor([makeAE("melee", 6)]), "melee");
    const rawCost = 2 + 1; // 1 success × 2m + 1 die × 1m
    expect(Math.max(0, rawCost - discount)).toBe(0);
  });
});
