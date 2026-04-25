import { describe, it, expect } from "vitest";
import { CharacterData } from "../../module/data/actor/character-data.mjs";
import { makeCharacterSystem, makeIntimacy } from "../_helpers/make-actor.mjs";

/**
 * Construct a CharacterData-like instance from a synthetic system
 * object and run prepareDerivedData on it. Returns the instance with
 * derived fields populated.
 */
function _prepDerivedData(system, items = []) {
  const data = Object.create(CharacterData.prototype);
  Object.assign(data, system);
  data.parent = { items };
  data.prepareDerivedData();
  return data;
}

describe("CharacterData._prepareCombatStats", () => {
  it("Dodge DV with Essence 2+ rounds up", () => {
    const sys = makeCharacterSystem({
      attributes: { ...makeCharacterSystem().attributes, dexterity: { value: 4 } },
      abilities: { ...makeCharacterSystem().abilities, dodge: { value: 3, defaultAttribute: "", caste: false, favored: false, specialties: [] } },
      essence: { value: 2, max: 2 }
    });
    const result = _prepDerivedData(sys);
    expect(result.dodgeDV).toBe(Math.ceil((4 + 3 + 2) / 2));  // 5
  });

  it("Dodge DV with Essence 1 rounds down", () => {
    const sys = makeCharacterSystem({
      attributes: { ...makeCharacterSystem().attributes, dexterity: { value: 3 } },
      abilities: { ...makeCharacterSystem().abilities, dodge: { value: 2, defaultAttribute: "", caste: false, favored: false, specialties: [] } },
      essence: { value: 1, max: 1 }
    });
    const result = _prepDerivedData(sys);
    expect(result.dodgeDV).toBe(Math.floor((3 + 2 + 1) / 2));  // 3
  });

  it("Dodge MDV always rounds down regardless of Essence", () => {
    const sys = makeCharacterSystem({
      willpower: { value: 7, max: 7 },
      essence:   { value: 5, max: 5 },
      abilities: { ...makeCharacterSystem().abilities, integrity: { value: 3, defaultAttribute: "", caste: false, favored: false, specialties: [] } }
    });
    const result = _prepDerivedData(sys);
    expect(result.dodgeMDV).toBe(Math.floor((7 + 3 + 5) / 2));  // 7
  });

  it("Parry MDV picks max(Cha, Man) for each social ability", () => {
    const sys = makeCharacterSystem({
      attributes: {
        ...makeCharacterSystem().attributes,
        charisma:     { value: 4 },
        manipulation: { value: 5 }
      },
      abilities: {
        ...makeCharacterSystem().abilities,
        presence:      { value: 3, defaultAttribute: "", caste: false, favored: false, specialties: [] },
        performance:   { value: 2, defaultAttribute: "", caste: false, favored: false, specialties: [] },
        investigation: { value: 1, defaultAttribute: "", caste: false, favored: false, specialties: [] },
        bureaucracy:   { value: 0, defaultAttribute: "", caste: false, favored: false, specialties: [] }
      }
    });
    const result = _prepDerivedData(sys);
    // bestSocialAttr = max(4, 5) = 5
    expect(result.parryMDV.byPresence).toBe(Math.floor((5 + 3) / 2));      // 4
    expect(result.parryMDV.byPerformance).toBe(Math.floor((5 + 2) / 2));    // 3
    expect(result.parryMDV.byInvestigation).toBe(Math.floor((5 + 1) / 2));  // 3
    expect(result.parryMDV.byBureaucracy).toBe(Math.floor((5 + 0) / 2));    // 2
    expect(result.parryMDV.best).toBe(4);
  });
});

