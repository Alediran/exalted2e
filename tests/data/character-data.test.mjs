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

function breedingItem(rating) {
  return {
    type: "background",
    system: { value: rating },
    flags: { exalted2e: { isBreeding: true } }
  };
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

  it("Terrestrial (no Breeding): personal = ess+wp+highestV; peripheral = ess*4+wp+twoHighestV", () => {
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
    const result = _prepDerivedData(sys, []);
    // sorted desc: [3,2,1,1] → highest=3, twoHighest=5; no breeding → +0/+0
    expect(result.motes.personal.max).toBe(3 + 5 + 3 + 0);           // 11
    expect(result.motes.peripheral.max).toBe(3 * 4 + 5 + 5 + 0);     // 22
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

describe("CharacterData._prepareBreedingBonus — lookup tables", () => {
  it("rating 0 → all zeros", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(0)]);
    expect(result.breedingBonus).toEqual({ rating: 0, personal: 0, peripheral: 0, animaReduction: 0 });
  });

  it("rating 1 → personal 1, peripheral 2, animaReduction 0", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(1)]);
    expect(result.breedingBonus).toEqual({ rating: 1, personal: 1, peripheral: 2, animaReduction: 0 });
  });

  it("rating 2 → personal 2, peripheral 3, animaReduction 0", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(2)]);
    expect(result.breedingBonus).toEqual({ rating: 2, personal: 2, peripheral: 3, animaReduction: 0 });
  });

  it("rating 3 → personal 3, peripheral 5, animaReduction 0", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(3)]);
    expect(result.breedingBonus).toEqual({ rating: 3, personal: 3, peripheral: 5, animaReduction: 0 });
  });

  it("rating 4 → personal 4, peripheral 7, animaReduction 1", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(4)]);
    expect(result.breedingBonus).toEqual({ rating: 4, personal: 4, peripheral: 7, animaReduction: 1 });
  });

  it("rating 5 → personal 5, peripheral 9, animaReduction 2", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(5)]);
    expect(result.breedingBonus).toEqual({ rating: 5, personal: 5, peripheral: 9, animaReduction: 2 });
  });

  it("rating > 5 is clamped to 5 → personal 5, peripheral 9, animaReduction 2", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, [breedingItem(6)]);
    expect(result.breedingBonus).toEqual({ rating: 5, personal: 5, peripheral: 9, animaReduction: 2 });
  });

  it("no Breeding background present → breedingBonus defaults to all zeros", () => {
    const sys = makeCharacterSystem({ exaltType: "terrestrial" });
    const result = _prepDerivedData(sys, []);
    expect(result.breedingBonus).toEqual({ rating: 0, personal: 0, peripheral: 0, animaReduction: 0 });
  });

  it("non-terrestrial exalt with a flagged Background → breedingBonus still all zeros", () => {
    const sys = makeCharacterSystem({ exaltType: "solar" });
    const result = _prepDerivedData(sys, [breedingItem(4)]);
    expect(result.breedingBonus).toEqual({ rating: 0, personal: 0, peripheral: 0, animaReduction: 0 });
  });

});

