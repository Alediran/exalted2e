import { describe, it, expect } from "vitest";
import {
  _greaterSignPrereqMet,
  dedupStackableCharms,
  animaPowerCost,
  buildPurchaseLogRows,
  buildEffectsData,
  buildAbilityGroups,
} from "../../module/helpers/character-sheet-helpers.mjs";

const gsActor = (essence, colleges) => ({ system: { essence: { value: essence }, splat: { sidereal: { colleges: { journeys: colleges } } } } });

describe("_greaterSignPrereqMet", () => {
  it("requires essence >= 4", () => {
    expect(_greaterSignPrereqMet(gsActor(3, { a: 15 }), "journeys")).toBe(false);
    expect(_greaterSignPrereqMet(gsActor(4, { a: 15 }), "journeys")).toBe(true);
  });
  it("requires the caste's college sum >= 15", () => {
    expect(_greaterSignPrereqMet(gsActor(5, { a: 7, b: 7 }), "journeys")).toBe(false); // 14
    expect(_greaterSignPrereqMet(gsActor(5, { a: 8, b: 7 }), "journeys")).toBe(true);  // 15
  });
  it("missing essence/colleges default to 0 / empty", () => {
    expect(_greaterSignPrereqMet({ system: {} }, "journeys")).toBe(false);
  });
});

const charm = (id, name, over = {}) => ({ id, name, system: { duration: "permanent", keywords: ["Stackable"], ...over } });

describe("dedupStackableCharms", () => {
  it("collapses same-named permanent Stackable charms, counting duplicates", () => {
    const out = dedupStackableCharms([charm("a", "Ox"), charm("b", "Ox"), charm("c", "Ox")]);
    expect(out.stackCounts).toEqual({ a: 3 });
    expect([...out.stackHidden]).toEqual(["b", "c"]);
  });
  it("ignores non-permanent or non-Stackable charms", () => {
    const out = dedupStackableCharms([
      charm("a", "Ox", { duration: "instant" }),
      charm("b", "Ox", { keywords: [] }),
      charm("c", "Wits", {}),
    ]);
    expect(out.stackCounts).toEqual({});
    expect([...out.stackHidden]).toEqual([]);
  });
});

const animaSys = (over) => ({ activationCost: { motes: 5, willpower: 1 }, autoThreshold: "", totemicOverride: { enabled: false, motes: 0 }, bonfireOverride: { enabled: false, motes: 0 }, ...over });

describe("animaPowerCost", () => {
  it("default: returns the base activation cost", () => {
    expect(animaPowerCost(animaSys({}), "glowing")).toEqual({ motes: 5, willpower: 1 });
  });
  it("autoThreshold met → free", () => {
    expect(animaPowerCost(animaSys({ autoThreshold: "bonfire" }), "bonfire")).toEqual({ motes: 0, willpower: 0 });
  });
  it("totemic override at totemic anima → override motes, 0 wp", () => {
    expect(animaPowerCost(animaSys({ totemicOverride: { enabled: true, motes: 2 } }), "totemic")).toEqual({ motes: 2, willpower: 0 });
  });
  it("bonfire override at >= bonfire anima → override motes, 0 wp", () => {
    expect(animaPowerCost(animaSys({ bonfireOverride: { enabled: true, motes: 3 } }), "totemic")).toEqual({ motes: 3, willpower: 0 });
  });
  it("autoThreshold wins over an enabled bonfire override at the same anima level", () => {
    expect(animaPowerCost(animaSys({ autoThreshold: "bonfire", bonfireOverride: { enabled: true, motes: 3 } }), "totemic"))
      .toEqual({ motes: 0, willpower: 0 });
  });
});

