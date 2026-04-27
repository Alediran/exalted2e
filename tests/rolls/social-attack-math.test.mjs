import { describe, it, expect } from "vitest";
import {
  verifyClaims,
  computeStackingMod,
  computeMdvShiftFromApp,
  computeBaseMDV,
  checkNaturalCap,
  computeWpToResist,
  computeMdvExcellencyCaps,
  resolveStep2,
  aggregateAttackerCharms
} from "../../module/rolls/social-attack-math.mjs";
import { makeCharacterSystem, makeNpcSystem, makeIntimacy } from "../_helpers/make-actor.mjs";

// ── verifyClaims ─────────────────────────────────────────────────────
describe("verifyClaims", () => {
  it("verifies claims a character defender supports", () => {
    const defender = {
      type: "character",
      items: [makeIntimacy({ positive: true })],
      system: makeCharacterSystem({
        motivation: "Avenge my family",
        virtues: {
          compassion: { value: 3, current: 3 },
          conviction: { value: 1, current: 1 },
          temperance: { value: 1, current: 1 },
          valor:      { value: 1, current: 1 }
        }
      })
    };
    const result = verifyClaims({
      supportingIntimacy:   true,
      supportingVirtue:     true,
      supportingMotivation: true
    }, defender);
    expect(result.supportingIntimacy).toBe(true);
    expect(result.supportingVirtue).toBe(true);
    expect(result.supportingMotivation).toBe(true);
  });

  it("rejects opposing-intimacy claim when defender has no negative intimacy", () => {
    const defender = {
      type: "character",
      items: [makeIntimacy({ positive: true })],
      system: makeCharacterSystem()
    };
    const result = verifyClaims({ opposingIntimacy: true }, defender);
    expect(result.opposingIntimacy).toBe(false);
  });

  it("rejects virtue/motivation claims for NPC defender", () => {
    const defender = {
      type: "npc",
      items: [],
      system: makeNpcSystem()
    };
    const result = verifyClaims({
      supportingVirtue:     true,
      supportingMotivation: true
    }, defender);
    expect(result.supportingVirtue).toBe(false);
    expect(result.supportingMotivation).toBe(false);
  });

  it("passes immediateThreat through unconditionally", () => {
    const defender = { type: "character", items: [], system: makeCharacterSystem() };
    const result = verifyClaims({ immediateThreat: true }, defender);
    expect(result.immediateThreat).toBe(true);
  });
});

// ── computeStackingMod ───────────────────────────────────────────────
describe("computeStackingMod", () => {
  it("returns 0 when no claims verified", () => {
    expect(computeStackingMod({})).toBe(0);
  });

  it("picks the best supporting (most negative) when only supporting", () => {
    expect(computeStackingMod({
      supportingIntimacy:   true,    // -1
      supportingVirtue:     true,    // -2
      supportingMotivation: true     // -3
    })).toBe(-3);
  });

  it("picks the best opposing (most positive) when only opposing", () => {
    expect(computeStackingMod({
      opposingIntimacy: true,        // +1
      opposingVirtue:   true         // +2
    })).toBe(2);
  });

  it("sums best supporting + best opposing", () => {
    expect(computeStackingMod({
      supportingVirtue:   true,      // -2
      opposingMotivation: true       // +3
    })).toBe(1);
  });

  it("cancels when supporting and opposing are equal magnitude", () => {
    expect(computeStackingMod({
      supportingMotivation: true,    // -3
      opposingMotivation:   true     // +3
    })).toBe(0);
  });

  it("immediateThreat counts in the opposing pool but doesn't double with opposing claims", () => {
    expect(computeStackingMod({
      immediateThreat:    true,      // +3
      opposingIntimacy:   true       // +1
    })).toBe(3);  // max(1, 3), not 1+3
  });
});

// ── computeMdvShiftFromApp ───────────────────────────────────────────
describe("computeMdvShiftFromApp", () => {
  it("attacker prettier reduces defender MDV", () => {
    const attacker = { system: { attributes: { appearance: { value: 5 } } } };
    const defender = { system: { attributes: { appearance: { value: 2 } } } };
    expect(computeMdvShiftFromApp(attacker, defender)).toBe(-3);
  });

  it("defender prettier raises defender MDV", () => {
    const attacker = { system: { attributes: { appearance: { value: 2 } } } };
    const defender = { system: { attributes: { appearance: { value: 5 } } } };
    expect(computeMdvShiftFromApp(attacker, defender)).toBe(3);
  });

  it("clamps to +/- 3", () => {
    const attacker = { system: { attributes: { appearance: { value: 5 } } } };
    const defender = { system: { attributes: { appearance: { value: 1 } } } };
    expect(computeMdvShiftFromApp(attacker, defender)).toBe(-3);  // delta 4 → clamped
  });

  it("returns 0 for equal Appearance", () => {
    const attacker = { system: { attributes: { appearance: { value: 3 } } } };
    const defender = { system: { attributes: { appearance: { value: 3 } } } };
    expect(computeMdvShiftFromApp(attacker, defender)).toBe(0);
  });

  it("treats missing Appearance as 0", () => {
    expect(computeMdvShiftFromApp({}, {})).toBe(0);
  });
});

