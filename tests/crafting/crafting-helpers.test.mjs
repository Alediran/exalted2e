import { describe, it, expect } from "vitest";
import {
  craftingPool,
  craftingDifficulty,
  exceedsCraftCap,
  resolveOutcome,
} from "../../module/helpers/crafting-helpers.mjs";

function makeActor({ dex = 3, per = 3, int = 3, craft = 3, specialties = [] } = {}) {
  return {
    system: {
      attributes: {
        dexterity:    { value: dex },
        perception:   { value: per },
        intelligence: { value: int },
      },
      abilities: {
        craft: { value: craft, specialties },
      },
    },
  };
}

function makeProject(overrides = {}) {
  return {
    id:              "test-id",
    name:            "Test Project",
    size:            "small",
    targetResources: 3,
    isPerfect:       false,
    bonusDice:       0,
    status:          "active",
    ...overrides,
  };
}

// ── craftingPool ────────────────────────────────────────────────────────────

describe("craftingPool", () => {
  it("small uses min(dex,per,int) + craft", () => {
    // dex=2, per=3, int=4 → min=2; craft=3 → pool=5
    expect(craftingPool(makeActor({ dex: 2, per: 3, int: 4, craft: 3 }), "small")).toBe(5);
  });

  it("large uses min(per,int) + craft, ignores dex", () => {
    // dex=1 (lowest overall), per=3, int=4 → min(per,int)=3; craft=3 → pool=6
    expect(craftingPool(makeActor({ dex: 1, per: 3, int: 4, craft: 3 }), "large")).toBe(6);
  });

  it("returns correct value when intelligence is the lowest", () => {
    // dex=4, per=4, int=1 → small min=1; craft=3 → pool=4
    expect(craftingPool(makeActor({ dex: 4, per: 4, int: 1, craft: 3 }), "small")).toBe(4);
    // large: min(per=4, int=1)=1; craft=3 → pool=4
    expect(craftingPool(makeActor({ dex: 4, per: 4, int: 1, craft: 3 }), "large")).toBe(4);
  });
});

// ── craftingDifficulty ──────────────────────────────────────────────────────

describe("craftingDifficulty", () => {
  it("returns targetResources for normal project", () => {
    expect(craftingDifficulty(makeProject({ targetResources: 3 }))).toBe(3);
  });

  it("adds 5 for perfect goods", () => {
    expect(craftingDifficulty(makeProject({ targetResources: 2, isPerfect: true }))).toBe(7);
  });
});

// ── exceedsCraftCap ─────────────────────────────────────────────────────────

describe("exceedsCraftCap", () => {
  it("returns false when targetResources <= craft + best specialty", () => {
    const actor = makeActor({ craft: 3, specialties: [{ name: "Weapons", value: 1 }] });
    expect(exceedsCraftCap(actor, 4)).toBe(false); // 4 <= 3+1
  });

  it("returns true when targetResources exceeds craft + best specialty", () => {
    const actor = makeActor({ craft: 3, specialties: [{ name: "Weapons", value: 1 }] });
    expect(exceedsCraftCap(actor, 5)).toBe(true); // 5 > 3+1
  });

  it("treats zero specialties as 0 without crashing", () => {
    const actor = makeActor({ craft: 3, specialties: [] });
    expect(exceedsCraftCap(actor, 3)).toBe(false); // 3 <= 3+0
    expect(exceedsCraftCap(actor, 4)).toBe(true);  // 4 > 3+0
  });

  it("uses best specialty value (not sum)", () => {
    const actor = makeActor({ craft: 2, specialties: [{ name: "Wood", value: 1 }, { name: "Fire", value: 2 }] });
    // best = 2 → cap = 4
    expect(exceedsCraftCap(actor, 4)).toBe(false);
    expect(exceedsCraftCap(actor, 5)).toBe(true);
  });
});

// ── resolveOutcome ──────────────────────────────────────────────────────────

describe("resolveOutcome", () => {
  it("botch returns tier botched with canRetry false", () => {
    const result = resolveOutcome(0, true, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("botched");
    expect(result.finalResources).toBeNull();
    expect(result.canRetry).toBe(false);
  });

  it("threshold < 0 with remaining resources → partial success with reduced Resources", () => {
    // difficulty=3, successes=1 → threshold=-2 → finalResources=3-2=1
    const result = resolveOutcome(1, false, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("partial");
    expect(result.finalResources).toBe(1);
    expect(result.canRetry).toBe(true);
  });

  it("threshold < 0 reducing to below 1 → failed", () => {
    // difficulty=3, successes=0 (no botch, 0 ones) → threshold=-3 → finalResources=0 → failed
    const result = resolveOutcome(0, false, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("failed");
    expect(result.finalResources).toBeNull();
    expect(result.canRetry).toBe(true);
  });

  it("threshold 0–2 → normal success", () => {
    // difficulty=3, successes=4 → threshold=1
    const result = resolveOutcome(4, false, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("success");
    expect(result.finalResources).toBe(3);
    expect(result.canRetry).toBe(false);
  });

  it("threshold 3–4 → fine equipment", () => {
    // difficulty=3, successes=6 → threshold=3
    const result = resolveOutcome(6, false, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("fine");
    expect(result.finalResources).toBe(3);
    expect(result.canRetry).toBe(false);
  });

  it("threshold 5+ → exceptional, Resources +1 capped at 5", () => {
    // difficulty=3, successes=8 → threshold=5 → finalResources=4
    const result = resolveOutcome(8, false, makeProject({ targetResources: 3 }));
    expect(result.tier).toBe("exceptional");
    expect(result.finalResources).toBe(4);
    expect(result.canRetry).toBe(false);
  });

  it("exceptional Resources capped at 5", () => {
    // difficulty=5, successes=10 → threshold=5 → finalResources=6 capped at 5
    const result = resolveOutcome(10, false, makeProject({ targetResources: 5 }));
    expect(result.tier).toBe("exceptional");
    expect(result.finalResources).toBe(5);
  });

  it("isPerfect adds 5 to difficulty", () => {
    // isPerfect=true, targetResources=2 → difficulty=7, successes=4 → threshold=-3 → finalResources=-1 → failed
    const result = resolveOutcome(4, false, makeProject({ targetResources: 2, isPerfect: true }));
    expect(result.tier).toBe("failed");
  });
});
