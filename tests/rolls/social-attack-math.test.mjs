import { describe, it, expect } from "vitest";
import {
  verifyClaims,
  computeStackingMod,
  computeMdvShiftFromApp,
  computeBaseMDV,
  checkNaturalCap,
  computeWpToResist
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
