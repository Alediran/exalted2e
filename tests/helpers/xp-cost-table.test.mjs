import { describe, it, expect } from "vitest";
import { buildXpCostRows } from "../../module/helpers/xp-cost-table.mjs";
import { XP_COST_DEFAULTS } from "../../module/helpers/xp-cost-defaults.mjs";

// game.i18n.localize returns the key unchanged in the test environment,
// so formula tokens are the raw i18n keys (e.g. "EX2E.XPFormulaCurrent").
const CURRENT = "EX2E.XPFormulaCurrent";
const PER_DOT = "EX2E.XPFormulaPerDot";

function rowKeys(rows) {
  return rows.map(r => r.traitKey);
}

describe("buildXpCostRows — universal rows present for every type", () => {
  for (const exaltType of ["solar","abyssal","lunar","sidereal","terrestrial","alchemical","infernal","mortal"]) {
    it(`${exaltType} includes Attribute, AbilityFav, AbilityOther, AbilityNew, Specialty, Willpower, Virtue`, () => {
      const rows = buildXpCostRows(exaltType, XP_COST_DEFAULTS);
      const keys = rowKeys(rows);
      expect(keys).toContain("EX2E.XPTableTraitAttribute");
      expect(keys).toContain("EX2E.XPTableTraitAbilityFav");
      expect(keys).toContain("EX2E.XPTableTraitAbilityOther");
      expect(keys).toContain("EX2E.XPTableTraitAbilityNew");
      expect(keys).toContain("EX2E.XPTableTraitSpecialty");
      expect(keys).toContain("EX2E.XPTableTraitWillpower");
      expect(keys).toContain("EX2E.XPTableTraitVirtue");
    });
  }
});

