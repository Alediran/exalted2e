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

  it("Lunar caste-favored attribute costs n × 3 with confident: true", () => {
    const actor = makeActor({
      exaltType: "lunar",
      attributes: { dexterity: { caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.dexterity.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(6);           // 2 × 3
    expect(result.confident).toBe(true);
  });

  it("Lunar non-caste attribute costs n × 4 with confident: true", () => {
    const actor = makeActor({
      exaltType: "lunar",
      attributes: { wits: { caste: false, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.wits.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(8);           // 2 × 4
    expect(result.confident).toBe(true);
  });

  it("Lunar user-favored attribute costs n × 3 with confident: true", () => {
    const actor = makeActor({
      exaltType: "lunar",
      attributes: { strength: { caste: false, favored: true } }
    });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.strength.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(6);           // 2 × 3
    expect(result.confident).toBe(true);
  });

  it("Alchemical caste-favored attribute costs n × 3 with confident: true", () => {
    const actor = makeActor({
      exaltType: "alchemical",
      attributes: { strength: { caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "field", path: "system.attributes.strength.value", oldValue: 2, newValue: 3
    });
    expect(result.xp).toBe(6);           // 2 × 3
    expect(result.confident).toBe(true);
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

describe("computeXpCost — item pricing (charms)", () => {
  it("Solar caste-favored charm costs 8 XP, confident", () => {
    const actor = makeActor({
      exaltType: "solar", caste: "dawn",
      abilities: { melee: { value: 3, caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "melee", exaltType: "solar", keywords: [] } }
    });
    expect(result.xp).toBe(8);
    expect(result.confident).toBe(true);
  });

  it("Solar non-favored charm costs 10 XP", () => {
    const actor = makeActor({
      exaltType: "solar", caste: "dawn",
      abilities: { occult: { value: 2, caste: false, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "occult", exaltType: "solar", keywords: [] } }
    });
    expect(result.xp).toBe(10);
    expect(result.confident).toBe(true);
  });

  it("Solar Eclipse pays 16 XP for a foreign charm with confident: true", () => {
    const actor = makeActor({
      exaltType: "solar", caste: "eclipse",
      abilities: { performance: { value: 3, caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "performance", exaltType: "lunar", keywords: [] } }
    });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(true);
  });

  it("Solar non-Eclipse (blank caste) pays 16 XP for a foreign charm with confident: false", () => {
    const actor = makeActor({
      exaltType: "solar", caste: "",
      abilities: { performance: { value: 3, caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "performance", exaltType: "lunar", keywords: [] } }
    });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(false);
  });

  it("Solar Dawn (named non-Eclipse caste) does NOT pay the foreign-charm rate", () => {
    const actor = makeActor({ exaltType: "solar", caste: "dawn" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "lunar", keywords: [] } }
    });
    expect(result.xp).not.toBe(16);
  });

  it("Abyssal Moonshadow pays 16 XP for a foreign charm (Lunar) with confident: true", () => {
    const actor = makeActor({ exaltType: "abyssal", caste: "eclipse" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "lunar", keywords: [] } }
    });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(true);
  });

  it("Infernal Fiend pays 16 XP for a Solar charm with confident: true", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "solar", keywords: [] } }
    });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(true);
  });

  it("Infernal Fiend pays 16 XP for an Abyssal charm with confident: true", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "abyssal", keywords: [] } }
    });
    expect(result.xp).toBe(16);
    expect(result.confident).toBe(true);
  });

  it("Infernal Slayer does NOT pay the foreign-charm rate for a Solar charm", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "slayer" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "solar", keywords: [] } }
    });
    expect(result.xp).not.toBe(16);
    expect(result.confident).toBe(false);
  });

  it("Infernal Fiend pays native rate for an Infernal charm", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", name: "Test", system: { ability: "melee", exaltType: "infernal", keywords: [] } }
    });
    expect(result.xp).not.toBe(16);
  });

  it("Lunar caste-favored vs non-favored charm — 10 vs 12", () => {
    const fav = makeActor({
      exaltType: "lunar",
      abilities: { athletics: { value: 3, caste: true } }
    });
    const nonFav = makeActor({
      exaltType: "lunar",
      abilities: { athletics: { value: 3, caste: false, favored: false } }
    });
    expect(computeXpCost(fav, {
      kind: "item",
      item: { type: "charm", system: { ability: "athletics", exaltType: "lunar", keywords: [] } }
    }).xp).toBe(10);
    expect(computeXpCost(nonFav, {
      kind: "item",
      item: { type: "charm", system: { ability: "athletics", exaltType: "lunar", keywords: [] } }
    }).xp).toBe(12);
  });

  it("Terrestrial unfavored MA charm costs 15 XP", () => {
    const actor = makeActor({
      exaltType: "terrestrial",
      abilities: { martialArts: { value: 3, caste: false, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialArts", exaltType: "terrestrial", keywords: [], martialArtsTier: "terrestrial" } }
    });
    expect(result.xp).toBe(15);
  });

  it("Terrestrial Celestial-MA charm flags confident: false", () => {
    const actor = makeActor({
      exaltType: "terrestrial",
      abilities: { martialArts: { value: 3, caste: true } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialArts", exaltType: "terrestrial", keywords: [], martialArtsTier: "celestial" } }
    });
    expect(result.confident).toBe(false);
  });

  it("Alchemical flat charm costs 6 XP; MA charm costs 11 XP", () => {
    const actor = makeActor({ exaltType: "alchemical" });
    const charmRes = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "athletics", exaltType: "alchemical", keywords: [] } }
    });
    const maRes = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialArts", exaltType: "alchemical", keywords: [] } }
    });
    expect(charmRes.xp).toBe(6);
    expect(maRes.xp).toBe(11);
  });
});

describe("computeXpCost — item pricing (spells / knacks / backgrounds)", () => {
  it("_priceSpell: Solar occult-favored 8, non-favored 10", () => {
    const fav = makeActor({
      exaltType: "solar",
      abilities: { occult: { value: 3, caste: true } }
    });
    const nonFav = makeActor({
      exaltType: "solar",
      abilities: { occult: { value: 3, caste: false, favored: false } }
    });
    expect(computeXpCost(fav, {
      kind: "item", item: { type: "spell", system: {} }
    }).xp).toBe(8);
    expect(computeXpCost(nonFav, {
      kind: "item", item: { type: "spell", system: {} }
    }).xp).toBe(10);
  });

  it("_priceKnack: Lunar costs 11, non-Lunar costs 0 with confident: false", () => {
    const lunar  = makeActor({ exaltType: "lunar" });
    const solar  = makeActor({ exaltType: "solar" });
    expect(computeXpCost(lunar, {
      kind: "item", item: { type: "knack", system: {} }
    })).toEqual(expect.objectContaining({ xp: 11, confident: true }));
    const solarRes = computeXpCost(solar, {
      kind: "item", item: { type: "knack", system: {} }
    });
    expect(solarRes.xp).toBe(0);
    expect(solarRes.confident).toBe(false);
  });

  it("_priceBackground: rating 3 costs 9 XP (3 × backgroundFlat=3)", () => {
    const actor = makeActor();
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "background", system: { value: 3 } }
    });
    expect(result.xp).toBe(9);
    expect(result.confident).toBe(true);
  });
});
