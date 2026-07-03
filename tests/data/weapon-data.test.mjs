import { describe, it, expect, vi, afterEach } from "vitest";
import { WeaponData } from "../../module/data/item/weapon-data.mjs";
import { computeWielderPenalty } from "../../module/data/item/weapon-math.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMode(overrides = {}) {
  return {
    name: "",
    speed: 5, accuracy: 0, damage: 1, damageType: "lethal",
    overwhelming: 1, defense: 0, rate: 1, range: 0,
    minStrength: 0, minDexterity: 0, minMartialArts: 0,
    tags: [],
    areaShape: "circle",
    areaSize: "3",
    areaResistPool: "stamina+resistance",
    areaResistDifficulty: "1",
    areaResistEffect: "avoid",
    ...overrides
  };
}

function _prepDerivedData(weaponSystem) {
  const data = Object.create(WeaponData.prototype);
  Object.assign(data, weaponSystem);
  data.prepareDerivedData();
  return data;
}

describe("WeaponData schema — artifact fields", () => {
  let schema;
  beforeAll(() => { schema = WeaponData.defineSchema(); });

  it("artifactRating: min 0, max 5, integer, initial 0", () => {
    expect(schema.artifactRating.options).toMatchObject({ min: 0, max: 5, integer: true, initial: 0 });
  });

  it("hearthstoneSlots: min 0, max 3, integer, initial 0", () => {
    expect(schema.hearthstoneSlots.options).toMatchObject({ min: 0, max: 3, integer: true, initial: 0 });
  });
});

