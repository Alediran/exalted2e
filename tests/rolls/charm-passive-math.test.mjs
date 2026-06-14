import { describe, it, expect } from "vitest";
import {
  computeWoundReduction,
  isCharmPassivelyActive,
  aggregateExtraActionsMaxFromAEs,
  aggregateSpeedModifierFromAEs,
  getMasteryDiscount,
  aggregateMoveBonusFromCharms,
  aggregateDVBonusFromCharms,
  aggregateRateBonusFromCharms,
  getAttackSuccessMultiplier,
  getMinimumDamageFromCharms,
  aggregateRawDamageBonusFromCharms,
  getEssenceDrainFromCharms,
  aggregateAbilityDiceBonusFromCharms,
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

describe("aggregateMoveBonusFromCharms", () => {
  const makeActor = (charms) => ({
    items: charms,
    getRollData: () => ({ dex: 3, ess: 2 })
  });

  const makeCharm = (mb, duration = "permanent") => ({
    type: "charm",
    system: {
      duration,
      charmType: "supplemental",
      active: duration !== "permanent",
      moveBonus: mb
    }
  });

  it("returns zero/false defaults when no charms", () => {
    const result = aggregateMoveBonusFromCharms(makeActor([]));
    expect(result).toEqual({ dashBonus: 0, hasFlight: false, hasWaterWalking: false });
  });

  it("sums dashAdd formula from active charms", () => {
    const actor = makeActor([makeCharm({ enabled: true, dashAdd: "2", flight: false, waterWalking: false })]);
    expect(aggregateMoveBonusFromCharms(actor).dashBonus).toBe(2);
  });

  it("resolves @ess token in dashAdd", () => {
    const actor = makeActor([makeCharm({ enabled: true, dashAdd: "@ess", flight: false, waterWalking: false })]);
    expect(aggregateMoveBonusFromCharms(actor).dashBonus).toBe(2);
  });

  it("stacks dashAdd from multiple charms", () => {
    const actor = makeActor([
      makeCharm({ enabled: true, dashAdd: "2", flight: false, waterWalking: false }),
      makeCharm({ enabled: true, dashAdd: "3", flight: false, waterWalking: false }),
    ]);
    expect(aggregateMoveBonusFromCharms(actor).dashBonus).toBe(5);
  });

  it("skips disabled moveBonus", () => {
    const actor = makeActor([makeCharm({ enabled: false, dashAdd: "5", flight: true, waterWalking: true })]);
    const r = aggregateMoveBonusFromCharms(actor);
    expect(r.dashBonus).toBe(0);
    expect(r.hasFlight).toBe(false);
    expect(r.hasWaterWalking).toBe(false);
  });

  it("ORs flight across charms", () => {
    const actor = makeActor([
      makeCharm({ enabled: true, dashAdd: "", flight: false, waterWalking: false }),
      makeCharm({ enabled: true, dashAdd: "", flight: true,  waterWalking: false }),
    ]);
    expect(aggregateMoveBonusFromCharms(actor).hasFlight).toBe(true);
  });

  it("ORs waterWalking across charms", () => {
    const actor = makeActor([makeCharm({ enabled: true, dashAdd: "", flight: false, waterWalking: true })]);
    expect(aggregateMoveBonusFromCharms(actor).hasWaterWalking).toBe(true);
  });

  it("skips non-charm items", () => {
    const actor = makeActor([
      { type: "weapon", system: { moveBonus: { enabled: true, dashAdd: "10", flight: true, waterWalking: true } } }
    ]);
    expect(aggregateMoveBonusFromCharms(actor).dashBonus).toBe(0);
  });
});

describe("aggregateDVBonusFromCharms", () => {
  it("returns zeros when actor has no charms", () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(aggregateDVBonusFromCharms(actor)).toEqual({ dodgeBonus: 0, parryBonus: 0 });
  });

  it("sums flat dodge and parry bonuses across active charms", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: true, dvBonus: { enabled: true, dodgeBonus: 2, parryBonus: 1, dodgeBonusFormula: "", parryBonusFormula: "" } } },
        { type: "charm", system: { active: true, dvBonus: { enabled: true, dodgeBonus: 1, parryBonus: 0, dodgeBonusFormula: "", parryBonusFormula: "" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateDVBonusFromCharms(actor)).toEqual({ dodgeBonus: 3, parryBonus: 1 });
  });

  it("ignores inactive charms", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: false, dvBonus: { enabled: true, dodgeBonus: 3, parryBonus: 2, dodgeBonusFormula: "", parryBonusFormula: "" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateDVBonusFromCharms(actor)).toEqual({ dodgeBonus: 0, parryBonus: 0 });
  });

  it("evaluates formula tokens", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: true, dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, dodgeBonusFormula: "@ess", parryBonusFormula: "" } } },
      ],
      getRollData: () => ({ ess: 3 }),
    };
    expect(aggregateDVBonusFromCharms(actor).dodgeBonus).toBe(3);
  });
});

