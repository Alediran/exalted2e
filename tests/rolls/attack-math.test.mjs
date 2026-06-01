import { describe, it, expect } from "vitest";
import {
  computeAttackPool,
  computeAimBonus,
  computeHolyUpgrade,
  computeAxiomaticUpgrade,
  computeAttackOutcome
} from "../../module/rolls/attack-math.mjs";

// ── computeAttackPool ────────────────────────────────────────────────
describe("computeAttackPool", () => {
  it("regular weapon: pool = attr + abil + accuracy", () => {
    expect(computeAttackPool({ attrVal: 3, abilVal: 4, accuracy: 2 })).toBe(9);
  });

  it("instant-charm attack: pool = accuracy only (no Dex + Ability)", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 10, isInstantCharm: true
    })).toBe(10);
  });

  it("wound penalty subtracts (negative value reduces pool)", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 2, woundPenalty: -2
    })).toBe(7);
  });

  it("flurry penalty subtracts (positive value reduces pool)", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 2, flurryPenalty: 2
    })).toBe(7);
  });

  it("internal penalty subtracts (positive value reduces pool)", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 2, internalPenalty: 2
    })).toBe(7);
  });

  it("aim bonus adds to the pool", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 2, aimBonus: 3
    })).toBe(12);
  });

  it("range penalty subtracts (positive value reduces pool)", () => {
    expect(computeAttackPool({
      attrVal: 3, abilVal: 4, accuracy: 2, rangePenalty: 2
    })).toBe(7);
  });

  it("range penalty stacks with other penalties", () => {
    // 4+4+1=9, -1 wound, -1 flurry, +2 aim, -2 range → 7
    expect(computeAttackPool({
      attrVal: 4, abilVal: 4, accuracy: 1,
      woundPenalty: -1, flurryPenalty: 1, aimBonus: 2, rangePenalty: 2
    })).toBe(7);
  });

  it("floors at 0 when combined penalties exceed base pool", () => {
    expect(computeAttackPool({
      attrVal: 2, abilVal: 1, accuracy: 0,
      woundPenalty: -4, flurryPenalty: 5
    })).toBe(0);
  });
});

// ── computeAimBonus ──────────────────────────────────────────────────
describe("computeAimBonus", () => {
  it("returns 0 when multiTickAction is missing", () => {
    expect(computeAimBonus({ multiTickAction: null, targetActorId: "T" })).toBe(0);
  });

  it("returns 0 when actionKey is not 'aim'", () => {
    expect(computeAimBonus({
      multiTickAction: {
        actionKey: "charge", state: { targetActorId: "T" }, startTick: 0
      },
      targetActorId: "T",
      currentTick: 2
    })).toBe(0);
  });

  it("returns 0 when aim target does not match current target", () => {
    expect(computeAimBonus({
      multiTickAction: {
        actionKey: "aim", state: { targetActorId: "OTHER" }, startTick: 0
      },
      targetActorId: "T",
      currentTick: 2
    })).toBe(0);
  });

  it("returns elapsed ticks below the cap (mid-cycle)", () => {
    expect(computeAimBonus({
      multiTickAction: {
        actionKey: "aim", state: { targetActorId: "T" }, startTick: 0
      },
      targetActorId: "T",
      currentTick: 2
    })).toBe(2);
  });

  it("elapsed ticks are capped at +3", () => {
    expect(computeAimBonus({
      multiTickAction: {
        actionKey: "aim", state: { targetActorId: "T" }, startTick: 0
      },
      targetActorId: "T",
      currentTick: 10
    })).toBe(3);
  });
});

// ── computeHolyUpgrade ───────────────────────────────────────────────
describe("computeHolyUpgrade", () => {
  it("non-Holy attack leaves damage type unchanged", () => {
    expect(computeHolyUpgrade({
      isHolyAttack: false, targetIsCoD: true, baseDamageType: "lethal"
    })).toEqual({ finalDamageType: "lethal", holyUpgraded: false });
  });

  it("Holy vs non-CoD target leaves damage type unchanged", () => {
    expect(computeHolyUpgrade({
      isHolyAttack: true, targetIsCoD: false, baseDamageType: "bashing"
    })).toEqual({ finalDamageType: "bashing", holyUpgraded: false });
  });

  it("Holy + CoD upgrades lethal to aggravated", () => {
    expect(computeHolyUpgrade({
      isHolyAttack: true, targetIsCoD: true, baseDamageType: "lethal"
    })).toEqual({ finalDamageType: "aggravated", holyUpgraded: true });
  });

  it("Holy + CoD upgrades bashing to aggravated", () => {
    expect(computeHolyUpgrade({
      isHolyAttack: true, targetIsCoD: true, baseDamageType: "bashing"
    })).toEqual({ finalDamageType: "aggravated", holyUpgraded: true });
  });
});

