import { describe, it, expect, beforeAll } from "vitest";
import { MaladosData } from "../../module/data/item/malados-data.mjs";

describe("MaladosData schema — spiritName", () => {
  let schema;
  beforeAll(() => { schema = MaladosData.defineSchema(); });

  it("field exists", () => {
    expect(schema.spiritName).toBeDefined();
  });

  it("defaults to empty string", () => {
    const initial = schema.spiritName.getInitialValue?.() ?? schema.spiritName.options?.initial;
    expect(initial).toBe("");
  });
});

describe("MaladosData schema — essenceRating", () => {
  let schema;
  beforeAll(() => { schema = MaladosData.defineSchema(); });

  it("field exists", () => {
    expect(schema.essenceRating).toBeDefined();
  });

  it("defaults to 1", () => {
    const initial = schema.essenceRating.getInitialValue?.() ?? schema.essenceRating.options?.initial;
    expect(initial).toBe(1);
  });

  it("minimum is 1", () => {
    expect(schema.essenceRating.options?.min).toBe(1);
  });

  it("maximum is 10", () => {
    expect(schema.essenceRating.options?.max).toBe(10);
  });

  it("is integer", () => {
    expect(schema.essenceRating.options?.integer).toBe(true);
  });
});