describe("aggregateRateBonusFromCharms", () => {
  it("returns 0 with no charms", () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(aggregateRateBonusFromCharms(actor)).toBe(0);
  });

  it("sums rate bonus formulas from active charms", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: true, rateBonus: { enabled: true, formula: "1" } } },
        { type: "charm", system: { active: true, rateBonus: { enabled: true, formula: "2" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRateBonusFromCharms(actor)).toBe(3);
  });

  it("ignores disabled rateBonus", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: true, rateBonus: { enabled: false, formula: "1" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRateBonusFromCharms(actor)).toBe(0);
  });

  it("ignores inactive charms", () => {
    const actor = {
      items: [
        { type: "charm", system: { active: false, rateBonus: { enabled: true, formula: "3" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRateBonusFromCharms(actor)).toBe(0);
  });

  it("permanent charms always contribute regardless of active flag", () => {
    const actor = {
      items: [
        { type: "charm", system: { duration: "permanent", active: false, rateBonus: { enabled: true, formula: "2" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRateBonusFromCharms(actor)).toBe(2);
  });

  it("skips non-charm items", () => {
    const actor = {
      items: [
        { type: "weapon", system: { active: true, rateBonus: { enabled: true, formula: "5" } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRateBonusFromCharms(actor)).toBe(0);
  });
});

describe('getAttackSuccessMultiplier', () => {
  it('returns 1 with no active charms', () => {
    const actor = { items: [] };
    expect(getAttackSuccessMultiplier(actor)).toBe(1);
  });

  it('returns highest multiplier across active charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, attackSuccessMultiplier: 2 } },
        { type: 'charm', system: { active: true, attackSuccessMultiplier: 3 } },
      ],
    };
    expect(getAttackSuccessMultiplier(actor)).toBe(3);
  });

  it('returns 1 when all charms have default value of 1', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, attackSuccessMultiplier: 1 } },
      ],
    };
    expect(getAttackSuccessMultiplier(actor)).toBe(1);
  });

  it('ignores inactive charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, attackSuccessMultiplier: 5 } },
      ],
    };
    expect(getAttackSuccessMultiplier(actor)).toBe(1);
  });

  it('returns 1 when charm has no attackSuccessMultiplier field', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true } },
      ],
    };
    expect(getAttackSuccessMultiplier(actor)).toBe(1);
  });

  it('permanent charm contributes regardless of active flag', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, duration: 'permanent', attackSuccessMultiplier: 3 } },
      ],
    };
    expect(getAttackSuccessMultiplier(actor)).toBe(3);
  });
});