describe("CharacterData._prepareMoteMaxima — Terrestrial virtue two-highest sort", () => {
  function terrestrialSys(v) {
    return makeCharacterSystem({
      exaltType: "terrestrial",
      essence:   { value: 1, max: 1 },
      willpower: { value: 0, max: 0 },
      virtues: {
        compassion: { value: v[0], current: v[0] },
        conviction: { value: v[1], current: v[1] },
        temperance: { value: v[2], current: v[2] },
        valor:      { value: v[3], current: v[3] }
      }
    });
  }

  it("all equal virtues → twoHighest = 2 * virtue", () => {
    const result = _prepDerivedData(terrestrialSys([3, 3, 3, 3]), []);
    // personal = 1+0+3+0=4; peripheral = 4+0+6+0=10
    expect(result.motes.personal.max).toBe(4);
    expect(result.motes.peripheral.max).toBe(10);
  });

  it("ascending order virtues → picks the two largest regardless of position", () => {
    const result = _prepDerivedData(terrestrialSys([1, 2, 3, 4]), []);
    // sorted [4,3,2,1] → highest=4, twoHighest=7
    // personal = 1+0+4+0=5; peripheral = 4+0+7+0=11
    expect(result.motes.personal.max).toBe(5);
    expect(result.motes.peripheral.max).toBe(11);
  });

  it("ties in top two → uses both tied values", () => {
    const result = _prepDerivedData(terrestrialSys([1, 3, 3, 2]), []);
    // sorted [3,3,2,1] → highest=3, twoHighest=6
    // personal = 1+0+3+0=4; peripheral = 4+0+6+0=10
    expect(result.motes.personal.max).toBe(4);
    expect(result.motes.peripheral.max).toBe(10);
  });

  it("Terrestrial with Breeding 3: virtue sort + bonus applied to mote pool", () => {
    // virtues [2,3,1,4] sorted desc [4,3,2,1] → highestVirtue=4, twoHighest=7
    // Breeding 3 → bp.personal=3, bp.peripheral=5
    // personal = ess3 + wp5 + 4 + 3 = 15
    // peripheral = ess3*4 + wp5 + 7 + 5 = 29
    const sys = makeCharacterSystem({
      exaltType: "terrestrial",
      essence:   { value: 3, max: 3 },
      willpower: { value: 5, max: 5 },
      virtues: {
        compassion: { value: 2, current: 2 },
        conviction: { value: 3, current: 3 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 4, current: 4 }
      }
    });
    const result = _prepDerivedData(sys, [breedingItem(3)]);
    expect(result.motes.personal.max).toBe(15);
    expect(result.motes.peripheral.max).toBe(29);
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

function _makeExemplarCharm(overrides = {}) {
  return {
    type: "charm",
    name: "Test Exemplar",
    system: {
      installed: true,
      keywords:  ["Exemplar"],
      ...overrides
    }
  };
}

describe("CharacterData._prepareAnimaLevel", () => {
  it("scenePeripheral=0 → none (solar)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 0 }));
    expect(result.anima).toBe("none");
  });

  it("scenePeripheral=1 → dim (at dim threshold)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 1 }));
    expect(result.anima).toBe("dim");
  });

  it("scenePeripheral=4 → glowing (at glowing threshold)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 4 }));
    expect(result.anima).toBe("glowing");
  });

  it("scenePeripheral=8 → burning (at burning threshold)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 8 }));
    expect(result.anima).toBe("burning");
  });

  it("scenePeripheral=11 → bonfire (at bonfire threshold)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 11 }));
    expect(result.anima).toBe("bonfire");
  });

  it("scenePeripheral=16 → totemic (at totemic threshold)", () => {
    const result = _prepDerivedData(makeCharacterSystem({ scenePeripheral: 16 }));
    expect(result.anima).toBe("totemic");
  });

  it("mortal with scenePeripheral=20 → always none", () => {
    const result = _prepDerivedData(makeCharacterSystem({ exaltType: "mortal", scenePeripheral: 20 }));
    expect(result.anima).toBe("none");
  });
});

describe("CharacterData._prepareAlchemicalClarity", () => {
  it("non-alchemical actor: clarity.permanent is not modified", () => {
    const sys = makeCharacterSystem({
      exaltType: "solar",
      essence:   { value: 3, max: 3 },
      limit:     2
    });
    const result = _prepDerivedData(sys);
    // _prepareAlchemicalClarity returns early, so the fixture value stays
    expect(result.splat.alchemical.clarity.permanent).toBe(0);
    expect(result.splat.alchemical.clarity.total).toBe(0);
  });

  it("Alchemical Ess 3, zero Exemplars, limit 2: permanent=0, total=2", () => {
    // computePermanentClarity(3, 0) = max(0, 3-5) + 0 = 0
    // computeTotalClarity(0, 2)     = min(10, 0+2) = 2
    const sys = makeCharacterSystem({
      exaltType: "alchemical",
      essence:   { value: 3, max: 3 },
      limit:     2
    });
    const result = _prepDerivedData(sys);
    expect(result.splat.alchemical.clarity.permanent).toBe(0);
    expect(result.splat.alchemical.clarity.total).toBe(2);
  });

  it("Alchemical Ess 6, zero Exemplars, limit 0: permanent=1, total=1", () => {
    // computePermanentClarity(6, 0) = max(0, 6-5) + 0 = 1
    // computeTotalClarity(1, 0)     = min(10, 1+0) = 1
    const sys = makeCharacterSystem({
      exaltType: "alchemical",
      essence:   { value: 6, max: 6 },
      limit:     0
    });
    const result = _prepDerivedData(sys);
    expect(result.splat.alchemical.clarity.permanent).toBe(1);
    expect(result.splat.alchemical.clarity.total).toBe(1);
  });

  it("Alchemical Ess 5, one Exemplar installed, limit 0: permanent=1, total=1", () => {
    // computePermanentClarity(5, 1) = max(0, 5-5) + 1 = 1
    // computeTotalClarity(1, 0)     = min(10, 1+0) = 1
    const sys = makeCharacterSystem({
      exaltType: "alchemical",
      essence:   { value: 5, max: 5 },
      limit:     0
    });
    const items = [ _makeExemplarCharm() ];
    const result = _prepDerivedData(sys, items);
    expect(result.splat.alchemical.clarity.permanent).toBe(1);
    expect(result.splat.alchemical.clarity.total).toBe(1);
  });

  it("cap: permanent=6, limit=7 → total=10 (capped)", () => {
    // computePermanentClarity(11, 0) = max(0, 11-5) + 0 = 6
    // computeTotalClarity(6, 7)      = min(10, 6+7) = 10
    const sys = makeCharacterSystem({
      exaltType: "alchemical",
      essence:   { value: 11, max: 11 },
      limit:     7
    });
    const result = _prepDerivedData(sys);
    expect(result.splat.alchemical.clarity.permanent).toBe(6);
    expect(result.splat.alchemical.clarity.total).toBe(10);
  });
});
