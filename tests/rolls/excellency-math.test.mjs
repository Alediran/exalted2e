import { describe, it, expect } from "vitest";
import { computeAttackExcellencyCaps } from "../../module/rolls/excellency-math.mjs";
import { makeCharacterSystem } from "../_helpers/make-actor.mjs";

describe("computeAttackExcellencyCaps", () => {
  it("Solar: cap = attr + abil; second = ceil(cap/2)", () => {
    const actor = {
      system: makeCharacterSystem({
        exaltType: "solar",
        attributes: { ...makeCharacterSystem().attributes, charisma: { value: 4 } },
        abilities:  { ...makeCharacterSystem().abilities,  presence: {
          value: 5, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    expect(computeAttackExcellencyCaps(actor, "charisma", "presence"))
      .toEqual({ firstExcMax: 9, secondExcMax: 5 }); // ceil(9/2) = 5
  });

  it("Sidereal: same as Solar (default branch)", () => {
    const actor = {
      system: makeCharacterSystem({
        exaltType: "sidereal",
        attributes: { ...makeCharacterSystem().attributes, manipulation: { value: 3 } },
        abilities:  { ...makeCharacterSystem().abilities,  bureaucracy: {
          value: 4, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    expect(computeAttackExcellencyCaps(actor, "manipulation", "bureaucracy"))
      .toEqual({ firstExcMax: 7, secondExcMax: 4 }); // ceil(7/2) = 4
  });

  it("Lunar: cap = attribute only; ability ignored", () => {
    const actor = {
      system: makeCharacterSystem({
        exaltType: "lunar",
        attributes: { ...makeCharacterSystem().attributes, charisma: { value: 5 } },
        abilities:  { ...makeCharacterSystem().abilities,  presence: {
          value: 4, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    expect(computeAttackExcellencyCaps(actor, "charisma", "presence"))
      .toEqual({ firstExcMax: 5, secondExcMax: 3 }); // ceil(5/2) = 3
  });

  it("Alchemical: same as Lunar (attribute-only)", () => {
    const actor = {
      system: makeCharacterSystem({
        exaltType: "alchemical",
        attributes: { ...makeCharacterSystem().attributes, manipulation: { value: 4 } },
        abilities:  { ...makeCharacterSystem().abilities,  performance: {
          value: 3, defaultAttribute: "", caste: false, favored: false, specialties: []
        } }
      })
    };
    expect(computeAttackExcellencyCaps(actor, "manipulation", "performance"))
      .toEqual({ firstExcMax: 4, secondExcMax: 2 }); // ceil(4/2) = 2
  });

  it("Terrestrial: cap = abil + bestSpecialty (NO attribute)", () => {
    const actor = {
      system: makeCharacterSystem({
        exaltType: "terrestrial",
        attributes: { ...makeCharacterSystem().attributes, charisma: { value: 5 } },
        abilities:  { ...makeCharacterSystem().abilities,  presence: {
          value: 3,
          defaultAttribute: "",
          caste: false,
          favored: false,
          specialties: [{ name: "Intimidation", value: 2 }, { name: "Oratory", value: 1 }]
        } }
      })
    };
    // abil 3 + best specialty 2 = 5; attribute (5) is ignored
    expect(computeAttackExcellencyCaps(actor, "charisma", "presence"))
      .toEqual({ firstExcMax: 5, secondExcMax: 3 }); // ceil(5/2) = 3
  });

  it("returns zero caps for missing system data or unknown exalt type", () => {
    expect(computeAttackExcellencyCaps({},        "charisma", "presence")).toEqual({ firstExcMax: 0, secondExcMax: 0 });
    expect(computeAttackExcellencyCaps({system:{}}, "charisma", "presence")).toEqual({ firstExcMax: 0, secondExcMax: 0 });
    const mortal = { system: makeCharacterSystem({ exaltType: "mortal" }) };
    expect(computeAttackExcellencyCaps(mortal, "charisma", "presence"))
      .toEqual({ firstExcMax: 0, secondExcMax: 0 });
  });
});
