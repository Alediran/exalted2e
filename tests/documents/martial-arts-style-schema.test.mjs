import { describe, it, expect, beforeAll } from "vitest";
import { MartialArtsStyleData } from "../../module/data/item/martial-arts-style-data.mjs";

describe("MartialArtsStyleData schema", () => {
  let schema;
  beforeAll(() => { schema = MartialArtsStyleData.defineSchema(); });

  it("has tier field defaulting to terrestrial", () => {
    expect(schema).toHaveProperty("tier");
    expect(schema.tier.initial).toBe("terrestrial");
    expect(schema.tier.options.choices).toEqual(["terrestrial", "celestial", "sidereal"]);
  });
  it("has nativeExaltType as a blank StringField", () => {
    expect(schema).toHaveProperty("nativeExaltType");
    expect(schema.nativeExaltType.options.blank).toBe(true);
  });
  it("has weapons as an ArrayField", () => {
    expect(schema).toHaveProperty("weapons");
    // Verify that weapons is now an ArrayField (has .options property typical of ArrayField)
    // and check that it doesn't have the "blank" property that StringField had
    expect(schema.weapons.options).toBeDefined();
    expect(schema.weapons.options.blank).toBeUndefined();
  });
  it("has allowsArmor defaulting to true", () => {
    expect(schema).toHaveProperty("allowsArmor");
    expect(schema.allowsArmor.initial).toBe(true);
  });
  it("has description as HTMLField", () => {
    expect(schema).toHaveProperty("description");
  });
});
