import { describe, it, expect } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";

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