describe("buildPurchaseLogRows", () => {
  it("flags overdraft once the running sum exceeds totalEarned, newest-first", () => {
    const log = [
      { traitLabel: "A", xpCost: 5, timestamp: 1 },
      { traitLabel: "B", xpCost: 5, timestamp: 2 },
      { traitLabel: "C", xpCost: 5, timestamp: 3 },
    ];
    const rows = buildPurchaseLogRows(log, 8);
    expect(rows.map(r => [r.traitLabel, r.overdraft])).toEqual([["C", true], ["B", true], ["A", false]]);
    expect(rows.map(r => r.index)).toEqual([2, 1, 0]);
  });
  it("empty log → empty array", () => {
    expect(buildPurchaseLogRows([], 0)).toEqual([]);
  });
});

const loc = k => `L(${k})`;
const eff = (id, name, over = {}) => ({ id, name, img: "", disabled: false, isTemporary: false, duration: {}, flags: { exalted2e: {} }, ...over });

describe("buildEffectsData", () => {
  it("splits temporal vs permanent, sorted by name; refreshable → until-next-turn label", () => {
    const out = buildEffectsData([
      eff("p", "Zed"),
      eff("t", "Able", { flags: { exalted2e: { dvRefreshable: true } } }),
    ], {}, loc);
    expect(out.temporal.map(e => e.id)).toEqual(["t"]);
    expect(out.permanent.map(e => e.id)).toEqual(["p"]);
    expect(out.temporal[0].durationLabel).toBe("L(EX2E.EffectUntilNextTurn)");
  });
  it("groups permanent stackable effects by name with xN suffix", () => {
    const mk = (id) => eff(id, "Aura", { flags: { exalted2e: { charmStackable: true } } });
    const out = buildEffectsData([mk("a"), mk("b"), mk("c")], {}, loc);
    expect(out.permanent).toHaveLength(1);
    expect(out.permanent[0].name).toBe("Aura x3");
  });
  it("a non-permanent charmDuration is temporal and labelled via the durations map", () => {
    const out = buildEffectsData(
      [eff("s", "Scene FX", { flags: { exalted2e: { charmDuration: "scene" } } })],
      { scene: "EX2E.DurationScene" },
      loc,
    );
    expect(out.temporal.map(e => e.id)).toEqual(["s"]);
    expect(out.temporal[0].durationLabel).toBe("L(EX2E.DurationScene)");
  });
  it("non-refreshable, no charmDuration → falls back to the effect's own duration.label", () => {
    const out = buildEffectsData([eff("d", "Timed", { isTemporary: true, duration: { label: "3 rounds" } })], {}, loc);
    expect(out.temporal[0].durationLabel).toBe("3 rounds");
  });
});

const cfg = {
  abilityLabels: { melee: "EX2E.Melee", war: "EX2E.War", craft: "EX2E.Craft" },
  abilities: ["melee", "war", "craft"],
  abilityGroups: { solar: [{ key: "g1", label: "EX2E.G1", abilities: ["melee", "war"] }] },
};
const agSys = { exaltType: "solar", caste: "g1", abilities: { melee: { value: 3, caste: true, favored: false, specialties: [] }, war: { value: 1 }, craft: { value: 2 } } };

describe("buildAbilityGroups", () => {
  it("maps group defs to labelled rows + isCurrentCaste, with an 'other' bucket for ungrouped", () => {
    const groups = buildAbilityGroups(agSys, cfg, k => k);
    expect(groups[0].key).toBe("g1");
    expect(groups[0].isCurrentCaste).toBe(true);
    expect(groups[0].abilities.map(a => a.key)).toEqual(["melee", "war"]);
    expect(groups[0].abilities[0]).toMatchObject({ key: "melee", value: 3, caste: true, fieldBase: "system.abilities.melee" });
    const other = groups.find(g => g.key === "other");
    expect(other.abilities.map(a => a.key)).toEqual(["craft"]);
  });
  it("falls back to abilityGroups.mortal for unknown exalt types", () => {
    const cfg2 = { ...cfg, abilityGroups: { mortal: [{ key: "m", label: "EX2E.M", abilities: ["melee"] }] } };
    const groups = buildAbilityGroups({ ...agSys, exaltType: "unknown" }, cfg2, k => k);
    expect(groups[0].key).toBe("m");
  });
});
