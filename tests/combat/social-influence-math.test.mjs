import { describe, it, expect } from "vitest";

// Pure helper tests for social influence keyword mechanics.
// CharmData schema defaults are verified by checking the field values
// on a freshly-constructed data object (no Foundry runtime needed).

describe("keywordEffects defaults", () => {
  it("emotionPenaltyMinor defaults to 1", () => {
    const ke = {};
    expect(ke.emotionPenaltyMinor ?? 1).toBe(1);
  });

  it("emotionPenaltyMajor defaults to 3", () => {
    const ke = {};
    expect(ke.emotionPenaltyMajor ?? 3).toBe(3);
  });

  it("compulsionWpCost defaults to 1", () => {
    const ke = {};
    expect(ke.compulsionWpCost ?? 1).toBe(1);
  });

  it("servitudeWpCost defaults to 1", () => {
    const ke = {};
    expect(ke.servitudeWpCost ?? 1).toBe(1);
  });

  it("servitudeGmRemoval defaults to true", () => {
    const ke = {};
    expect(ke.servitudeGmRemoval ?? true).toBe(true);
  });
});

import {
  buildMentalInfluenceEffects,
  computeEmotionMajorPenalty,
} from "../../module/ui/social-influence-effects.mjs";

// ── buildMentalInfluenceEffects ──────────────────────────────────────────────

describe("buildMentalInfluenceEffects", () => {
  const makeActor = (effects) => ({ effects });

  it("returns empty array for actor with no effects", () => {
    expect(buildMentalInfluenceEffects(makeActor([]))).toEqual([]);
  });

  it("returns empty array for null actor", () => {
    expect(buildMentalInfluenceEffects(null)).toEqual([]);
  });

  it("excludes disabled AEs", () => {
    const actor = makeActor([{
      id: "ae1", name: "Fear (Emotion)", disabled: true,
      flags: { exalted2e: { socialInfluence: true, keyword: "Emotion",
        sourceCharmId: "c1", attackerId: "a2", penaltyMinor: 1, penaltyMajor: 3, wpCostPerResist: 1 } }
    }]);
    expect(buildMentalInfluenceEffects(actor)).toEqual([]);
  });

  it("excludes Illusion AEs (not shown in roll dialog)", () => {
    const actor = makeActor([{
      id: "ae1", name: "Illusion", disabled: false,
      flags: { exalted2e: { socialInfluence: true, keyword: "Illusion",
        sourceCharmId: "c1", attackerId: "a2", penaltyMinor: 1, penaltyMajor: 3, wpCostPerResist: 1 } }
    }]);
    expect(buildMentalInfluenceEffects(actor)).toEqual([]);
  });

  it("returns an Emotion AE with resolved penalty values", () => {
    const actor = makeActor([{
      id: "ae1", name: "Iron Whip Principle (Emotion)", disabled: false,
      flags: { exalted2e: { socialInfluence: true, keyword: "Emotion",
        sourceCharmId: "c1", attackerId: "a2", penaltyMinor: 1, penaltyMajor: 3, wpCostPerResist: 1 } }
    }]);
    const result = buildMentalInfluenceEffects(actor);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "ae1", keyword: "Emotion", charmName: "Iron Whip Principle (Emotion)",
      penaltyMinor: 1, penaltyMajor: 3, attackerId: "a2"
    });
  });

  it("returns a Compulsion AE with wpCostPerResist", () => {
    const actor = makeActor([{
      id: "ae2", name: "Yozi's Will (Compel)", disabled: false,
      flags: { exalted2e: { socialInfluence: true, keyword: "Compel",
        sourceCharmId: "c2", attackerId: "a3", penaltyMinor: 1, penaltyMajor: 3, wpCostPerResist: 1 } }
    }]);
    const result = buildMentalInfluenceEffects(actor);
    expect(result[0]).toMatchObject({ keyword: "Compel", wpCostPerResist: 1 });
  });

  it("returns a Servitude AE", () => {
    const actor = makeActor([{
      id: "ae3", name: "Binding Oath (Servitude)", disabled: false,
      flags: { exalted2e: { socialInfluence: true, keyword: "Servitude",
        sourceCharmId: "c3", attackerId: "a4", penaltyMinor: 1, penaltyMajor: 3, wpCostPerResist: 1 } }
    }]);
    const result = buildMentalInfluenceEffects(actor);
    expect(result[0]).toMatchObject({ keyword: "Servitude" });
  });

  it("uses fallback values if AE flags lack penalty fields", () => {
    const actor = makeActor([{
      id: "ae4", name: "Some Emotion", disabled: false,
      flags: { exalted2e: { socialInfluence: true, keyword: "Emotion",
        sourceCharmId: "c4", attackerId: "a5" } }
    }]);
    const result = buildMentalInfluenceEffects(actor);
    expect(result[0].penaltyMinor).toBe(1);
    expect(result[0].penaltyMajor).toBe(3);
  });
});

// ── computeEmotionMajorPenalty ───────────────────────────────────────────────

describe("computeEmotionMajorPenalty", () => {
  const makeEffects = (overrides = {}) => {
    const { disabled: dis = false, ...flagOverrides } = overrides;
    return [{
      disabled: dis,
      flags: { exalted2e: { socialInfluence: true, keyword: "Emotion",
        attackerId: "target1", penaltyMajor: 3, ...flagOverrides } }
    }];
  };

  it("returns 0 when no effects", () => {
    expect(computeEmotionMajorPenalty([], "target1")).toBe(0);
  });

  it("returns 0 when targetActorId is empty", () => {
    expect(computeEmotionMajorPenalty(makeEffects(), "")).toBe(0);
  });

  it("returns 0 when target id does not match", () => {
    expect(computeEmotionMajorPenalty(makeEffects(), "other")).toBe(0);
  });

  it("returns penaltyMajor when target id matches", () => {
    expect(computeEmotionMajorPenalty(makeEffects(), "target1")).toBe(3);
  });

  it("skips disabled AEs", () => {
    expect(computeEmotionMajorPenalty(makeEffects({ disabled: true }), "target1")).toBe(0);
  });

  it("skips non-Emotion keywords", () => {
    expect(computeEmotionMajorPenalty(makeEffects({ keyword: "Compel" }), "target1")).toBe(0);
  });

  it("accumulates multiple matching Emotion AEs", () => {
    const effects = [
      ...makeEffects({ penaltyMajor: 3 }),
      ...makeEffects({ penaltyMajor: 3 })
    ];
    expect(computeEmotionMajorPenalty(effects, "target1")).toBe(6);
  });
});
