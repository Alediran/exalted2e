import { describe, it, expect } from "vitest";
import { computeXpCost } from "../../module/helpers/xp-costs.mjs";

// makeActor builds a synthetic actor shape with the bits computeXpCost reads.
function makeActor({
  exaltType = "solar",
  caste = "dawn",
  attributes = {},
  abilities = {},
  willpower = { max: 5 },
  experience = { value: 0, total: 0 }
} = {}) {
  return {
    system: { exaltType, caste, attributes, abilities, willpower, experience }
  };
}

describe("computeXpCost — attributes", () => {
  it("Solar attribute 2→3 costs 2 × 4 = 8 (general mult)", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.strength.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(8);                                      // n=2, mult=4
    expect(result.confident).toBe(true);
  });

  it("Solar attribute 1→3 costs 1×4 + 2×4 = 12", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.strength.value", oldValue: 1, newValue: 3
    });
    expect(result.xp).toBe(12);
  });

  it("Lunar attribute increase flags low-confidence (caste data not stored)", () => {
    const actor = makeActor({ exaltType: "lunar" });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.dexterity.value", oldValue: 2, newValue: 3
    });
    expect(result.confident).toBe(false);
  });

  it("attribute decrease costs 0 XP", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.strength.value", oldValue: 3, newValue: 2
    });
    expect(result.xp).toBe(0);
  });
});

describe("computeXpCost — abilities", () => {
  it("buying a new ability (0→1) costs the flat 'new' cost (3 XP)", () => {
    const actor = makeActor({ abilities: { occult: { value: 0, caste: false, favored: false } } });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.abilities.occult.value", oldValue: 0, newValue: 1
    });
    expect(result.xp).toBe(3);                                      // newFlat
  });

  it("Solar caste/favored ability increase uses (n*2 − 1) per dot (1→3 = 1 + 3 = 4)", () => {
    // Solar defaults: abilityFavoredMult=2, abilityFavoredSub=1
    // n=1: 1*2 - 1 = 1; n=2: 2*2 - 1 = 3 → total 4.
    const actor = makeActor({ abilities: { melee: { value: 1, caste: true } } });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.abilities.melee.value", oldValue: 1, newValue: 3
    });
    expect(result.xp).toBe(1 + 3);
  });

  it("Solar non-favored ability increase uses 'other' multiplier (1×2 + 2×2 = 6)", () => {
    const actor = makeActor({ abilities: { melee: { value: 1, caste: false, favored: false } } });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.abilities.melee.value", oldValue: 1, newValue: 3
    });
    expect(result.xp).toBe(2 + 4);                                  // 1*2 + 2*2
  });
});

describe("computeXpCost — virtues / willpower / essence", () => {
  it("Virtue 1→2 costs 1 × 3 = 3 XP", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.virtues.compassion.value", oldValue: 1, newValue: 2
    });
    expect(result.xp).toBe(3);
  });

  it("Willpower 5→6 costs 5 × 2 = 10 XP", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.willpower.max", oldValue: 5, newValue: 6
    });
    expect(result.xp).toBe(10);
  });

  it("Solar Essence 2→3 costs 2 × 8 = 16 XP", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "field", path: "system.essence.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(16);
  });
});

describe("computeXpCost — items", () => {
  it("Solar foreign charm (Lunar) costs the foreignCharm flat fee (16)", () => {
    const actor = makeActor({ caste: "eclipse", exaltType: "solar" });
    const charm = { type: "charm", system: { ability: "melee", exaltType: "lunar" } };
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(true);                            // eclipseLike
  });

  it("Solar→Abyssal charms are NOT 'foreign' (charge native cost)", () => {
    const actor = makeActor({ exaltType: "solar", abilities: { melee: { caste: false, favored: false } } });
    const charm = { type: "charm", system: { ability: "melee", exaltType: "abyssal" } };
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(10);                                     // charmOther, not foreignCharm
  });
});

describe("computeXpCost — graceful failure", () => {
  it("returns 0 with confident=false for null actor", () => {
    expect(computeXpCost(null, { kind: "field", path: "system.essence.value", oldValue: 1, newValue: 2 }))
      .toEqual({ xp: 0, confident: false, description: expect.any(String) });
  });
});
