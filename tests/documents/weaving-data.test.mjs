import { describe, it, expect } from "vitest";
import { SpellData } from "../../module/data/item/spell-data.mjs";
import { CharacterData } from "../../module/data/actor/character-data.mjs";

describe("SpellData.minimumClarity", () => {
  it("is present in the schema with initial=0, min=0, integer=true", () => {
    const schema = SpellData.defineSchema();
    expect(schema).toHaveProperty("minimumClarity");
    const field = schema.minimumClarity;
    expect(field.options?.initial).toBe(0);
    expect(field.options?.min).toBe(0);
    expect(field.options?.integer).toBe(true);
  });
});

describe("SpellData.tradition", () => {
  it("includes 'weaving' in choices", () => {
    const schema = SpellData.defineSchema();
    expect(schema.tradition.options.choices).toContain("weaving");
  });
});

describe("CharacterData.weaving.initiation", () => {
  it("is present in the schema with initial=0, min=0, max=2, integer=true", () => {
    const schema = CharacterData.defineSchema();
    const field  = schema.weaving?.config?.initiation;
    expect(field).toBeDefined();
    expect(field.options?.initial).toBe(0);
    expect(field.options?.min).toBe(0);
    expect(field.options?.max).toBe(2);
    expect(field.options?.integer).toBe(true);
  });
});
