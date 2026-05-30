import { describe, it, expect } from "vitest";
import {
  computeXpCost,
  priceAlchemicalCharmSlot,
  priceAlchemicalProtocol,
  priceAstrologicalCollege
} from "../../module/helpers/xp-costs.mjs";

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
    expect(result.confident).toBe(true);
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
      item: { type: "charm", system: { ability: "martialarts", exaltType: "terrestrial", keywords: [], martialArtsTier: "terrestrial" } }
    });
    expect(result.xp).toBe(15);
  });

  it("Terrestrial Celestial-MA charm costs 15 XP (favored) with confident: false", () => {
    const actor = makeActor({
      exaltType: "terrestrial",
      abilities: { martialArts: { value: 3, caste: true } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialarts", exaltType: "terrestrial", keywords: [], martialArtsTier: "celestial" } }
    });
    expect(result.xp).toBe(15);        // ceil(10 * 1.5)
    expect(result.confident).toBe(false);
  });

  it("Terrestrial Celestial-MA charm costs 18 XP (non-favored)", () => {
    const actor = makeActor({
      exaltType: "terrestrial",
      abilities: { martialArts: { value: 3, caste: false, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialarts", exaltType: "terrestrial", keywords: [], martialArtsTier: "celestial" } }
    });
    expect(result.xp).toBe(18);        // ceil(12 * 1.5)
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
      item: { type: "charm", system: { ability: "martialarts", exaltType: "alchemical", keywords: [] } }
    });
    expect(charmRes.xp).toBe(6);
    expect(maRes.xp).toBe(11);
  });

  it("Solar Eclipse buying an MA-style charm (exaltType martialarts) pays native price, not foreign", () => {
    const actor = makeActor({
      exaltType: "solar",
      caste:     "eclipse",
      abilities: { melee: { value: 3, caste: true, favored: false } }
    });
    const result = computeXpCost(actor, {
      kind: "item",
      item: { type: "charm", system: { ability: "martialarts", exaltType: "martialarts", keywords: [], martialArtsTier: "celestial" } }
    });
    expect(result.xp).not.toBe(16);  // 16 = foreign charm price
  });
});

