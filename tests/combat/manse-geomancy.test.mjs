import { describe, it, expect } from "vitest";
import { manseBudgetState, mansePowerEffectiveCost, mansePowerEligible, mansePowerDesignReqs, canDesignPower, manseDamageThreshold, simulateManseDamage } from "../../module/helpers/manse-geomancy.mjs";

describe("manseBudgetState", () => {
  it("base = rating x 2 with no drawbacks", () => {
    const s = manseBudgetState({}, 3);
    expect(s.base).toBe(6);
    expect(s.total).toBe(6);
    expect(s.used).toBe(0);
    expect(s.over).toBe(false);
    expect(s.effectiveHearthstone).toBe(3);
  });

  it("sums drawback points (maint x1, frag x2, habit x1)", () => {
    const s = manseBudgetState({ maintenance: 2, fragility: 1, habitabilityReduction: 1 }, 3);
    expect(s.drawbackPoints).toBe(5);
    expect(s.total).toBe(11);
  });

  it("hearthstone sacrifice points + effective level, clamped", () => {
    const a = manseBudgetState({ hearthstoneReduction: 2 }, 4);
    expect(a.sacrificePoints).toBe(2);
    expect(a.effectiveHearthstone).toBe(2);
    const b = manseBudgetState({ hearthstoneReduction: 6 }, 4);
    expect(b.sacrificePoints).toBe(4);
    expect(b.effectiveHearthstone).toBe(0);
  });

  it("Design Beyond Limit grants +10 only at rating 5", () => {
    expect(manseBudgetState({ designBeyondLimit: true }, 5).dblPoints).toBe(10);
    expect(manseBudgetState({ designBeyondLimit: true }, 4).dblPoints).toBe(0);
  });

  it("used / over from power costs", () => {
    const s = manseBudgetState({ powers: [{ cost: 4 }, { cost: 3 }] }, 3);
    expect(s.used).toBe(7);
    expect(s.total).toBe(6);
    expect(s.over).toBe(true);
  });

  it("flags powers whose cost exceeds rating unless material", () => {
    const s = manseBudgetState({ powers: [{ cost: 4 }, { cost: 4, isMaterial: true }, { cost: 2 }] }, 3);
    expect(s.violations).toEqual([0]);
  });

  it("hearthstoneTooHigh when linked stone exceeds the cap", () => {
    const hi = manseBudgetState({ hearthstoneReduction: 2 }, 5, { linkedHearthstoneRating: 4 });
    expect(hi.effectiveHearthstone).toBe(3);
    expect(hi.hearthstoneTooHigh).toBe(true);
    const ok = manseBudgetState({ hearthstoneReduction: 2 }, 5, { linkedHearthstoneRating: 3 });
    expect(ok.hearthstoneTooHigh).toBe(false);
  });
});

describe("mansePowerEffectiveCost", () => {
  it("applies the aspect-favored discount, floored at 0", () => {
    expect(mansePowerEffectiveCost({ cost: 4, aspectFavored: ["earth"] }, "earth")).toBe(3);
    expect(mansePowerEffectiveCost({ cost: 4, aspectFavored: ["earth"] }, "fire")).toBe(4);
    expect(mansePowerEffectiveCost({ cost: 0, aspectFavored: ["earth"] }, "earth")).toBe(0);
    expect(mansePowerEffectiveCost({ cost: 2 }, "earth")).toBe(2);
  });
});

describe("mansePowerEligible", () => {
  it("only-aspect mismatch is ineligible", () => {
    const r = mansePowerEligible({ cost: 3, onlyAspect: ["fire"] }, { rating: 5, manseAspect: "water" });
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("only-aspect");
  });
  it("over-rating is ineligible unless material", () => {
    expect(mansePowerEligible({ cost: 4 }, { rating: 3, manseAspect: "" }).reasons).toContain("over-rating");
    expect(mansePowerEligible({ cost: 4, isMaterial: true }, { rating: 3, manseAspect: "" }).eligible).toBe(true);
  });
  it("aspect discount can bring a power within the cap", () => {
    const r = mansePowerEligible({ cost: 4, aspectFavored: ["earth"] }, { rating: 3, manseAspect: "earth" });
    expect(r.effectiveCost).toBe(3);
    expect(r.eligible).toBe(true);
  });
  it("clean power is eligible with no reasons", () => {
    const r = mansePowerEligible({ cost: 2 }, { rating: 3, manseAspect: "earth" });
    expect(r.eligible).toBe(true);
    expect(r.reasons).toEqual([]);
  });
});

describe("mansePowerDesignReqs", () => {
  it("prereq = cost+2, difficulty = cost+3", () => {
    expect(mansePowerDesignReqs(2)).toEqual({ prereq: 4, difficulty: 5 });
    expect(mansePowerDesignReqs(0)).toEqual({ prereq: 2, difficulty: 3 });
  });
});

describe("canDesignPower", () => {
  it("requires both Lore and Occult >= cost+2", () => {
    expect(canDesignPower({ lore: 4, occult: 4 }, 2)).toBe(true);
    expect(canDesignPower({ lore: 3, occult: 4 }, 2)).toBe(false);
    expect(canDesignPower({ lore: 4, occult: 3 }, 2)).toBe(false);
    expect(canDesignPower({}, 0)).toBe(false);
  });
});

describe("manseDamageThreshold", () => {
  it("scales by fragility", () => {
    expect(manseDamageThreshold(3, 0)).toBe(60);
    expect(manseDamageThreshold(3, 1)).toBe(30);
    expect(manseDamageThreshold(3, 2)).toBe(15);
    expect(manseDamageThreshold(3, 3)).toBe(1);
  });
});

describe("simulateManseDamage", () => {
  it("accumulates below threshold without failing", () => {
    const r = simulateManseDamage({ rating: 3, fragility: 0 }, 40);
    expect(r.failuresThisEvent).toBe(0);
    expect(r.damage).toBe(40);
    expect(r.powerFailures).toBe(0);
    expect(r.destroyed).toBe(false);
  });
  it("one crossed threshold = one failure, residual carries", () => {
    const r = simulateManseDamage({ rating: 3, fragility: 0 }, 65);
    expect(r.failuresThisEvent).toBe(1);
    expect(r.powerFailures).toBe(1);
    expect(r.damage).toBe(5);
  });
  it("a huge hit cascades to destruction", () => {
    const r = simulateManseDamage({ rating: 3, fragility: 0 }, 200);
    expect(r.powerFailures).toBe(3);
    expect(r.destroyed).toBe(true);
  });
  it("starts from existing failures/damage", () => {
    const r = simulateManseDamage({ rating: 5, powerFailures: 1, damage: 10, fragility: 0 }, 70);
    expect(r.failuresThisEvent).toBe(1);
    expect(r.powerFailures).toBe(2);
    expect(r.damage).toBe(0);
  });
});