describe("CharacterData._prepareMoteMaxima", () => {
  it("Solar pool formulas: personal = ess*3 + wp; peripheral = ess*7 + wp + ΣV", () => {
    const sys = makeCharacterSystem({
      essence:   { value: 3, max: 3 },
      willpower: { value: 7, max: 7 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 3, current: 3 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 4, current: 4 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 * 3 + 7);                    // 16
    expect(result.motes.peripheral.max).toBe(3 * 7 + 7 + (2 + 3 + 1 + 4)); // 38
  });

  it("Lunar pool: personal = ess + wp*2; peripheral = ess*4 + wp*2 + maxVirtue*4", () => {
    const sys = makeCharacterSystem({
      exaltType: "lunar",
      essence:   { value: 3, max: 3 },
      willpower: { value: 7, max: 7 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 3, current: 3 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 4, current: 4 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 + 7 * 2);                    // 17
    expect(result.motes.peripheral.max).toBe(3 * 4 + 7 * 2 + 4 * 4);      // 42
  });

  it("Terrestrial: personal = ess + wp; peripheral = ess*4 + wp + ΣV", () => {
    const sys = makeCharacterSystem({
      exaltType: "terrestrial",
      essence: { value: 3, max: 3 },
      willpower: { value: 5, max: 5 },
      virtues: {
        compassion: { value: 1, current: 1 },
        conviction: { value: 2, current: 2 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 3, current: 3 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 + 5);                  // 8
    expect(result.motes.peripheral.max).toBe(3 * 4 + 5 + (1 + 2 + 1 + 3));  // 12 + 5 + 7 = 24
  });

  it("Sidereal: personal = ess*2 + wp; peripheral = ess*6 + wp + ΣV", () => {
    const sys = makeCharacterSystem({
      exaltType: "sidereal",
      essence: { value: 3, max: 3 },
      willpower: { value: 5, max: 5 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 2, current: 2 },
        temperance: { value: 2, current: 2 },
        valor:      { value: 2, current: 2 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 * 2 + 5);              // 11
    expect(result.motes.peripheral.max).toBe(3 * 6 + 5 + 8);        // 31
  });

  it("Alchemical: personal = ess*3 + wp; peripheral = ess*5 + wp*3 + maxVirtue*2", () => {
    // Virtues chosen so maxVirtue*2 (8) and virtueSum (10) diverge — a
    // regression that swapped the formula to virtueSum would mis-tally.
    const sys = makeCharacterSystem({
      exaltType: "alchemical",
      essence: { value: 3, max: 3 },
      willpower: { value: 5, max: 5 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 3, current: 3 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 4, current: 4 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 * 3 + 5);              // 14
    expect(result.motes.peripheral.max).toBe(3 * 5 + 5 * 3 + 4 * 2); // 15 + 15 + 8 = 38
  });

  it("Mortal: personal = ess; peripheral = ess*2", () => {
    const sys = makeCharacterSystem({
      exaltType: "mortal",
      essence: { value: 2, max: 2 }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(2);
    expect(result.motes.peripheral.max).toBe(4);
  });

  it("Abyssal: same formulas as Solar (default branch)", () => {
    const sys = makeCharacterSystem({
      exaltType: "abyssal",
      essence: { value: 3, max: 3 },
      willpower: { value: 7, max: 7 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 3, current: 3 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 4, current: 4 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.motes.personal.max).toBe(3 * 3 + 7);              // 16
    expect(result.motes.peripheral.max).toBe(3 * 7 + 7 + 10);       // 38
  });
});

describe("CharacterData._prepareWillpowerMinimum", () => {
  it("minPermanent = sum of two highest virtues", () => {
    const sys = makeCharacterSystem({
      virtues: {
        compassion: { value: 1, current: 1 },
        conviction: { value: 2, current: 2 },
        temperance: { value: 4, current: 4 },
        valor:      { value: 3, current: 3 }
      }
    });
    const result = _prepDerivedData(sys);
    expect(result.willpower.minPermanent).toBe(4 + 3);  // 7
  });
});

describe("CharacterData._prepareIntimacies", () => {
  it("count excludes Principles; cap = WP.max + Compassion", () => {
    const sys = makeCharacterSystem({
      willpower: { value: 7, max: 7 },
      virtues: {
        compassion: { value: 3, current: 3 },
        conviction: { value: 2, current: 2 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 1, current: 1 }
      }
    });
    const items = [
      makeIntimacy({ intimacyType: "tie",       positive: true }),
      makeIntimacy({ intimacyType: "tie",       positive: false }),
      makeIntimacy({ intimacyType: "principle", positive: true })
    ];
    const result = _prepDerivedData(sys, items);
    expect(result.intimacies.count).toBe(2);                  // 2 ties, principle excluded
    expect(result.intimacies.cap).toBe(7 + 3);                // 10
    expect(result.intimacies.overCapacity).toBe(false);
    expect(result.intimacies.maxStrength).toBe(2);            // Conviction
  });
});
