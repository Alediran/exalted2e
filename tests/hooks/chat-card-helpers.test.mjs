import { describe, it, expect } from "vitest";
import {
  computeExcellencyKey,
  computeStep2MoteCost,
  buildStep2AutoResolution,
  buildStep2FlagUpdates,
  isActorSentient,
  computeMoteRecoveryAmount,
  scaleTargetEffectByDamage,
} from "../../module/hooks/_chat-card-helpers.mjs";

// ── computeExcellencyKey ──────────────────────────────────────────────────────

describe("computeExcellencyKey", () => {
  it("lunar + erode → manipulation (attribute-based)", () => {
    expect(computeExcellencyKey("lunar", "erode")).toBe("manipulation");
  });

  it("lunar + build → stamina (attribute-based)", () => {
    expect(computeExcellencyKey("lunar", "build")).toBe("stamina");
  });

  it("lunar + compel → stamina (attribute-based, non-erode)", () => {
    expect(computeExcellencyKey("lunar", "compel")).toBe("stamina");
  });

  it("alchemical + erode → manipulation (attribute-based)", () => {
    expect(computeExcellencyKey("alchemical", "erode")).toBe("manipulation");
  });

  it("alchemical + build → stamina (attribute-based)", () => {
    expect(computeExcellencyKey("alchemical", "build")).toBe("stamina");
  });

  it("solar + erode → presence (ability-based)", () => {
    expect(computeExcellencyKey("solar", "erode")).toBe("presence");
  });

  it("solar + build → integrity (ability-based)", () => {
    expect(computeExcellencyKey("solar", "build")).toBe("integrity");
  });

  it("solar + compel → integrity (ability-based, non-erode)", () => {
    expect(computeExcellencyKey("solar", "compel")).toBe("integrity");
  });

  it("unknown exalt type + erode → presence (defaults to ability-based)", () => {
    expect(computeExcellencyKey("", "erode")).toBe("presence");
  });
});

// ── computeStep2MoteCost ──────────────────────────────────────────────────────

describe("computeStep2MoteCost", () => {
  it("first dice cost 1m each, second succ cost 2m each", () => {
    expect(computeStep2MoteCost(3, 2)).toBe(7);
  });

  it("only first excellency dice", () => {
    expect(computeStep2MoteCost(4, 0)).toBe(4);
  });

  it("only second excellency successes", () => {
    expect(computeStep2MoteCost(0, 3)).toBe(6);
  });

  it("both undefined → 0", () => {
    expect(computeStep2MoteCost(undefined, undefined)).toBe(0);
  });

  it("zero spend", () => {
    expect(computeStep2MoteCost(0, 0)).toBe(0);
  });
});

// ── buildStep2AutoResolution ──────────────────────────────────────────────────

describe("buildStep2AutoResolution", () => {
  it("perfectDefense → perfect-defended resolution stub", () => {
    const result = buildStep2AutoResolution({ perfectDefense: true, motesResistApplied: false, hit: false });
    expect(result.outcome).toBe("perfect-defended");
    expect(result.wpSpentByDefender).toBe(0);
    expect(result.erodedIntimacyId).toBeNull();
  });

  it("motesResistApplied + hit → resisted-via-motes stub", () => {
    const result = buildStep2AutoResolution({ perfectDefense: false, motesResistApplied: true, hit: true });
    expect(result.outcome).toBe("resisted-via-motes");
    expect(result.wpSpentByDefender).toBe(0);
  });

  it("motesResistApplied but not hit → null (motes resist only meaningful on hit)", () => {
    const result = buildStep2AutoResolution({ perfectDefense: false, motesResistApplied: true, hit: false });
    expect(result).toBeNull();
  });

  it("neither flag → null (needs manual resolution)", () => {
    const result = buildStep2AutoResolution({ perfectDefense: false, motesResistApplied: false, hit: true });
    expect(result).toBeNull();
  });

  it("perfectDefense takes priority over motesResist", () => {
    const result = buildStep2AutoResolution({ perfectDefense: true, motesResistApplied: true, hit: true });
    expect(result.outcome).toBe("perfect-defended");
  });

  it("resolution stub has all expected keys", () => {
    const result = buildStep2AutoResolution({ perfectDefense: true, motesResistApplied: false, hit: false });
    expect(result).toHaveProperty("outcome");
    expect(result).toHaveProperty("wpSpentByDefender");
    expect(result).toHaveProperty("erodedIntimacyId");
    expect(result).toHaveProperty("erodedIntimacyStrengthBefore");
    expect(result).toHaveProperty("erodedIntimacyStrengthAfter");
    expect(result).toHaveProperty("erodedIntimacyName");
  });
});

// ── buildStep2FlagUpdates ─────────────────────────────────────────────────────

