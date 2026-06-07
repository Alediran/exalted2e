import { describe, it, expect } from "vitest";
import { buildCharmCostPreview, buildCharmOptions, buildTraitOptions, buildStatBoostPaths }
  from "../../module/helpers/charm-sheet-helpers.mjs";

describe("buildCharmCostPreview", () => {
  it("null parse → empty string", () => { expect(buildCharmCostPreview(null)).toBe(""); });
  it("parsed-but-empty → ✓", () => { expect(buildCharmCostPreview({})).toBe("✓"); });
  it("assembles all components in order", () => {
    const parsed = {
      motes: 5, moteVar: { type: "perUnit", rate: 1, unit: "die" },
      willpower: 1, lethalHealth: 2, bashingHealth: 3, aggravatedHealth: 4, xp: 6,
      permanentEssence: 1, permanentWillpower: 1, surcharge: [{}, {}],
    };
    expect(buildCharmCostPreview(parsed)).toBe(
      "5m base · 1m/die · 1wp · 2lhl · 3bhl · 4ahl · 6xp · perm ess · perm wp · surcharge (2 opt)"
    );
  });
  it("open-ended and tiered moteVar variants", () => {
    expect(buildCharmCostPreview({ moteVar: { type: "openEnded" } })).toBe("open-ended");
    expect(buildCharmCostPreview({ moteVar: { type: "tiered", tiers: [1, 2, 3] } })).toBe("3 tiers");
  });
});

describe("buildCharmOptions", () => {
  const c = (id, uid, name, type = "charm") => ({ id, name, type, system: { charmUid: uid } });
  it("dedups by uid across sources, skips current, sorts by name", () => {
    const actor = [c("a1", "u-zed", "Zed"), c("self", "u-self", "Self")];
    const world = [c("w1", "u-zed", "ZedDup"), c("w2", "u-able", "Able")];
    const packs = [{ _id: "p1", type: "charm", name: "Mid" }];
    expect(buildCharmOptions(actor, world, packs, "self")).toEqual([
      { uid: "u-able", name: "Able" },
      { uid: "p1",     name: "Mid"  },
      { uid: "u-zed",  name: "Zed"  },
    ]);
  });
  it("ignores non-charm items and blank uids", () => {
    const actor = [c("a1", "", "NoUid"), { id: "a2", name: "Wpn", type: "weapon", system: {} }];
    expect(buildCharmOptions(actor, [], [], "x")).toEqual([]);
  });
});

describe("buildTraitOptions / buildStatBoostPaths", () => {
  const config = {
    attributes: { physical: { strength: "EX2E.Str" } },
    abilities: ["melee"],
    abilityLabels: { melee: "EX2E.Melee" },
  };
  const loc = k => `L(${k})`;
  it("buildTraitOptions returns bare-key attribute + ability options", () => {
    expect(buildTraitOptions(config, loc)).toEqual({
      attributeOptions: [{ value: "strength", label: "L(EX2E.Str)" }],
      abilityOptions:   [{ value: "melee",    label: "L(EX2E.Melee)" }],
    });
  });
  it("buildStatBoostPaths returns system.* paths", () => {
    expect(buildStatBoostPaths(config, loc)).toEqual([
      { value: "system.attributes.strength.value", label: "L(EX2E.Str)" },
      { value: "system.abilities.melee.value",      label: "L(EX2E.Melee)" },
    ]);
  });
});