// ── computeBaseMDV ───────────────────────────────────────────────────
describe("computeBaseMDV", () => {
  it("erode intent reads Parry MDV", () => {
    const defender = { currentParryMDV: 5, currentDodgeMDV: 3 };
    expect(computeBaseMDV("erode", defender)).toBe(5);
  });

  it("build intent reads Dodge MDV", () => {
    const defender = { currentParryMDV: 5, currentDodgeMDV: 3 };
    expect(computeBaseMDV("build", defender)).toBe(3);
  });

  it("compel intent reads Dodge MDV", () => {
    const defender = { currentParryMDV: 5, currentDodgeMDV: 3 };
    expect(computeBaseMDV("compel", defender)).toBe(3);
  });
});

// ── checkNaturalCap ──────────────────────────────────────────────────
describe("checkNaturalCap", () => {
  it("UMI attacks always return false (no natural cap)", () => {
    const defender = {
      flags: { exalted2e: { socialScene: { "attA": { wpDrainedNatural: 5 } } } }
    };
    expect(checkNaturalCap(defender, "attA", true)).toBe(false);
  });

  it("returns false when no scene state exists", () => {
    expect(checkNaturalCap({}, "attA", false)).toBe(false);
  });

  it("returns false when drain is below 2", () => {
    const defender = {
      flags: { exalted2e: { socialScene: { "attA": { wpDrainedNatural: 1 } } } }
    };
    expect(checkNaturalCap(defender, "attA", false)).toBe(false);
  });

  it("returns true when drain reaches 2", () => {
    const defender = {
      flags: { exalted2e: { socialScene: { "attA": { wpDrainedNatural: 2 } } } }
    };
    expect(checkNaturalCap(defender, "attA", false)).toBe(true);
  });

  it("treats per-attacker keys independently", () => {
    const defender = {
      flags: { exalted2e: { socialScene: { "attA": { wpDrainedNatural: 5 } } } }
    };
    expect(checkNaturalCap(defender, "attB", false)).toBe(false);
  });
});

// ── computeWpToResist ────────────────────────────────────────────────
describe("computeWpToResist", () => {
  it("returns 0 on miss regardless of net successes", () => {
    expect(computeWpToResist(10, 5, false, false)).toBe(0);
  });

  it("natural hit with 0 net successes returns 0", () => {
    expect(computeWpToResist(5, 5, false, true)).toBe(0);
  });

  it("natural hit with 3 net successes returns 1", () => {
    expect(computeWpToResist(8, 5, false, true)).toBe(1);
  });

  it("natural hit caps at 5", () => {
    expect(computeWpToResist(20, 5, false, true)).toBe(5);
  });

  it("UMI hit with 0 net successes returns 1 (base cost)", () => {
    expect(computeWpToResist(5, 5, true, true)).toBe(1);
  });

  it("UMI hit with 6 net successes returns 3 (1 + 2)", () => {
    expect(computeWpToResist(11, 5, true, true)).toBe(3);
  });

  it("UMI hit caps at 5 even with very high threshold", () => {
    expect(computeWpToResist(50, 5, true, true)).toBe(5);
  });
});