describe("computeXpCost — Infernal charm pricing", () => {
  function makeInfernalActor({ patron = "malfeas", favoredYozi = "" } = {}) {
    return {
      system: {
        exaltType:  "infernal",
        caste:      "slayer",
        abilities:  {},
        attributes: {},
        willpower:  { max: 5 },
        experience: { value: 0, total: 0 },
        splat:      { infernal: { patron, favoredYozi } }
      }
    };
  }
  function makeInfernalCharm({ yoziPatron = "" } = {}) {
    return { type: "charm", system: { ability: "melee", exaltType: "infernal", yoziPatron } };
  }

  it("patron-Yozi charm costs 8 XP with confident:true", () => {
    const actor = makeInfernalActor({ patron: "malfeas" });
    const charm = makeInfernalCharm({ yoziPatron: "malfeas" });
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(8);
    expect(result.confident).toBe(true);
  });
  it("favored-Yozi charm costs 8 XP with confident:true", () => {
    const actor = makeInfernalActor({ patron: "malfeas", favoredYozi: "adorjan" });
    const charm = makeInfernalCharm({ yoziPatron: "adorjan" });
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(8);
    expect(result.confident).toBe(true);
  });
  it("non-patron non-favored Yozi charm costs 10 XP", () => {
    const actor = makeInfernalActor({ patron: "malfeas", favoredYozi: "adorjan" });
    const charm = makeInfernalCharm({ yoziPatron: "cecelyne" });
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(10);
    expect(result.confident).toBe(true);
  });
  it("blank yoziPatron charm costs 10 XP (conservative fallback)", () => {
    const actor = makeInfernalActor({ patron: "malfeas", favoredYozi: "adorjan" });
    const charm = makeInfernalCharm({ yoziPatron: "" });
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(10);
    expect(result.confident).toBe(true);
  });
  it("heretical charm with patron Yozi costs 9 XP (not 8)", () => {
    const actor = makeInfernalActor({ patron: "malfeas" });
    const charm = {
      type: "charm",
      system: { ability: "melee", exaltType: "infernal", yoziPatron: "malfeas", keywords: ["heretical"] }
    };
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(9);
    expect(result.confident).toBe(true);
  });
  it("heretical charm with non-patron Yozi costs 9 XP (not 10)", () => {
    const actor = makeInfernalActor({ patron: "malfeas" });
    const charm = {
      type: "charm",
      system: { ability: "melee", exaltType: "infernal", yoziPatron: "cecelyne", keywords: ["heretical"] }
    };
    const result = computeXpCost(actor, { kind: "item", item: charm });
    expect(result.xp).toBe(9);
    expect(result.confident).toBe(true);
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

describe("priceAlchemicalCharmSlot", () => {
  it("general slot costs 6 XP", () => {
    expect(priceAlchemicalCharmSlot("general")).toEqual({ xp: 6, confident: true });
  });

  it("dedicated slot costs 4 XP", () => {
    expect(priceAlchemicalCharmSlot("dedicated")).toEqual({ xp: 4, confident: true });
  });

  it("upgrade slot costs 2 XP", () => {
    expect(priceAlchemicalCharmSlot("upgrade")).toEqual({ xp: 2, confident: true });
  });

  it("unknown grade returns 0 XP with confident: false", () => {
    expect(priceAlchemicalCharmSlot("unknown")).toEqual({ xp: 0, confident: false });
  });

  it("null / undefined grade returns 0 XP with confident: false", () => {
    expect(priceAlchemicalCharmSlot(null)).toEqual({ xp: 0, confident: false });
    expect(priceAlchemicalCharmSlot(undefined)).toEqual({ xp: 0, confident: false });
  });

  it("grade matching is case-insensitive", () => {
    expect(priceAlchemicalCharmSlot("GENERAL")).toEqual({ xp: 6, confident: true });
    expect(priceAlchemicalCharmSlot("Dedicated")).toEqual({ xp: 4, confident: true });
  });
});

describe("priceAlchemicalProtocol", () => {
  it("manmachine protocol costs 3 XP", () => {
    expect(priceAlchemicalProtocol("manmachine")).toEqual({ xp: 3, confident: true });
  });

  it("godmachine protocol costs 6 XP", () => {
    expect(priceAlchemicalProtocol("godmachine")).toEqual({ xp: 6, confident: true });
  });

  it("unknown kind returns 0 XP with confident: false", () => {
    expect(priceAlchemicalProtocol("unknown")).toEqual({ xp: 0, confident: false });
  });

  it("null / undefined returns 0 XP with confident: false", () => {
    expect(priceAlchemicalProtocol(null)).toEqual({ xp: 0, confident: false });
  });

  it("kind matching is case-insensitive", () => {
    expect(priceAlchemicalProtocol("ManMachine")).toEqual({ xp: 3, confident: true });
    expect(priceAlchemicalProtocol("GODMACHINE")).toEqual({ xp: 6, confident: true });
  });
});

describe("priceAstrologicalCollege", () => {
  it("brand-new college (0→1): charges collegeNew fee (5 XP)", () => {
    expect(priceAstrologicalCollege({ oldRating: 0, newRating: 1 })).toEqual({ xp: 5, confident: true });
  });

  it("brand-new college (0→2): collegeNew(5) for dot 1 + 1×3=3 for dot 2 = 8 XP", () => {
    expect(priceAstrologicalCollege({ oldRating: 0, newRating: 2 })).toEqual({ xp: 8, confident: true });
  });

  it("brand-new college (0→3): 5 + 1×3 + 2×3 = 14 XP", () => {
    expect(priceAstrologicalCollege({ oldRating: 0, newRating: 3 })).toEqual({ xp: 14, confident: true });
  });

  it("existing college (1→2): 1×3 = 3 XP (per-dot only, no new fee)", () => {
    expect(priceAstrologicalCollege({ oldRating: 1, newRating: 2 })).toEqual({ xp: 3, confident: true });
  });

  it("existing college (2→3): 2×3 = 6 XP", () => {
    expect(priceAstrologicalCollege({ oldRating: 2, newRating: 3 })).toEqual({ xp: 6, confident: true });
  });

  it("newRating <= oldRating returns 0 XP", () => {
    expect(priceAstrologicalCollege({ oldRating: 3, newRating: 3 })).toEqual({ xp: 0, confident: true });
    expect(priceAstrologicalCollege({ oldRating: 3, newRating: 1 })).toEqual({ xp: 0, confident: true });
  });

  it("defaults: oldRating=0, newRating=1 when called with no args", () => {
    expect(priceAstrologicalCollege()).toEqual({ xp: 5, confident: true });
  });
});

// ── Craft variant XP pricing ──────────────────────────────────────────────
describe("computeXpCost — craft variants", () => {
  function makeCraftActor({ casteFav = false } = {}) {
    return makeActor({
      abilities: {
        craft: { value: 3, caste: casteFav, favored: false, specialties: [], name: "", variants: [] }
      }
    });
  }

  it("variant 0→1 costs 3 (newFlat) for non-favored solar", () => {
    const actor = makeCraftActor({ casteFav: false });
    const result = computeXpCost(actor, {
      kind: "field",
      path: "system.abilities.craft.variants.0.value",
      oldValue: 0,
      newValue: 1,
    });
    expect(result.xp).toBe(3);
    expect(result.confident).toBe(true);
  });

  it("variant 1→3 costs 1×2 + 2×2 = 6 for non-favored solar", () => {
    const actor = makeCraftActor({ casteFav: false });
    const result = computeXpCost(actor, {
      kind: "field",
      path: "system.abilities.craft.variants.0.value",
      oldValue: 1,
      newValue: 3,
    });
    expect(result.xp).toBe(6);
    expect(result.confident).toBe(true);
  });

  it("variant 1→2 costs 1×1 = 1 when Craft is caste/favored (solar)", () => {
    const actor = makeCraftActor({ casteFav: true });
    const result = computeXpCost(actor, {
      kind: "field",
      path: "system.abilities.craft.variants.0.value",
      oldValue: 1,
      newValue: 2,
    });
    expect(result.xp).toBe(1);
    expect(result.confident).toBe(true);
  });

  it("variant 2→2 (no increase) costs 0", () => {
    const actor = makeCraftActor();
    const result = computeXpCost(actor, {
      kind: "field",
      path: "system.abilities.craft.variants.0.value",
      oldValue: 2,
      newValue: 2,
    });
    expect(result.xp).toBe(0);
  });

  it("uses a different array index without affecting pricing", () => {
    const actor = makeCraftActor({ casteFav: false });
    const result = computeXpCost(actor, {
      kind: "field",
      path: "system.abilities.craft.variants.3.value",
      oldValue: 0,
      newValue: 1,
    });
    expect(result.xp).toBe(3);
    expect(result.confident).toBe(true);
  });
});
