import { describe, it, expect, beforeAll } from "vitest";
import { AmmoData } from "../../module/data/item/ammo-data.mjs";

describe("AmmoData schema — ammoType", () => {
  let schema;
  beforeAll(() => { schema = AmmoData.defineSchema(); });

  it("field exists", () => {
    expect(schema.ammoType).toBeDefined();
  });

  it("defaults to 'arrows'", () => {
    const initial = schema.ammoType.getInitialValue?.() ?? schema.ammoType.options?.initial;
    expect(initial).toBe("arrows");
  });

  it("choices include arrows and firedust", () => {
    const choices = schema.ammoType.options?.choices ?? schema.ammoType.choices;
    expect(choices).toContain("arrows");
    expect(choices).toContain("firedust");
  });
});

describe("AmmoData schema — quantity", () => {
  let schema;
  beforeAll(() => { schema = AmmoData.defineSchema(); });

  it("field exists", () => {
    expect(schema.quantity).toBeDefined();
  });

  it("defaults to 0", () => {
    const initial = schema.quantity.getInitialValue?.() ?? schema.quantity.options?.initial;
    expect(initial).toBe(0);
  });

  it("minimum is 0", () => {
    expect(schema.quantity.options?.min).toBe(0);
  });

  it("is integer", () => {
    expect(schema.quantity.options?.integer).toBe(true);
  });
});

describe("AmmoData schema — damageBonus", () => {
  let schema;
  beforeAll(() => { schema = AmmoData.defineSchema(); });

  it("field exists", () => {
    expect(schema.damageBonus).toBeDefined();
  });

  it("defaults to 0", () => {
    const initial = schema.damageBonus.getInitialValue?.() ?? schema.damageBonus.options?.initial;
    expect(initial).toBe(0);
  });

  it("is integer", () => {
    expect(schema.damageBonus.options?.integer).toBe(true);
  });
});

describe("AmmoData schema — damageType", () => {
  let schema;
  beforeAll(() => { schema = AmmoData.defineSchema(); });

  it("field exists", () => {
    expect(schema.damageType).toBeDefined();
  });

  it("defaults to 'lethal'", () => {
    const initial = schema.damageType.getInitialValue?.() ?? schema.damageType.options?.initial;
    expect(initial).toBe("lethal");
  });

  it("choices include lethal, bashing, aggravated", () => {
    const choices = schema.damageType.options?.choices ?? schema.damageType.choices;
    expect(choices).toContain("lethal");
    expect(choices).toContain("bashing");
    expect(choices).toContain("aggravated");
  });
});

describe("AmmoData schema — soakMod", () => {
  let schema;
  beforeAll(() => { schema = AmmoData.defineSchema(); });

  it("field exists", () => {
    expect(schema.soakMod).toBeDefined();
  });

  it("defaults to 'normal'", () => {
    const initial = schema.soakMod.getInitialValue?.() ?? schema.soakMod.options?.initial;
    expect(initial).toBe("normal");
  });

  it("choices include normal, doubled, halved", () => {
    const choices = schema.soakMod.options?.choices ?? schema.soakMod.choices;
    expect(choices).toContain("normal");
    expect(choices).toContain("doubled");
    expect(choices).toContain("halved");
  });
});
