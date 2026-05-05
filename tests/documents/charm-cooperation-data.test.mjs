import { describe, it, expect } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";

describe("CharmData.cooperationBonusDice", () => {
  it("is present in the schema with initial=0, integer=true, min=0", () => {
    const schema = CharmData.defineSchema();
    expect(schema).toHaveProperty("cooperationBonusDice");
    const field = schema.cooperationBonusDice;
    expect(field.options?.initial).toBe(0);
    expect(field.options?.integer).toBe(true);
    expect(field.options?.min).toBe(0);
  });
});
