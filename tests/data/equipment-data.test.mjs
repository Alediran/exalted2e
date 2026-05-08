import { describe, it, expect } from "vitest";
import { EquipmentData } from "../../module/data/item/equipment-data.mjs";

describe("EquipmentData schema", () => {
  let schema;
  beforeAll(() => { schema = EquipmentData.defineSchema(); });

  it("resourcesCost: min 0, max 5, integer, initial 0", () => {
    expect(schema.resourcesCost.options).toMatchObject({ min: 0, max: 5, integer: true, initial: 0 });
  });

  it("quantity: min 1, max 999, integer, initial 1", () => {
    expect(schema.quantity.options).toMatchObject({ min: 1, max: 999, integer: true, initial: 1 });
  });

  it("description: HTMLField with initial empty string", () => {
    expect(schema.description.options.initial).toBe("");
  });

  it("equipped: BooleanField initial false", () => {
    expect(schema.equipped.options.initial).toBe(false);
  });

  it("schema has exactly four fields", () => {
    expect(Object.keys(schema)).toEqual(["resourcesCost", "quantity", "description", "equipped"]);
  });
});
