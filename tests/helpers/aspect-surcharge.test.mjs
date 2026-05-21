import { describe, it, expect } from "vitest";
import { getOutOfAspectSurcharge, getForeignCharmSurcharge, getCelestialMASurcharge } from "../../module/helpers/aspect-surcharge.mjs";

function makeActor({
  exaltType = "terrestrial",
  caste = "",
  abilities = {},
  items = []
} = {}) {
  const allAbilities = [
    "archery","athletics","awareness","bureaucracy","craft","dodge","integrity",
    "investigation","larceny","linguistics","lore","martialArts","medicine",
    "melee","occult","performance","presence","resistance","ride","sail",
    "socialize","stealth","survival","thrown","war"
  ];
  const base = {};
  for (const k of allAbilities) {
    base[k] = { value: 1, caste: false, favored: false };
  }
  Object.assign(base, abilities);
  return { system: { exaltType, caste, abilities: base }, items };
}

function makeCharm({ ability = "melee", martialArtsTier = "", martialArtsElement = "", exaltType = "", duration = "instant" } = {}) {
  return { system: { ability, martialArtsTier, martialArtsElement, exaltType, duration } };
}

function makeMasteryCharm(element) {
  return { type: "charm", system: { grantsMastery: true, martialArtsElement: element } };
}

