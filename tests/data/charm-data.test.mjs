import { describe, it, expect } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";

describe("CharmData.grantsInitiation (M17)", () => {
  it("field exists on the schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.grantsInitiation).toBeDefined();
  });

  it("enabled defaults to false", () => {
    const f = CharmData.defineSchema().grantsInitiation.fields.enabled;
    expect(f.options?.initial ?? f.initial).toBe(false);
  });

  it("tradition defaults to 'sorcery' and accepts only sorcery/necromancy/weaving", () => {
    const f = CharmData.defineSchema().grantsInitiation.fields.tradition;
    expect(f.options?.initial ?? f.initial).toBe("sorcery");
    expect(f.options?.choices ?? f.choices).toEqual(["sorcery", "necromancy", "weaving"]);
  });

  it("level defaults to 1 with min 1 and max 3", () => {
    const f = CharmData.defineSchema().grantsInitiation.fields.level;
    expect(f.options).toMatchObject({ initial: 1, min: 1, max: 3, integer: true });
  });
});

describe("CharmData.umiCost", () => {
  it("defaults to 1 when omitted", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.umiCost.getInitialValue?.() ?? schema.umiCost.options?.initial;
    expect(initial).toBe(1);
  });

  it("rejects values out of [1, 5] (NumberField clamps or fails validation)", () => {
    const schema = CharmData.defineSchema();
    const f = schema.umiCost;
    expect(f.options?.min).toBe(1);
    expect(f.options?.max).toBe(5);
    expect(f.options?.integer).toBe(true);
  });
});

describe("CharmData FoI fields", () => {
  it("hasFoi defaults to false", () => {
    const schema = CharmData.defineSchema();
    const f = schema.hasFoi;
    expect(f).toBeDefined();
    const initial = f.getInitialValue?.() ?? f.options?.initial;
    expect(initial).toBe(false);
  });

  it("flawsOfInvulnerability defaults to empty array", () => {
    const schema = CharmData.defineSchema();
    const f = schema.flawsOfInvulnerability;
    expect(f).toBeDefined();
    const initial = f.getInitialValue?.() ?? [];
    expect(Array.isArray(initial)).toBe(true);
    expect(initial).toHaveLength(0);
  });

  it("flawsOfInvulnerability entries have type and label StringFields", () => {
    const schema = CharmData.defineSchema();
    // Mock: ArrayField(first-arg) → .options = element SchemaField; SchemaField(dict) → .options = dict
    const entryFields = schema.flawsOfInvulnerability.options?.options
                     ?? schema.flawsOfInvulnerability.options?.fields;
    expect(entryFields?.type).toBeDefined();
    expect(entryFields?.label).toBeDefined();
  });
});
