import { describe, it, expect } from "vitest";
import { aggregatePenalties, sumPenalties } from "../../module/documents/penalties-math.mjs";

function effect({ id = "e", name = "Effect", disabled = false, flagKey = "dvPenalty", type, value } = {}) {
  return {
    id, name, disabled,
    flags: { exalted2e: type !== undefined ? { [flagKey]: { type, value } } : {} }
  };
}

// ── aggregatePenalties ───────────────────────────────────────────────
describe("aggregatePenalties", () => {
  it("collects rows from well-shaped effects", () => {
    const out = aggregatePenalties([
      effect({ id: "a", name: "Onslaught", flagKey: "dvPenalty", type: "all", value: 1 }),
      effect({ id: "b", name: "Stunned",   flagKey: "dvPenalty", type: "physical", value: 2 })
    ], "dvPenalty");
    expect(out).toEqual([
      { type: "all",      value: 1, effectId: "a", label: "Onslaught" },
      { type: "physical", value: 2, effectId: "b", label: "Stunned" }
    ]);
  });

  it("skips disabled effects", () => {
    const out = aggregatePenalties([
      effect({ id: "a", flagKey: "dvPenalty", type: "all", value: 1, disabled: true }),
      effect({ id: "b", flagKey: "dvPenalty", type: "all", value: 2 })
    ], "dvPenalty");
    expect(out).toHaveLength(1);
    expect(out[0].effectId).toBe("b");
  });

  it("skips effects with missing or malformed flags", () => {
    const out = aggregatePenalties([
      effect({ id: "no-flag" }),                                            // no payload
      { id: "no-flags-obj", disabled: false },                               // no flags object at all
      effect({ id: "no-type",  flagKey: "dvPenalty", value: 2 }),           // missing type
      effect({ id: "no-value", flagKey: "dvPenalty", type: "physical" }),   // missing value
      effect({ id: "non-num",  flagKey: "dvPenalty", type: "physical", value: "two" }),
      effect({ id: "nan",      flagKey: "dvPenalty", type: "physical", value: NaN }),
      effect({ id: "inf",      flagKey: "dvPenalty", type: "physical", value: Infinity }),
      effect({ id: "ok",       flagKey: "dvPenalty", type: "all",      value: 1 })
    ], "dvPenalty");
    expect(out.map(p => p.effectId)).toEqual(["ok"]);
  });

  it("uses the requested flagKey (mdvPenalty vs dvPenalty are independent)", () => {
    const effects = [
      effect({ id: "dv",  flagKey: "dvPenalty",  type: "all", value: 1 }),
      effect({ id: "mdv", flagKey: "mdvPenalty", type: "all", value: 2 })
    ];
    expect(aggregatePenalties(effects, "dvPenalty").map(p => p.effectId)).toEqual(["dv"]);
    expect(aggregatePenalties(effects, "mdvPenalty").map(p => p.effectId)).toEqual(["mdv"]);
  });
});

// ── sumPenalties ─────────────────────────────────────────────────────
describe("sumPenalties", () => {
  it("sums entries whose type matches the category", () => {
    const effects = [
      effect({ flagKey: "externalPenalty", type: "physical", value: 1 }),
      effect({ flagKey: "externalPenalty", type: "physical", value: 2 }),
      effect({ flagKey: "externalPenalty", type: "social",   value: 3 })
    ];
    expect(sumPenalties(effects, "externalPenalty", "physical")).toBe(3);   // 1 + 2, social skipped
  });

  it("'all' type counts toward every category", () => {
    const effects = [
      effect({ flagKey: "externalPenalty", type: "all",      value: 1 }),
      effect({ flagKey: "externalPenalty", type: "physical", value: 2 })
    ];
    expect(sumPenalties(effects, "externalPenalty", "social")).toBe(1);     // only "all" matches social
    expect(sumPenalties(effects, "externalPenalty", "physical")).toBe(3);   // all + physical
  });

  it("returns 0 for empty / undefined effects collection", () => {
    expect(sumPenalties([], "externalPenalty", "physical")).toBe(0);
    expect(sumPenalties(undefined, "externalPenalty", "physical")).toBe(0);
  });
});