describe("getOutOfAspectSurcharge", () => {

  it("returns 0 for non-terrestrial actors (Solar)", () => {
    const actor = makeActor({ exaltType: "solar" });
    const charm = makeCharm({ ability: "melee" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for non-terrestrial actors (Lunar)", () => {
    const actor = makeActor({ exaltType: "lunar" });
    const charm = makeCharm({ ability: "athletics" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when charm ability is blank", () => {
    const actor = makeActor();
    const charm = makeCharm({ ability: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when charm ability key does not exist on actor", () => {
    const actor = makeActor();
    const charm = makeCharm({ ability: "unknownAbility" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when ability is in caste (in-aspect)", () => {
    const actor = makeActor({
      abilities: { melee: { value: 3, caste: true, favored: false } }
    });
    const charm = makeCharm({ ability: "melee" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 1 when ability is favored but NOT caste", () => {
    const actor = makeActor({
      abilities: { athletics: { value: 3, caste: false, favored: true } }
    });
    const charm = makeCharm({ ability: "athletics" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("returns 1 when ability is neither caste nor favored", () => {
    const actor = makeActor({
      abilities: { archery: { value: 1, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "archery" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("mid-initiation: in-aspect terrestrial-tier MA charm still costs 1m while learning a Dragon Style", () => {
    const inProgressCharm = { type: "charm", system: { grantsMastery: false, martialArtsElement: "air" } };
    const actor = makeActor({
      abilities: { martialArts: { value: 3, caste: true, favored: false } },
      caste: "water",
      items: [inProgressCharm]
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 for Water Aspect using Terrestrial MA (martialArts is caste)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 3, caste: true, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 1 for non-Water Aspect using Terrestrial MA (martialArts not caste)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 for non-Water Aspect who mastered the charm's elemental Dragon Style (terrestrial-tier)", () => {
    const masteryCharm = makeMasteryCharm("wood");
    const actor = makeActor({
      caste: "fire",
      abilities: { martialArts: { value: 2, caste: false, favored: false } },
      items: [masteryCharm]
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "", martialArtsElement: "wood" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("mastery of a different element does not exempt terrestrial-tier MA", () => {
    const masteryCharm = makeMasteryCharm("wood");
    const actor = makeActor({
      caste: "fire",
      abilities: { martialArts: { value: 2, caste: false, favored: false } },
      items: [masteryCharm]
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "", martialArtsElement: "earth" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 for Celestial MA regardless of aspect", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for Sidereal MA regardless of aspect", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "sidereal" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("derives celestial tier from charm exaltType 'solar' (no martialArtsTier set)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", exaltType: "solar" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("derives celestial tier from charm exaltType 'lunar' (no martialArtsTier set)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", exaltType: "lunar" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("treats terrestrial exaltType charm as Terrestrial MA (normal caste check)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", exaltType: "terrestrial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("explicit martialArtsTier overrides exaltType derivation", () => {
    // exaltType says "terrestrial" (→ "") but explicit martialArtsTier says "celestial"
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", exaltType: "terrestrial", martialArtsTier: "celestial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("derives celestial tier from exaltType 'martialarts' (MA-style charm) — always exempt", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialarts", exaltType: "martialarts" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

});

describe("getForeignCharmSurcharge", () => {

  it("returns 0 for non-eclipse-like exalt types (Solar Dawn)", () => {
    const actor = makeActor({ exaltType: "solar", caste: "dawn" });
    const charm = makeCharm({ exaltType: "lunar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when charm exaltType matches actor exaltType (Eclipse activates Solar charm)", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "solar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("Solar Eclipse activating a Lunar charm returns 2", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "lunar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(2);
  });

  it("Solar Eclipse activating a Terrestrial charm returns 2", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "terrestrial" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(2);
  });

  it("Solar Eclipse activating an Abyssal charm returns 0 (mirror exemption)", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "abyssal" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("Abyssal Moonshadow activating a Solar charm returns 0 (mirror exemption)", () => {
    const actor = makeActor({ exaltType: "abyssal", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "solar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("Abyssal Moonshadow activating a Lunar charm returns 2", () => {
    const actor = makeActor({ exaltType: "abyssal", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "lunar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(2);
  });

  it("Infernal Fiend activating a Solar charm returns 2 (no mirror exemption)", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const charm = makeCharm({ exaltType: "solar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(2);
  });

  it("Infernal Fiend activating an Abyssal charm returns 2 (no mirror exemption)", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const charm = makeCharm({ exaltType: "abyssal" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(2);
  });

  it("Infernal Fiend activating an Infernal charm returns 0 (native)", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const charm = makeCharm({ exaltType: "infernal" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for a Permanent foreign charm (no activation cost to surcharge)", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "lunar", duration: "permanent" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when charm has no exaltType set", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("Solar Eclipse activating an MA-style charm returns 0 (not foreign)", () => {
    const actor = makeActor({ exaltType: "solar", caste: "eclipse" });
    const charm = makeCharm({ exaltType: "martialarts" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("Infernal Fiend activating an MA-style charm returns 0 (not foreign)", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "fiend" });
    const charm = makeCharm({ exaltType: "martialarts" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for null actor", () => {
    const charm = makeCharm({ exaltType: "lunar" });
    expect(getForeignCharmSurcharge(null, charm)).toBe(0);
  });

  it("Infernal non-Fiend caste returns 0 (Slayer activating Solar charm)", () => {
    const actor = makeActor({ exaltType: "infernal", caste: "slayer" });
    const charm = makeCharm({ exaltType: "solar" });
    expect(getForeignCharmSurcharge(actor, charm)).toBe(0);
  });

});

describe("getCelestialMASurcharge", () => {

  it("returns 0 for non-terrestrial actor (Solar)", () => {
    const actor = makeActor({ exaltType: "solar" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 when charm ability is not martialarts", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire" });
    const charm = makeCharm({ ability: "melee", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for terrestrial-tier MA charm (not celestial/sidereal)", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "", martialArtsElement: "fire" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(0);
  });

  it("returns 1 for non-Immaculate celestial MA (no element set) — DB always pay", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 when DB caste matches the style's element (in-aspect)", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "air" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(0);
  });

  it("returns 1 when DB caste does not match the style's element", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(1);
  });

  it("returns 1 for sidereal-tier MA with non-matching element (element set)", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire" });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "sidereal", martialArtsElement: "water" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 after mastery (owns grantsMastery charm of matching element)", () => {
    const masteryCharm = makeMasteryCharm("air");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(0);
  });

  it("mastery of a different element does not remove surcharge", () => {
    const masteryCharm = makeMasteryCharm("water");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    const charm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "air" });
    expect(getCelestialMASurcharge(actor, charm)).toBe(1);
  });

  it("mid-initiation: in-aspect charm still costs 1m while learning an elemental style", () => {
    // Fire Aspect learning Air Dragon Style (has one charm, not mastery)
    const inProgressCharm = { type: "charm", system: { grantsMastery: false, martialArtsElement: "air" } };
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [inProgressCharm] });
    const fireCharm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "fire" });
    expect(getCelestialMASurcharge(actor, fireCharm)).toBe(1);
  });

  it("non-elemental celestial MA always costs 1m (mid-initiation or not)", () => {
    // Not mid-initiation — still costs 1m
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [] });
    const genericCharm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "" });
    expect(getCelestialMASurcharge(actor, genericCharm)).toBe(1);
  });

  it("completing mastery ends mid-initiation penalty for all MA charms", () => {
    const masteryCharm = makeMasteryCharm("air");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    const fireCharm = makeCharm({ ability: "martialarts", martialArtsTier: "celestial", martialArtsElement: "fire" });
    // Fire Aspect using Fire-aspected celestial MA — no longer mid-initiation
    expect(getCelestialMASurcharge(actor, fireCharm)).toBe(0);
  });

});

describe("getOutOfAspectSurcharge — mastery bonus", () => {

  it("mastering Wood Dragon Style exempts Wood-aspect ability charms (archery)", () => {
    const masteryCharm = makeMasteryCharm("wood");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    const charm = makeCharm({ ability: "archery" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("mastery exemption applies to all 5 abilities of the mastered element", () => {
    const masteryCharm = makeMasteryCharm("earth");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    for (const ab of ["awareness", "craft", "integrity", "resistance", "war"]) {
      expect(getOutOfAspectSurcharge(actor, makeCharm({ ability: ab }))).toBe(0);
    }
  });

  it("mastery of one element does not exempt another element's abilities", () => {
    const masteryCharm = makeMasteryCharm("wood");
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [masteryCharm] });
    const charm = makeCharm({ ability: "linguistics" }); // air element
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("without mastery, out-of-aspect ability still costs 1m", () => {
    const actor = makeActor({ exaltType: "terrestrial", caste: "fire", items: [] });
    const charm = makeCharm({ ability: "archery" }); // wood element, not fire
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

});