describe("buildXpCostRows — AttributeFav row present only for lunar and alchemical", () => {
  it("lunar includes AttributeFav", () => {
    const keys = rowKeys(buildXpCostRows("lunar", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitAttributeFav");
  });

  it("alchemical includes AttributeFav", () => {
    const keys = rowKeys(buildXpCostRows("alchemical", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitAttributeFav");
  });

  it("solar does NOT include AttributeFav", () => {
    const keys = rowKeys(buildXpCostRows("solar", XP_COST_DEFAULTS));
    expect(keys).not.toContain("EX2E.XPTableTraitAttributeFav");
  });

  it("terrestrial does NOT include AttributeFav", () => {
    const keys = rowKeys(buildXpCostRows("terrestrial", XP_COST_DEFAULTS));
    expect(keys).not.toContain("EX2E.XPTableTraitAttributeFav");
  });
});

describe("buildXpCostRows — mortal gets Background but no Essence or charm rows", () => {
  it("includes Background", () => {
    const keys = rowKeys(buildXpCostRows("mortal", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitBackground");
  });

  it("does NOT include Essence", () => {
    const keys = rowKeys(buildXpCostRows("mortal", XP_COST_DEFAULTS));
    expect(keys).not.toContain("EX2E.XPTableTraitEssence");
  });
});

describe("buildXpCostRows — solar-specific rows", () => {
  it("includes CharmFav, CharmOther, SpellFav, SpellOther, ForeignCharm, SiderealMAFav, SiderealMAOther", () => {
    const keys = rowKeys(buildXpCostRows("solar", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitCharmFav");
    expect(keys).toContain("EX2E.XPTableTraitCharmOther");
    expect(keys).toContain("EX2E.XPTableTraitSpellFav");
    expect(keys).toContain("EX2E.XPTableTraitSpellOther");
    expect(keys).toContain("EX2E.XPTableTraitForeignCharm");
    expect(keys).toContain("EX2E.XPTableTraitSiderealMAFav");
    expect(keys).toContain("EX2E.XPTableTraitSiderealMAOther");
  });

  it("does NOT include Knack or College rows", () => {
    const keys = rowKeys(buildXpCostRows("solar", XP_COST_DEFAULTS));
    expect(keys).not.toContain("EX2E.XPTableTraitKnack");
    expect(keys).not.toContain("EX2E.XPTableTraitCollegeNew");
  });
});

describe("buildXpCostRows — abyssal mirrors solar rows", () => {
  it("has the same row keys as solar", () => {
    const solarKeys = rowKeys(buildXpCostRows("solar", XP_COST_DEFAULTS)).sort();
    const abyssalKeys = rowKeys(buildXpCostRows("abyssal", XP_COST_DEFAULTS)).sort();
    expect(abyssalKeys).toEqual(solarKeys);
  });
});

describe("buildXpCostRows — lunar-specific rows", () => {
  it("includes Knack but not ForeignCharm or SiderealMA rows", () => {
    const keys = rowKeys(buildXpCostRows("lunar", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitKnack");
    expect(keys).not.toContain("EX2E.XPTableTraitForeignCharm");
    expect(keys).not.toContain("EX2E.XPTableTraitSiderealMAFav");
  });
});

describe("buildXpCostRows — sidereal-specific rows", () => {
  it("includes CollegeNew and CollegePerDot", () => {
    const keys = rowKeys(buildXpCostRows("sidereal", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitCollegeNew");
    expect(keys).toContain("EX2E.XPTableTraitCollegePerDot");
  });
});

describe("buildXpCostRows — terrestrial-specific rows", () => {
  it("includes CelestialMAAspect, CelestialMANonAspect, MAUnfavored", () => {
    const keys = rowKeys(buildXpCostRows("terrestrial", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitCelestialMAAspect");
    expect(keys).toContain("EX2E.XPTableTraitCelestialMANonAspect");
    expect(keys).toContain("EX2E.XPTableTraitMAUnfavored");
  });
});

describe("buildXpCostRows — alchemical-specific rows", () => {
  it("includes CharmFlat, MartialArtsCharm, slot rows, and protocol rows", () => {
    const keys = rowKeys(buildXpCostRows("alchemical", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitCharmFlat");
    expect(keys).toContain("EX2E.XPTableTraitMartialArtsCharm");
    expect(keys).toContain("EX2E.XPTableTraitCharmSlotGeneral");
    expect(keys).toContain("EX2E.XPTableTraitCharmSlotDedicated");
    expect(keys).toContain("EX2E.XPTableTraitCharmSlotUpgrade");
    expect(keys).toContain("EX2E.XPTableTraitProtocolManMachine");
    expect(keys).toContain("EX2E.XPTableTraitProtocolGodMachine");
  });

  it("does NOT include favored/other charm split rows used by solar/lunar/etc.", () => {
    const keys = rowKeys(buildXpCostRows("alchemical", XP_COST_DEFAULTS));
    expect(keys).not.toContain("EX2E.XPTableTraitCharmFav");
    expect(keys).not.toContain("EX2E.XPTableTraitCharmOther");
  });
});

describe("buildXpCostRows — infernal-specific rows", () => {
  it("includes CharmPatron, CharmNonPatron, MAFavored, MAOther, SorcerySpell", () => {
    const keys = rowKeys(buildXpCostRows("infernal", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitCharmPatron");
    expect(keys).toContain("EX2E.XPTableTraitCharmNonPatron");
    expect(keys).toContain("EX2E.XPTableTraitMAFavored");
    expect(keys).toContain("EX2E.XPTableTraitMAOther");
    expect(keys).toContain("EX2E.XPTableTraitSorcerySpell");
  });
});

describe("buildXpCostRows — unknown exalt type returns only universal rows", () => {
  it("still has Attribute, Ability, Essence rows but no charm-specific rows", () => {
    const keys = rowKeys(buildXpCostRows("dragon", XP_COST_DEFAULTS));
    expect(keys).toContain("EX2E.XPTableTraitAttribute");
    expect(keys).not.toContain("EX2E.XPTableTraitCharmFav");
  });
});

describe("buildXpCostRows — cost values use defaults when costs is null/undefined", () => {
  it("falls back to hardcoded defaults when costs is null", () => {
    const rows = buildXpCostRows("solar", null);
    const attrRow = rows.find(r => r.traitKey === "EX2E.XPTableTraitAttribute");
    // _n(undefined, 4) → 4; formula = "EX2E.XPFormulaCurrent × 4"
    expect(attrRow.cost).toBe(`${CURRENT} × 4`);
  });
});

describe("buildXpCostRows — cost formula strings are correctly composed", () => {
  it("Attribute: current × mult", () => {
    const rows = buildXpCostRows("solar", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitAttribute");
    expect(row.cost).toBe(`${CURRENT} × 4`);
  });

  it("Solar AbilityFav: current × 2 − 1 (mult=2, sub=1)", () => {
    const rows = buildXpCostRows("solar", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitAbilityFav");
    expect(row.cost).toBe(`${CURRENT} × 2 − 1`);
  });

  it("Terrestrial AbilityFav: current × 1 (sub=0 suppresses subtraction)", () => {
    const rows = buildXpCostRows("terrestrial", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitAbilityFav");
    expect(row.cost).toBe(`${CURRENT} × 1`);
  });

  it("AbilityNew: flat XP", () => {
    const rows = buildXpCostRows("solar", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitAbilityNew");
    expect(row.cost).toBe("3 XP");
  });

  it("Background: flat per dot with per-dot token", () => {
    const rows = buildXpCostRows("solar", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitBackground");
    expect(row.cost).toBe(`3 XP ${PER_DOT}`);
  });

  it("Sidereal CollegePerDot: current × mult per-dot", () => {
    const rows = buildXpCostRows("sidereal", XP_COST_DEFAULTS);
    const row = rows.find(r => r.traitKey === "EX2E.XPTableTraitCollegePerDot");
    expect(row.cost).toBe(`${CURRENT} × 3 ${PER_DOT}`);
  });

  it("each row has matching traitKey and trainingKey suffix", () => {
    const rows = buildXpCostRows("solar", XP_COST_DEFAULTS);
    for (const row of rows) {
      const suffix = row.traitKey.replace("EX2E.XPTableTrait", "");
      expect(row.trainingKey).toBe(`EX2E.XPTraining${suffix}`);
    }
  });
});