describe("WeaponData.prepareDerivedData", () => {
  it("unattuned weapon gets no material bonus", () => {
    const sys = {
      modes: [makeMode({ accuracy: 1, damage: 3 })],
      artifact: false,
      magicalMaterial: "",
      attunementCost: 0,
      attuned: false,
      description: "",
      equipped: false
    };
    const result = _prepDerivedData(sys);
    expect(result.modes[0].effectiveAccuracy).toBe(1);
    expect(result.modes[0].effectiveDamage).toBe(3);
  });

  it("orichalcum melee weapon (core values): +1 Acc, +1 Def, +1 Rate", () => {
    const sys = {
      modes: [makeMode({ accuracy: 1, damage: 3, defense: 1, rate: 2 })],
      artifact: true,
      magicalMaterial: "orichalcum",
      attunementCost: 4,
      attuned: true,
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    expect(result.modes[0].effectiveAccuracy).toBe(1 + 1);
    expect(result.modes[0].effectiveDefense).toBe(1 + 1);
    expect(result.modes[0].effectiveRate).toBe(2 + 1);
  });

  it("orichalcum melee weapon (errata): +2 Acc, +1 Def, +1 Rate", () => {
    vi.spyOn(game.settings, "get").mockImplementation((scope, key) => {
      if (key === "useErrataMaterials") return true;
      return false;
    });
    const sys = {
      modes: [makeMode({ accuracy: 1, damage: 3, defense: 1, rate: 2 })],
      artifact: true,
      magicalMaterial: "orichalcum",
      attunementCost: 4,
      attuned: true,
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    expect(result.modes[0].effectiveAccuracy).toBe(1 + 2);
    expect(result.modes[0].effectiveDefense).toBe(1 + 1);
    expect(result.modes[0].effectiveRate).toBe(2 + 1);
  });

  it("ranged weapon uses ranged-material table, not melee", () => {
    const sys = {
      modes: [makeMode({ accuracy: 0, damage: 4, range: 50, tags: [] })],
      artifact: true,
      magicalMaterial: "starmetal",
      attunementCost: 4,
      attuned: true,
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    // Starmetal ranged: +1 Acc, +2 Damage. Range bonus = 0 (no thrownRange tag, range field).
    expect(result.modes[0].effectiveAccuracy).toBe(1);
    expect(result.modes[0].effectiveDamage).toBe(4 + 2);
  });

  it("thrown weapon uses thrownRange material bonus, not range", () => {
    const sys = {
      modes: [makeMode({ accuracy: 0, damage: 1, range: 30, tags: ["Thrown"] })],
      artifact: true,
      magicalMaterial: "moonsilver",
      attunementCost: 4,
      attuned: true,
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    // Moonsilver ranged: thrownRange +20. So effectiveRange = 30 + 20 = 50.
    expect(result.modes[0].effectiveRange).toBe(30 + 20);
  });

  it("damageLabel includes Overwhelming tag when present", () => {
    const sys = {
      modes: [makeMode({ damage: 5, damageType: "lethal", overwhelming: 3, tags: ["Overwhelming"] })],
      artifact: false,
      magicalMaterial: "",
      attunementCost: 0,
      attuned: false,
      description: "",
      equipped: false
    };
    const result = _prepDerivedData(sys);
    expect(result.modes[0].damageLabel).toBe("5L/3");
  });
});

describe("mode schema — area attack fields", () => {
  it("mode schema has area attack fields with correct defaults", () => {
    const schema = WeaponData.defineSchema();
    const modesArrayField = schema.modes;
    // ArrayField(SchemaField) pattern: .options.options to reach the SchemaField's fields
    const modeFields = modesArrayField.options.options;

    // Check that all area attack fields exist
    expect(modeFields.areaShape).toBeDefined();
    expect(modeFields.areaSize).toBeDefined();
    expect(modeFields.areaResistPool).toBeDefined();
    expect(modeFields.areaResistDifficulty).toBeDefined();
    expect(modeFields.areaResistEffect).toBeDefined();

    // Check initial values
    const areaShapeInitial = modeFields.areaShape?.getInitialValue?.() ?? modeFields.areaShape?.options?.initial;
    expect(areaShapeInitial).toBe("circle");

    const areaSizeInitial = modeFields.areaSize?.getInitialValue?.() ?? modeFields.areaSize?.options?.initial;
    expect(areaSizeInitial).toBe("3");

    const areaResistPoolInitial = modeFields.areaResistPool?.getInitialValue?.() ?? modeFields.areaResistPool?.options?.initial;
    expect(areaResistPoolInitial).toBe("stamina+resistance");

    const areaResistDifficultyInitial = modeFields.areaResistDifficulty?.getInitialValue?.() ?? modeFields.areaResistDifficulty?.options?.initial;
    expect(areaResistDifficultyInitial).toBe("1");

    const areaResistEffectInitial = modeFields.areaResistEffect?.getInitialValue?.() ?? modeFields.areaResistEffect?.options?.initial;
    expect(areaResistEffectInitial).toBe("avoid");
  });
});

describe("computeWielderPenalty", () => {
  it("returns 0 when wielder meets every minimum", () => {
    expect(computeWielderPenalty(
      { minStrength: 3, minDexterity: 2, minMartialArts: 0 },
      { strength: 3, dexterity: 2, martialArts: 0 }
    )).toBe(0);
  });

  it("docks one die per missing Strength dot", () => {
    expect(computeWielderPenalty(
      { minStrength: 4 },
      { strength: 2 }
    )).toBe(2);
  });

  it("accumulates shortfalls across Strength, Dexterity, Martial Arts", () => {
    expect(computeWielderPenalty(
      { minStrength: 4, minDexterity: 3, minMartialArts: 2 },
      { strength: 2, dexterity: 1, martialArts: 0 }
    )).toBe(2 + 2 + 2);   // 6 missing dots total
  });

  it("ignores excess wielder dots above the minimum", () => {
    expect(computeWielderPenalty(
      { minStrength: 1 },
      { strength: 5 }
    )).toBe(0);
  });

  it("missing wielder stats default to zero (full penalty applied)", () => {
    expect(computeWielderPenalty(
      { minStrength: 3, minDexterity: 2 },
      {}
    )).toBe(3 + 2);
  });
});

describe("WeaponData schema — inElsewhere (M72)", () => {
  let schema;
  beforeAll(() => { schema = WeaponData.defineSchema(); });

  it("field exists", () => {
    expect(schema.inElsewhere).toBeDefined();
  });

  it("defaults to false", () => {
    const initial = schema.inElsewhere.getInitialValue?.() ?? schema.inElsewhere.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("WeaponData schema — ammo.selectedAmmoId (M71)", () => {
  let schema;
  beforeAll(() => { schema = WeaponData.defineSchema(); });

  it("ammo SchemaField exists", () => {
    expect(schema.ammo).toBeDefined();
  });

  it("selectedAmmoId StringField exists inside ammo", () => {
    const f = schema.ammo.fields?.selectedAmmoId ?? schema.ammo.schema?.fields?.selectedAmmoId;
    expect(f).toBeDefined();
  });

  it("selectedAmmoId defaults to empty string", () => {
    const f = schema.ammo.fields?.selectedAmmoId ?? schema.ammo.schema?.fields?.selectedAmmoId;
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe("");
  });
});
