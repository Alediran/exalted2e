import { describe, it, expect } from "vitest";
import {
  computeHealthGrantBonus,
  computeMotePoolBonus,
  computeWoundReduction,
  aggregateCharmDVBonus,
  isCharmPassivelyActive,
  aggregateExtraActionsMaxFromAEs,
  aggregateSpeedModifierFromAEs,
} from "../../module/rolls/charm-passive-math.mjs";

// ── computeHealthGrantBonus ──────────────────────────────────────────
describe("computeHealthGrantBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeHealthGrantBonus([])).toEqual({ zero: 0, one: 0, two: 0 });
  });
  it("sums options from one charm (Ox-Body style)", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      options: [{ zero: 1, one: 0, two: 2, dying: 0 }]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 2 });
  });
  it("sums multiple charms", () => {
    const items = [
      { system: { healthGrant: { enabled: true, options: [{ zero: 0, one: 0, two: 3, dying: 0 }] }}},
      { system: { healthGrant: { enabled: true, options: [{ zero: 1, one: 0, two: 0, dying: 0 }] }}}
    ];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 3 });
  });
  it("skips disabled charms", () => {
    const items = [{ system: { healthGrant: {
      enabled: false,
      options: [{ zero: 1, one: 1, two: 1, dying: 0 }]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 0, one: 0, two: 0 });
  });
  it("multi-option charm: uses only the selected option (default index 0)", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 0,
      options: [
        { zero: 0, one: 0, two: 2, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 0, one: 0, two: 2 });
  });
  it("multi-option charm: selectedOption 1 picks the second option", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 1,
      options: [
        { zero: 0, one: 0, two: 2, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 0 });
  });
  it("multi-option charm: out-of-bounds selectedOption clamps to last valid index", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 99,
      options: [
        { zero: 0, one: 2, two: 0, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 0 });
  });
});

// ── computeMotePoolBonus ─────────────────────────────────────────────
describe("computeMotePoolBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeMotePoolBonus([])).toEqual({ personal: 0, peripheral: 0 });
  });
  it("adds peripheral bonus", () => {
    const items = [{ system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 0, peripheral: 10 });
  });
  it("adds personal bonus", () => {
    const items = [{ system: { motePoolBonus: { enabled: true, pool: "personal", amount: 5 }}}];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 5, peripheral: 0 });
  });
  it("stacks multiple charms", () => {
    const items = [
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}},
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}
    ];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 0, peripheral: 20 });
  });
});

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

// ── aggregateCharmDVBonus ────────────────────────────────────────────
describe("aggregateCharmDVBonus", () => {
  it("returns zeros when no charms", () => {
    const r = aggregateCharmDVBonus([]);
    expect(r).toEqual({ dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: [] });
  });
  it("sums flat dodge/parry bonuses", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 2, parryBonus: 1, ignoreAllPenalties: false, ignorePenaltyTypes: [] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.dodgeBonus).toBe(2);
    expect(r.parryBonus).toBe(1);
  });
  it("sets ignoreAllPenalties when any charm has it", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: true, ignorePenaltyTypes: [] }}}
    ];
    expect(aggregateCharmDVBonus(items).ignoreAllPenalties).toBe(true);
  });
  it("unions ignorePenaltyTypes across charms", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: ["parryPenalties"] }}},
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: ["environmental"] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.ignorePenaltyTypes).toContain("parryPenalties");
    expect(r.ignorePenaltyTypes).toContain("environmental");
  });
  it("skips disabled charms", () => {
    const items = [
      { system: { dvBonus: { enabled: false, dodgeBonus: 5, parryBonus: 5, ignoreAllPenalties: true, ignorePenaltyTypes: [] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.dodgeBonus).toBe(0);
    expect(r.ignoreAllPenalties).toBe(false);
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