describe('getMinimumDamageFromCharms', () => {
  it('returns 0 with no active charms', () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(getMinimumDamageFromCharms(actor)).toBe(0);
  });

  it('returns the highest minimum across active charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, minimumDamage: { enabled: true, formula: '3' } } },
        { type: 'charm', system: { active: true, minimumDamage: { enabled: true, formula: '5' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(5);
  });

  it('ignores disabled minimumDamage', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, minimumDamage: { enabled: false, formula: '10' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(0);
  });

  it('ignores inactive charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, minimumDamage: { enabled: true, formula: '8' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(0);
  });

  it('evaluates formula tokens', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, minimumDamage: { enabled: true, formula: '@ess' } } },
      ],
      getRollData: () => ({ ess: 4 }),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(4);
  });

  it('permanent charm contributes regardless of active flag', () => {
    const actor = {
      items: [
        { type: 'charm', system: { duration: 'permanent', active: false, minimumDamage: { enabled: true, formula: '3' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(3);
  });

  it('returns 0 when enabled but formula is empty', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, minimumDamage: { enabled: true, formula: '' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getMinimumDamageFromCharms(actor)).toBe(0);
  });
});

describe('aggregateRawDamageBonusFromCharms', () => {
  it('returns 0 with no active charms', () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(0);
  });

  it('sums bonus across active charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, rawDamageBonus: { enabled: true, formula: '3' } } },
        { type: 'charm', system: { active: true, rawDamageBonus: { enabled: true, formula: '2' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(5);
  });

  it('ignores disabled rawDamageBonus', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, rawDamageBonus: { enabled: false, formula: '10' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(0);
  });

  it('ignores inactive charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, rawDamageBonus: { enabled: true, formula: '8' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(0);
  });

  it('evaluates formula tokens', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, rawDamageBonus: { enabled: true, formula: '@ess' } } },
      ],
      getRollData: () => ({ ess: 3 }),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(3);
  });

  it('permanent charm contributes regardless of active flag', () => {
    const actor = {
      items: [
        { type: 'charm', system: { duration: 'permanent', active: false, rawDamageBonus: { enabled: true, formula: '4' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(4);
  });

  it('returns 0 when enabled but formula is empty', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, rawDamageBonus: { enabled: true, formula: '' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(0);
  });

  it('skips non-charm items', () => {
    const actor = {
      items: [
        { type: 'weapon', system: { active: true, rawDamageBonus: { enabled: true, formula: '5' } } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateRawDamageBonusFromCharms(actor)).toBe(0);
  });
});

describe('getEssenceDrainFromCharms', () => {
  it('returns null with no active charms', () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(getEssenceDrainFromCharms(actor)).toBeNull();
  });

  it('returns drain config from an active charm', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, essenceDrain: { enabled: true, formula: '@ess', pool: 'peripheral' } } },
      ],
      getRollData: () => ({ ess: 3 }),
    };
    const result = getEssenceDrainFromCharms(actor);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(3);
    expect(result.pool).toBe('peripheral');
  });

  it('ignores disabled essenceDrain', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, essenceDrain: { enabled: false, formula: '5', pool: 'peripheral' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getEssenceDrainFromCharms(actor)).toBeNull();
  });

  it('ignores inactive charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, essenceDrain: { enabled: true, formula: '3', pool: 'peripheral' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getEssenceDrainFromCharms(actor)).toBeNull();
  });

  it('returns first active drain found', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, essenceDrain: { enabled: true, formula: '2', pool: 'peripheral' } } },
        { type: 'charm', system: { active: true, essenceDrain: { enabled: true, formula: '4', pool: 'personal' } } },
      ],
      getRollData: () => ({}),
    };
    const result = getEssenceDrainFromCharms(actor);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(2);
  });

  it('skips non-charm items', () => {
    const actor = {
      items: [
        { type: 'weapon', system: { active: true, essenceDrain: { enabled: true, formula: '5', pool: 'peripheral' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getEssenceDrainFromCharms(actor)).toBeNull();
  });

  it('returns null when formula evaluates to zero or less', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, essenceDrain: { enabled: true, formula: '0', pool: 'peripheral' } } },
      ],
      getRollData: () => ({}),
    };
    expect(getEssenceDrainFromCharms(actor)).toBeNull();
  });

  it('permanent charm contributes regardless of active flag', () => {
    const actor = {
      items: [
        { type: 'charm', system: { duration: 'permanent', active: false, essenceDrain: { enabled: true, formula: '2', pool: 'personal' } } },
      ],
      getRollData: () => ({}),
    };
    const result = getEssenceDrainFromCharms(actor);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(2);
    expect(result.pool).toBe('personal');
  });
});

describe('aggregateAbilityDiceBonusFromCharms', () => {
  it('returns 0 for an ability with no active charms', () => {
    const actor = { items: [], getRollData: () => ({}) };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(0);
  });

  it('sums bonus for the matching ability', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, abilityDiceBonus: [{ ability: 'presence', formula: '3' }] } },
        { type: 'charm', system: { active: true, abilityDiceBonus: [{ ability: 'presence', formula: '2' }] } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(5);
  });

  it('ignores bonus for a different ability', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, abilityDiceBonus: [{ ability: 'socialize', formula: '4' }] } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(0);
  });

  it('ignores inactive charms', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: false, abilityDiceBonus: [{ ability: 'presence', formula: '5' }] } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(0);
  });

  it('evaluates formula tokens', () => {
    const actor = {
      items: [
        { type: 'charm', system: { active: true, abilityDiceBonus: [{ ability: 'presence', formula: '@ess' }] } },
      ],
      getRollData: () => ({ ess: 3 }),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(3);
  });

  it('sums multiple ability entries on one charm', () => {
    const actor = {
      items: [
        {
          type: 'charm',
          system: {
            active: true,
            abilityDiceBonus: [
              { ability: 'presence', formula: '2' },
              { ability: 'presence', formula: '1' },
            ],
          },
        },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(3);
  });

  it('permanent charm contributes regardless of active flag', () => {
    const actor = {
      items: [
        { type: 'charm', system: { duration: 'permanent', active: false, abilityDiceBonus: [{ ability: 'presence', formula: '4' }] } },
      ],
      getRollData: () => ({}),
    };
    expect(aggregateAbilityDiceBonusFromCharms(actor, 'presence')).toBe(4);
  });
});
