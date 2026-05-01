import { describe, it, expect } from "vitest";
import { getOutOfAspectSurcharge } from "../../module/helpers/aspect-surcharge.mjs";

function makeActor({
  exaltType = "terrestrial",
  abilities = {}
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
  return { system: { exaltType, abilities: base } };
}

function makeCharm({ ability = "melee", martialArtsTier = "", exaltType = "" } = {}) {
  return { system: { ability, martialArtsTier, exaltType } };
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

  it("returns 0 for Water Aspect using Terrestrial MA (martialArts is caste)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 3, caste: true, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", martialArtsTier: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 1 for non-Water Aspect using Terrestrial MA (martialArts not caste)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", martialArtsTier: "" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("returns 0 for Celestial MA regardless of aspect", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", martialArtsTier: "celestial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("returns 0 for Sidereal MA regardless of aspect", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", martialArtsTier: "sidereal" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("derives celestial tier from charm exaltType 'solar' (no martialArtsTier set)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", exaltType: "solar" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("derives celestial tier from charm exaltType 'lunar' (no martialArtsTier set)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", exaltType: "lunar" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

  it("treats terrestrial exaltType charm as Terrestrial MA (normal caste check)", () => {
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", exaltType: "terrestrial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(1);
  });

  it("explicit martialArtsTier overrides exaltType derivation", () => {
    // exaltType says "terrestrial" (→ "") but explicit martialArtsTier says "celestial"
    const actor = makeActor({
      abilities: { martialArts: { value: 2, caste: false, favored: false } }
    });
    const charm = makeCharm({ ability: "martialArts", exaltType: "terrestrial", martialArtsTier: "celestial" });
    expect(getOutOfAspectSurcharge(actor, charm)).toBe(0);
  });

});
