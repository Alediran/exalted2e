import { describe, it, expect } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";
import { WeaponData } from "../../module/data/item/weapon-data.mjs";

describe("item schemas expose a descriptions override map", () => {
  it("CharmData.defineSchema() includes a descriptions field alongside description", () => {
    const schema = CharmData.defineSchema();
    expect(schema.description).toBeDefined();
    expect(schema.descriptions).toBeDefined();
  });
  it("WeaponData too", () => {
    expect(WeaponData.defineSchema().descriptions).toBeDefined();
  });
});
