import { describe, it, expect } from "vitest";
import {
  canLearnCelestialMA,
  canLearnSiderealMA,
  isWeaponValidForStyle,
  canBypassMinAbility,
} from "../../module/helpers/ma-validation.mjs";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeActor(exaltType, items = [], effects = []) {
  return {
    system: { exaltType, abilities: {} },
    items: { some: (fn) => items.some(fn), find: (fn) => items.find(fn) },
    effects: { some: (fn) => effects.some(fn) },
  };
}

function makeCharm(overrides = {}) {
  return {
    type: "charm",
    system: {
      grantsCelestialMA: false,
      martialArtsTier: "terrestrial",
      grantsMastery: false,
      keywords: [],
      ability: null,
      minAbility: 0,
      ...overrides,
    },
  };
}

function makeActorWithAbilities(exaltType, abilities = {}, items = [], effects = []) {
  return {
    system: { exaltType, abilities },
    items: { some: (fn) => items.some(fn), find: (fn) => items.find(fn) },
    effects: { some: (fn) => effects.some(fn) },
  };
}

function makeWeapon(name, overrides = {}) {
  return {
    name,
    system: {
      tags: [],
      martialArtsStyles: [],
      ...overrides,
    },
  };
}

function makeStyleItem(name, weapons = []) {
  return {
    type: "martialartsstyle",
    name,
    system: { weapons },
  };
}

// ── canLearnCelestialMA ───────────────────────────────────────────────────────

describe("canLearnCelestialMA", () => {
  it("returns true for non-terrestrial actors", () => {
    expect(canLearnCelestialMA(makeActor("solar"))).toBe(true);
    expect(canLearnCelestialMA(makeActor("lunar"))).toBe(true);
    expect(canLearnCelestialMA(makeActor("sidereal"))).toBe(true);
  });

  it("returns false for DB with no grantsCelestialMA charms", () => {
    const actor = makeActor("terrestrial", [
      makeCharm({ grantsCelestialMA: false }),
    ]);
    expect(canLearnCelestialMA(actor)).toBe(false);
  });

  it("returns true for DB with at least one grantsCelestialMA charm", () => {
    const actor = makeActor("terrestrial", [
      makeCharm({ grantsCelestialMA: false }),
      makeCharm({ grantsCelestialMA: true }),
    ]);
    expect(canLearnCelestialMA(actor)).toBe(true);
  });

  it("returns false for DB with empty items list", () => {
    expect(canLearnCelestialMA(makeActor("terrestrial"))).toBe(false);
  });
});

// ── canLearnSiderealMA ────────────────────────────────────────────────────────

describe("canLearnSiderealMA", () => {
  it("returns false for a celestial-capped exalt type (lunar)", () => {
    expect(canLearnSiderealMA(makeActor("lunar"))).toBe(false);
  });

  it("returns false for a celestial-capped exalt type (infernal)", () => {
    expect(canLearnSiderealMA(makeActor("infernal"))).toBe(false);
  });

  it("returns false for sidereal-tier exalt with no mastered celestial charm", () => {
    const actor = makeActor("sidereal", [
      makeCharm({ martialArtsTier: "celestial", grantsMastery: false }),
    ]);
    expect(canLearnSiderealMA(actor)).toBe(false);
  });

  it("returns true for sidereal-tier exalt with mastered celestial charm", () => {
    const actor = makeActor("sidereal", [
      makeCharm({ martialArtsTier: "celestial", grantsMastery: true }),
    ]);
    expect(canLearnSiderealMA(actor)).toBe(true);
  });

  it("returns false for sidereal-tier exalt with mastered terrestrial charm (wrong tier)", () => {
    const actor = makeActor("sidereal", [
      makeCharm({ martialArtsTier: "terrestrial", grantsMastery: true }),
    ]);
    expect(canLearnSiderealMA(actor)).toBe(false);
  });
});

// ── isWeaponValidForStyle ─────────────────────────────────────────────────────

describe("isWeaponValidForStyle", () => {
  it("passes when styleName is empty", () => {
    expect(isWeaponValidForStyle(makeWeapon("sword"), "", makeActor("solar"))).toBe(true);
  });

  it("passes when actor has anyMAWeapon AE", () => {
    const effects = [{ disabled: false, flags: { exalted2e: { anyMAWeapon: true } } }];
    const actor = makeActor("solar", [], effects);
    expect(isWeaponValidForStyle(makeWeapon("sword"), "Snake Style", actor)).toBe(true);
  });

  it("passes when weapon declares style in martialArtsStyles", () => {
    const weapon = makeWeapon("sword", { martialArtsStyles: ["Snake Style"] });
    const actor = makeActor("solar");
    expect(isWeaponValidForStyle(weapon, "Snake Style", actor)).toBe(true);
  });

  it("passes when weapon name is in style item weapons list", () => {
    const weapon = makeWeapon("short spear");
    const styleItem = makeStyleItem("Tiger Style", ["short spear", "unarmed"]);
    const actor = makeActorWithAbilities("solar", {}, [styleItem]);
    expect(isWeaponValidForStyle(weapon, "Tiger Style", actor)).toBe(true);
  });

  it("fails when weapon not in style list", () => {
    const weapon = makeWeapon("daiklave");
    const styleItem = makeStyleItem("Tiger Style", ["short spear", "unarmed"]);
    const actor = makeActorWithAbilities("solar", {}, [styleItem]);
    expect(isWeaponValidForStyle(weapon, "Tiger Style", actor)).toBe(false);
  });

  it("passes when no style item found (unknown style)", () => {
    const weapon = makeWeapon("sword");
    const actor = makeActor("solar");
    expect(isWeaponValidForStyle(weapon, "Unknown Style", actor)).toBe(true);
  });
});

// ── canBypassMinAbility ───────────────────────────────────────────────────────

describe("canBypassMinAbility", () => {
  it("returns false when charm has no Martial-ready keyword", () => {
    const actor = makeActorWithAbilities("solar", { martialArts: { caste: true } });
    const charm = makeCharm({ keywords: ["Martial"], ability: "martialArts" });
    expect(canBypassMinAbility(actor, charm)).toBe(false);
  });

  it("returns false when ability is not Caste or Favored", () => {
    const actor = makeActorWithAbilities("solar", {
      martialArts: { caste: false, favored: false },
    });
    const charm = makeCharm({ keywords: ["Martial-ready"], ability: "martialArts" });
    expect(canBypassMinAbility(actor, charm)).toBe(false);
  });

  it("returns true when ability is Caste", () => {
    const actor = makeActorWithAbilities("solar", {
      martialArts: { caste: true, favored: false },
    });
    const charm = makeCharm({ keywords: ["Martial-ready"], ability: "martialArts" });
    expect(canBypassMinAbility(actor, charm)).toBe(true);
  });

  it("returns true when ability is Favored", () => {
    const actor = makeActorWithAbilities("solar", {
      martialArts: { caste: false, favored: true },
    });
    const charm = makeCharm({ keywords: ["Martial-ready"], ability: "martialArts" });
    expect(canBypassMinAbility(actor, charm)).toBe(true);
  });
});