// ── computeMdvExcellencyCaps ─────────────────────────────────────────
describe("computeMdvExcellencyCaps", () => {
  it("Solar build/compel intent caps at integrity only (Willpower/Essence not excellency-eligible)", () => {
    const defender = {
      type: "character",
      system: makeCharacterSystem({
        exaltType: "solar",
        willpower: { value: 7, max: 7 },
        abilities: { ...makeCharacterSystem().abilities, integrity: {
          value: 4, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    expect(computeMdvExcellencyCaps("build",  defender)).toEqual({ firstExcMax: 4, secondExcMax: 4 });
    expect(computeMdvExcellencyCaps("compel", defender)).toEqual({ firstExcMax: 4, secondExcMax: 4 });
  });

  it("Solar erode intent caps at max(Cha,Man) + presence by default", () => {
    const defender = {
      type: "character",
      system: makeCharacterSystem({
        exaltType: "solar",
        attributes: {
          ...makeCharacterSystem().attributes,
          charisma: { value: 3 }, manipulation: { value: 5 }
        },
        abilities: { ...makeCharacterSystem().abilities, presence: {
          value: 4, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    // bestSocialAttr = max(3,5) = 5; presence = 4; cap = 9
    expect(computeMdvExcellencyCaps("erode", defender)).toEqual({ firstExcMax: 9, secondExcMax: 9 });
  });

  it("Terrestrial folds the best applicable specialty into the cap (build/compel adds Integrity specialty)", () => {
    const defender = {
      type: "character",
      system: makeCharacterSystem({
        exaltType: "terrestrial",
        abilities: { ...makeCharacterSystem().abilities, integrity: {
          value: 3,
          defaultAttribute: "",
          caste: false,
          favored: false,
          specialties: [{ name: "Stoicism", value: 2 }, { name: "Loyalty", value: 1 }]
        } }
      })
    };
    // integrity 3 + best specialty 2 = 5
    expect(computeMdvExcellencyCaps("build",  defender)).toEqual({ firstExcMax: 5, secondExcMax: 5 });
    expect(computeMdvExcellencyCaps("compel", defender)).toEqual({ firstExcMax: 5, secondExcMax: 5 });
  });

  it("Terrestrial erode caps at presence + bestSpecialty (NO attribute)", () => {
    const defender = {
      type: "character",
      system: makeCharacterSystem({
        exaltType: "terrestrial",
        attributes: {
          ...makeCharacterSystem().attributes,
          charisma: { value: 4 }, manipulation: { value: 5 }
        },
        abilities: { ...makeCharacterSystem().abilities, presence: {
          value: 3,
          defaultAttribute: "",
          caste: false,
          favored: false,
          specialties: [{ name: "Intimidation", value: 2 }]
        } }
      })
    };
    // presence 3 + best specialty 2 = 5; attribute (5) is ignored
    expect(computeMdvExcellencyCaps("erode", defender)).toEqual({ firstExcMax: 5, secondExcMax: 5 });
  });

  it("Lunar (attribute-keyed): build/compel cap = 0 (Dodge MDV has no attribute); erode cap = max(Cha,Man)", () => {
    // Dodge MDV = (Willpower + Integrity + Essence) / 2 — no attribute in the
    // formula, so attribute-keyed exalts (Lunar / Alchemical) can't apply
    // Excellencies to it.
    // Parry MDV = (max(Cha,Man) + social ability) / 2 — they can excel only
    // the attribute portion since the ability isn't theirs to add.
    const defender = {
      type: "character",
      system: makeCharacterSystem({
        exaltType: "lunar",
        attributes: {
          ...makeCharacterSystem().attributes,
          stamina: { value: 4 }, charisma: { value: 3 }, manipulation: { value: 5 }
        }
      })
    };
    expect(computeMdvExcellencyCaps("build",  defender)).toEqual({ firstExcMax: 0, secondExcMax: 0 });
    expect(computeMdvExcellencyCaps("compel", defender)).toEqual({ firstExcMax: 0, secondExcMax: 0 });
    expect(computeMdvExcellencyCaps("erode",  defender)).toEqual({ firstExcMax: 5, secondExcMax: 5 });
  });

  it("returns zero caps when defender has no system data", () => {
    expect(computeMdvExcellencyCaps("build",  {})).toEqual({ firstExcMax: 0, secondExcMax: 0 });
    expect(computeMdvExcellencyCaps("compel", { system: {} })).toEqual({ firstExcMax: 0, secondExcMax: 0 });
  });
});

// ── resolveStep2 ────────────────────────────────────────────────────
describe("resolveStep2", () => {
  // Defaults: a hit-bound mundane attack with no Step-2 input.
  const baseArgs = {
    rollSuccesses:           10,
    baseMDV:                  4,
    stackingMod:              0,
    mdvShiftFromApp:          0,
    isUnnatural:              false,
    autoFailedByNaturalCap:   false,
    firstExcDice:             0,
    secondExcSucc:            0,
    activatedKeywords:        new Set()
  };

  it("perfect defense forces hit=false even when rollSuccesses > effectiveMDV", () => {
    const out = resolveStep2({
      ...baseArgs,
      activatedKeywords: new Set(["Perfect Mental Defense"])
    });
    expect(out.perfectDefense).toBe(true);
    expect(out.hit).toBe(false);
  });

  it("perfect defense forces wpToResist=0", () => {
    const out = resolveStep2({
      ...baseArgs,
      activatedKeywords: new Set(["Perfect Mental Defense"])
    });
    expect(out.wpToResist).toBe(0);
  });

  it("motes-resist on UMI hit forces wpToResist=0 and motesResistApplied=true", () => {
    const out = resolveStep2({
      ...baseArgs,
      isUnnatural:        true,
      activatedKeywords:  new Set(["Resist Unnatural Mental Influence"])
    });
    expect(out.motesResistApplied).toBe(true);
    expect(out.hit).toBe(true);                                   // hit still computed
    expect(out.wpToResist).toBe(0);                               // but no WP to spend
  });

  it("motes-resist on natural attack is no-op (motesResistApplied=false)", () => {
    const out = resolveStep2({
      ...baseArgs,
      isUnnatural:        false,
      activatedKeywords:  new Set(["Resist Unnatural Mental Influence"])
    });
    expect(out.motesResistApplied).toBe(false);
    expect(out.wpToResist).toBeGreaterThan(0);                    // normal threshold-success cost
  });

  it("firstExcDice bumps effectiveMDV", () => {
    const out = resolveStep2({ ...baseArgs, firstExcDice: 3 });
    expect(out.effectiveMDV).toBe(7);                             // 4 + 3
  });

  it("secondExcSucc bumps effectiveMDV", () => {
    const out = resolveStep2({ ...baseArgs, secondExcSucc: 2 });
    expect(out.effectiveMDV).toBe(6);                             // 4 + 2
  });

  it("combined Excellency contributions sum into effectiveMDV", () => {
    const out = resolveStep2({ ...baseArgs, firstExcDice: 2, secondExcSucc: 3 });
    expect(out.effectiveMDV).toBe(9);                             // 4 + 2 + 3
  });

  it("autoFailedByNaturalCap forces hit=false even with no perfect defense", () => {
    const out = resolveStep2({ ...baseArgs, autoFailedByNaturalCap: true });
    expect(out.perfectDefense).toBe(false);
    expect(out.hit).toBe(false);
    expect(out.wpToResist).toBe(0);                               // hit=false → wpToResist=0
  });
});

// ── aggregateAttackerCharms ─────────────────────────────────────────
function makeCharm({ id = "c1", name = "Charm", keywords = [], umiCost = 1 } = {}) {
  return { id, name, system: { keywords, umiCost } };
}

describe("aggregateAttackerCharms", () => {
  it("empty array returns empty aggregate", () => {
    expect(aggregateAttackerCharms([])).toEqual({
      keywords: [], umiCostSum: 0, charmIds: [], sourceByKeyword: {}
    });
  });

  it("undefined input is treated as empty", () => {
    expect(aggregateAttackerCharms(undefined)).toEqual({
      keywords: [], umiCostSum: 0, charmIds: [], sourceByKeyword: {}
    });
  });

  it("single UMI charm with cost 3 -> umiCostSum 3 and UMI keyword", () => {
    const out = aggregateAttackerCharms([
      makeCharm({ id: "a", name: "Loom-Snarling Deception", keywords: ["Unnatural Mental Influence"], umiCost: 3 })
    ]);
    expect(out.umiCostSum).toBe(3);
    expect(out.keywords).toContain("Unnatural Mental Influence");
    expect(out.charmIds).toEqual(["a"]);
    expect(out.sourceByKeyword["Unnatural Mental Influence"]).toBe("a");
  });

  it("multiple UMI charms sum their costs", () => {
    const out = aggregateAttackerCharms([
      makeCharm({ id: "a", keywords: ["Unnatural Mental Influence"], umiCost: 2 }),
      makeCharm({ id: "b", keywords: ["Unnatural Mental Influence"], umiCost: 3 })
    ]);
    expect(out.umiCostSum).toBe(5);
  });

  it("collects multiple keywords from a single charm", () => {
    const out = aggregateAttackerCharms([
      makeCharm({ id: "a", name: "HTT", keywords: ["Compel", "Unnatural Mental Influence"], umiCost: 2 })
    ]);
    expect(out.keywords).toEqual(expect.arrayContaining(["Compel", "Unnatural Mental Influence"]));
    expect(out.umiCostSum).toBe(2);
    expect(out.sourceByKeyword.Compel).toBe("a");
    expect(out.sourceByKeyword["Unnatural Mental Influence"]).toBe("a");
  });

  it("sourceByKeyword attributes a keyword to the FIRST charm carrying it", () => {
    const out = aggregateAttackerCharms([
      makeCharm({ id: "a", name: "First Compel",  keywords: ["Compel"] }),
      makeCharm({ id: "b", name: "Second Compel", keywords: ["Compel"] })
    ]);
    expect(out.sourceByKeyword.Compel).toBe("a");
    expect(out.charmIds).toEqual(["a", "b"]);
  });
});
