import { describe, it, expect } from "vitest";
import { XP_COST_DEFAULTS, resolveXpCosts, XP_COST_EXALT_ORDER }
  from "../../module/helpers/xp-cost-defaults.mjs";

describe("XP_COST_DEFAULTS", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(XP_COST_DEFAULTS)).toBe(true);
  });

  it("contains a general section with expected keys", () => {
    const g = XP_COST_DEFAULTS.general;
    expect(g.attributeMult).toBe(4);
    expect(g.abilityNewFlat).toBe(3);
    expect(g.specialtyFlat).toBe(3);
    expect(g.willpowerMult).toBe(2);
    expect(g.virtueMult).toBe(3);
    expect(g.backgroundFlat).toBe(3);
  });

  it("contains all seven exalt-type sections", () => {
    for (const t of ["solar","abyssal","lunar","sidereal","terrestrial","alchemical","infernal"]) {
      expect(XP_COST_DEFAULTS).toHaveProperty(t);
    }
  });
});

describe("XP_COST_EXALT_ORDER", () => {
  it("is frozen and has seven entries", () => {
    expect(Object.isFrozen(XP_COST_EXALT_ORDER)).toBe(true);
    expect(XP_COST_EXALT_ORDER.length).toBe(7);
  });

  it("contains all expected exalt types", () => {
    expect(XP_COST_EXALT_ORDER).toContain("solar");
    expect(XP_COST_EXALT_ORDER).toContain("alchemical");
  });
});

describe("resolveXpCosts — null / falsy overrides return defaults", () => {
  it("null → defaults", () => {
    const r = resolveXpCosts(null);
    expect(r.general.attributeMult).toBe(4);
    expect(r.solar.charmFavored).toBe(8);
  });

  it("undefined → defaults", () => {
    const r = resolveXpCosts(undefined);
    expect(r.general.willpowerMult).toBe(2);
  });

  it("non-object string → defaults", () => {
    const r = resolveXpCosts("bad");
    expect(r.general.attributeMult).toBe(4);
  });
});

describe("resolveXpCosts — partial overrides merge correctly", () => {
  it("overrides a single key in general, leaving others at defaults", () => {
    const r = resolveXpCosts({ general: { attributeMult: 5 } });
    expect(r.general.attributeMult).toBe(5);
    expect(r.general.willpowerMult).toBe(2);   // unchanged
    expect(r.solar.charmFavored).toBe(8);      // unchanged
  });

  it("overrides a charm cost in one exalt type without touching another", () => {
    const r = resolveXpCosts({ solar: { charmFavored: 6 } });
    expect(r.solar.charmFavored).toBe(6);
    expect(r.abyssal.charmFavored).toBe(8);    // unchanged
  });

  it("can override multiple sections at once", () => {
    const r = resolveXpCosts({
      general: { virtueMult: 4 },
      lunar:   { knack: 9 }
    });
    expect(r.general.virtueMult).toBe(4);
    expect(r.lunar.knack).toBe(9);
    expect(r.solar.charmFavored).toBe(8);      // untouched
  });
});

describe("resolveXpCosts — invalid override values fall back to defaults", () => {
  it("empty string falls back", () => {
    const r = resolveXpCosts({ general: { attributeMult: "" } });
    expect(r.general.attributeMult).toBe(4);
  });

  it("null value falls back", () => {
    const r = resolveXpCosts({ general: { attributeMult: null } });
    expect(r.general.attributeMult).toBe(4);
  });

  it("undefined value falls back", () => {
    const r = resolveXpCosts({ general: { attributeMult: undefined } });
    expect(r.general.attributeMult).toBe(4);
  });

  it("NaN falls back", () => {
    const r = resolveXpCosts({ general: { attributeMult: NaN } });
    expect(r.general.attributeMult).toBe(4);
  });

  it("Infinity falls back", () => {
    const r = resolveXpCosts({ general: { attributeMult: Infinity } });
    expect(r.general.attributeMult).toBe(4);
  });

  it("numeric string '5' is coerced and accepted", () => {
    const r = resolveXpCosts({ general: { attributeMult: "5" } });
    expect(r.general.attributeMult).toBe(5);
  });
});

describe("resolveXpCosts — deep-clone safety", () => {
  it("mutating the result does not affect XP_COST_DEFAULTS", () => {
    const r = resolveXpCosts(null);
    r.general.attributeMult = 999;
    expect(XP_COST_DEFAULTS.general.attributeMult).toBe(4);
  });

  it("two calls return independent objects", () => {
    const a = resolveXpCosts(null);
    const b = resolveXpCosts(null);
    a.solar.charmFavored = 1;
    expect(b.solar.charmFavored).toBe(8);
  });
});

describe("resolveXpCosts — unknown section keys are ignored", () => {
  it("unknown section in overrides does not appear in result", () => {
    const r = resolveXpCosts({ dragon: { charmFavored: 5 } });
    expect(r).not.toHaveProperty("dragon");
  });
});