describe("buildStep2FlagUpdates", () => {
  const baseResolved = {
    effectiveMDV: 3, hit: true, wpToResist: 1,
    perfectDefense: false, motesResistApplied: false,
  };
  const baseDialog = { firstExcDice: 2, secondExcSucc: 1, moteType: "peripheral" };

  it("stamps step2Resolved = true", () => {
    const u = buildStep2FlagUpdates({}, baseDialog, baseResolved, [], null);
    expect(u["flags.exalted2e.socialAttack.step2Resolved"]).toBe(true);
  });

  it("clears reversed flag", () => {
    const u = buildStep2FlagUpdates({}, baseDialog, baseResolved, [], null);
    expect(u["flags.exalted2e.socialAttack.reversed"]).toBe(false);
  });

  it("carries resolved effectiveMDV, hit, wpToResist", () => {
    const u = buildStep2FlagUpdates({}, baseDialog, { ...baseResolved, effectiveMDV: 5, hit: false, wpToResist: 0 }, [], null);
    expect(u["flags.exalted2e.socialAttack.effectiveMDV"]).toBe(5);
    expect(u["flags.exalted2e.socialAttack.hit"]).toBe(false);
    expect(u["flags.exalted2e.socialAttack.wpToResist"]).toBe(0);
  });

  it("stores activated charm ids and mote spend", () => {
    const u = buildStep2FlagUpdates({}, baseDialog, baseResolved, ["charm1", "charm2"], { personal: 2 });
    expect(u["flags.exalted2e.socialAttack.defenderCharmIds"]).toEqual(["charm1", "charm2"]);
    expect(u["flags.exalted2e.socialAttack.defenderMoteSpend"]).toEqual({ personal: 2 });
  });

  it("does not include resolution key when auto-resolution is null", () => {
    const u = buildStep2FlagUpdates({}, baseDialog, baseResolved, [], null);
    expect(Object.keys(u)).not.toContain("flags.exalted2e.socialAttack.resolution");
  });

  it("includes resolution key when auto-resolution fires (perfect defense)", () => {
    const perfectResolved = { ...baseResolved, perfectDefense: true };
    const u = buildStep2FlagUpdates({}, baseDialog, perfectResolved, [], null);
    expect(u["flags.exalted2e.socialAttack.resolution"].outcome).toBe("perfect-defended");
  });
});

// ── isActorSentient ───────────────────────────────────────────────────────────

describe("isActorSentient", () => {
  it("character type → always sentient", () => {
    expect(isActorSentient("character", undefined)).toBe(true);
  });

  it("npc type, mortal npcType → sentient", () => {
    expect(isActorSentient("npc", "mortal")).toBe(true);
  });

  it("npc type, beast npcType → not sentient", () => {
    expect(isActorSentient("npc", "beast")).toBe(false);
  });

  it("npc type, undefined npcType → sentient (defaults)", () => {
    expect(isActorSentient("npc", undefined)).toBe(true);
  });

  it("unit type → not sentient", () => {
    expect(isActorSentient("unit", undefined)).toBe(false);
  });

  it("vehicle type → not sentient", () => {
    expect(isActorSentient("vehicle", undefined)).toBe(false);
  });
});

// ── computeMoteRecoveryAmount ─────────────────────────────────────────────────

describe("computeMoteRecoveryAmount", () => {
  it("flat recovery (perDamageLevel=false) ignores rawDamage", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: false, maxRecovery: 20 }, 3, 10)).toBe(3);
  });

  it("perDamageLevel=true multiplies base by rawDamage", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: true, maxRecovery: 20 }, 3, 5)).toBe(15);
  });

  it("caps at maxRecovery", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: true, maxRecovery: 10 }, 3, 10)).toBe(10);
  });

  it("uses default maxRecovery of 20 when absent", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: true }, 3, 10)).toBe(20);
  });

  it("flat recovery capped when over maxRecovery", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: false, maxRecovery: 5 }, 8, 1)).toBe(5);
  });

  it("zero base → zero recovery", () => {
    expect(computeMoteRecoveryAmount({ perDamageLevel: true, maxRecovery: 20 }, 0, 5)).toBe(0);
  });
});

// ── scaleTargetEffectByDamage ─────────────────────────────────────────────────

describe("scaleTargetEffectByDamage", () => {
  it("multiplies internalPenalty.amount by rawDamage", () => {
    const te = { type: "physical", internalPenalty: { amount: -2, type: "physical" } };
    const result = scaleTargetEffectByDamage(te, 3);
    expect(result.internalPenalty.amount).toBe(-6);
  });

  it("uses fallback amount of -1 when internalPenalty is absent", () => {
    const te = { type: "physical" };
    const result = scaleTargetEffectByDamage(te, 4);
    expect(result.internalPenalty.amount).toBe(-4);
  });

  it("does not mutate the original te object", () => {
    const te = { type: "physical", internalPenalty: { amount: -2, type: "physical" } };
    scaleTargetEffectByDamage(te, 3);
    expect(te.internalPenalty.amount).toBe(-2);
  });

  it("preserves other fields from the original te", () => {
    const te = { type: "physical", trigger: "onHit", enabled: true, internalPenalty: { amount: -1, type: "all" } };
    const result = scaleTargetEffectByDamage(te, 2);
    expect(result.trigger).toBe("onHit");
    expect(result.enabled).toBe(true);
    expect(result.type).toBe("physical");
  });

  it("preserves other fields on internalPenalty when scaling", () => {
    const te = { internalPenalty: { amount: -2, type: "physical", stacking: true } };
    const result = scaleTargetEffectByDamage(te, 3);
    expect(result.internalPenalty.type).toBe("physical");
    expect(result.internalPenalty.stacking).toBe(true);
  });
});