// ── computeAttackOutcome ─────────────────────────────────────────────
describe("computeAttackOutcome", () => {
  // Minimal base: produces a valid hit when combined with a defense of dv < successes
  const baseAttack = {
    successes:                10,
    weaponDamage:             3,
    addStrength:              true,
    strengthValue:            4,
    targetHardness:           0,
    firstExcDice:             0,
    secondExcSuccesses:       0,
    attackerHasThirdExc:      false,
    defenderHasThirdExc:      false,
    defenderFirstExcDice:     0,
    defenderSecondExcSucc:    0,
    isCounterattack:          false,
    defenderHasCounterattack: false
  };

  it("no defense chosen → defenseChosen false, no threshold/hit fields", () => {
    const out = computeAttackOutcome(baseAttack);
    expect(out.defenseChosen).toBe(false);
    expect(out.threshold).toBeUndefined();
    expect(out.hit).toBeUndefined();
  });

  it("hit with positive threshold: rawDamagePool = threshold + weaponDamage + strengthValue", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.threshold).toBe(6);                        // 10 - 4
    expect(out.hit).toBe(true);
    expect(out.rawDamagePool).toBe(6 + 3 + 4);            // threshold + weaponDmg + str
  });

  it("miss when successes <= DV", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      successes: 4,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.threshold).toBe(0);
    expect(out.hit).toBe(false);
    expect(out.rawDamagePool).toBe(0);
  });

  it("perfect defense forces hit=false even with successes > dv", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      defense: { type: "dodge", dv: 4 },
      perfectDefenseCharm: "Seven Shadow Evasion"
    });
    expect(out.perfectDefense).toBe(true);
    expect(out.hit).toBe(false);
    expect(out.rawDamagePool).toBe(0);
  });

  it("hardness stops damage when targetHardness > rawDamagePool", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      weaponDamage:  1,
      addStrength:   false,
      targetHardness: 20,
      defense: { type: "parry", dv: 4 }
    });
    expect(out.hit).toBe(true);
    expect(out.hardnessStops).toBe(true);
  });

  it("addStrength false excludes strengthValue from rawDamagePool", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      addStrength: false,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.rawDamagePool).toBe(6 + 3);                // threshold + weaponDmg, no str
  });

  it("attacker eligible for Third Exc → showAttackerReroll", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      attackerHasThirdExc: true,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.showAttackerReroll).toBe(true);
    expect(out.showDefenderReroll).toBe(false);
    expect(out.showResolution).toBe(false);
  });

  it("attacker ineligible + defender eligible → showDefenderReroll", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      defenderHasThirdExc: true,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.showAttackerReroll).toBe(false);
    expect(out.showDefenderReroll).toBe(true);
  });

  it("both sides ineligible → showResolution immediately", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      defense: { type: "dodge", dv: 4 }
    });
    expect(out.showResolution).toBe(true);
  });

  it("hit + defender has Counterattack → showCounterattack true", () => {
    const out = computeAttackOutcome({
      ...baseAttack,
      defenderHasCounterattack: true,
      defense: { type: "parry", dv: 4 }
    });
    expect(out.showCounterattack).toBe(true);
    expect(out.showRollDamage).toBe(false);               // counterattack blocks damage step
  });
});

describe("computeAttackOutcome — effectiveTargetSoak", () => {
  const baseAttack = {
    successes: 5,
    weaponDamage: 10,
    damageType: "lethal",
    damageTypeLabel: "L",
    addStrength: false,
    strengthValue: 3,
    overwhelming: 1,
    targetSoak: 8,
    targetArmorSoak: 4,
    targetHardness: 0,
    postSoakDamageDice: 0,
    defense: { dv: 3, type: "dodge" },
    soakPiercing: 0,
    ignoresArmor: false,
  };

  it("effectiveTargetSoak equals targetSoak when no piercing", () => {
    const data = computeAttackOutcome({ ...baseAttack });
    expect(data.effectiveTargetSoak).toBe(8);
  });

  it("effectiveTargetSoak is reduced by soakPiercing", () => {
    const data = computeAttackOutcome({ ...baseAttack, soakPiercing: 3 });
    expect(data.effectiveTargetSoak).toBe(5);
  });

  it("effectiveTargetSoak floors at 0 when piercing exceeds soak", () => {
    const data = computeAttackOutcome({ ...baseAttack, soakPiercing: 20 });
    expect(data.effectiveTargetSoak).toBe(0);
  });

  it("ignoresArmor zeroes the armor component", () => {
    const data = computeAttackOutcome({ ...baseAttack, ignoresArmor: true });
    expect(data.effectiveTargetSoak).toBe(4); // 8 - 4 armor = 4 natural
  });

  it("soakPiercing and ignoresArmor stack", () => {
    const data = computeAttackOutcome({ ...baseAttack, soakPiercing: 2, ignoresArmor: true });
    expect(data.effectiveTargetSoak).toBe(2); // 8 - 4 armor - 2 pierce = 2
  });
});

// ── Axiomatic upgrade ─────────────────────────────────────────────────────
describe("computeAxiomaticUpgrade", () => {
  it("upgrades to aggravated when Axiomatic attack hits Creature of the Void", () => {
    const r = computeAxiomaticUpgrade({ isAxiomaticAttack: true, targetIsVoid: true, baseDamageType: "lethal" });
    expect(r.finalDamageType).toBe("aggravated");
    expect(r.axiomaticUpgraded).toBe(true);
  });

  it("no upgrade when attack is not Axiomatic", () => {
    const r = computeAxiomaticUpgrade({ isAxiomaticAttack: false, targetIsVoid: true, baseDamageType: "bashing" });
    expect(r.finalDamageType).toBe("bashing");
    expect(r.axiomaticUpgraded).toBe(false);
  });

  it("no upgrade when target is not a Creature of the Void", () => {
    const r = computeAxiomaticUpgrade({ isAxiomaticAttack: true, targetIsVoid: false, baseDamageType: "lethal" });
    expect(r.finalDamageType).toBe("lethal");
    expect(r.axiomaticUpgraded).toBe(false);
  });

  it("upgrades bashing to aggravated (not just lethal)", () => {
    const r = computeAxiomaticUpgrade({ isAxiomaticAttack: true, targetIsVoid: true, baseDamageType: "bashing" });
    expect(r.finalDamageType).toBe("aggravated");
    expect(r.axiomaticUpgraded).toBe(true);
  });

  it("no-ops when base is already aggravated", () => {
    const r = computeAxiomaticUpgrade({ isAxiomaticAttack: true, targetIsVoid: true, baseDamageType: "aggravated" });
    expect(r.finalDamageType).toBe("aggravated");
    expect(r.axiomaticUpgraded).toBe(true);
  });
});
