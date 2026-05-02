import { describe, it, expect } from "vitest";
import { AnimaPowerData } from "../../module/data/item/anima-power-data.mjs";

describe("AnimaPowerData schema", () => {
  it("defines all expected top-level fields", () => {
    const schema = AnimaPowerData.defineSchema();
    expect(Object.keys(schema)).toEqual(expect.arrayContaining([
      "exaltType", "caste", "summary", "active",
      "activationCost", "bonfireOverride", "totemicOverride",
      "autoThreshold", "description"
    ]));
  });

  it("bonfireOverride SchemaField has enabled and motes sub-fields", () => {
    const schema = AnimaPowerData.defineSchema();
    const inner = schema.bonfireOverride.config ?? schema.bonfireOverride.options ?? {};
    expect(inner).toHaveProperty("enabled");
    expect(inner).toHaveProperty("motes");
  });

  it("activationCost SchemaField has motes and willpower sub-fields", () => {
    const schema = AnimaPowerData.defineSchema();
    const inner = schema.activationCost.config ?? schema.activationCost.options ?? {};
    expect(inner).toHaveProperty("motes");
    expect(inner).toHaveProperty("willpower");
  });
});
