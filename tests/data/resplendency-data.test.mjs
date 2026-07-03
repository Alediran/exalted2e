import { describe, it, expect } from "vitest";

// ── Foundry stub ────────────────────────────────────────────────────────────
const fields = {
  StringField:      class { constructor(o={}) { this.options = o; } },
  NumberField:      class { constructor(o={}) { this.options = o; } },
  BooleanField:     class { constructor(o={}) { this.options = o; } },
  HTMLField:        class { constructor(o={}) { this.options = o; } },
  SchemaField:      class { constructor(cfg) { this.config = cfg; } },
  ArrayField:       class { constructor(el) { this.element = el; } },
  ObjectField:      class { constructor(o={}) { this.options = o; } },
  TypedObjectField: class { constructor(el, o={}) { this.element = el; this.options = o; } },
};
globalThis.foundry = { data: { fields }, abstract: { TypeDataModel: class {
  static defineSchema() { return {}; }
  prepareDerivedData() {}
} } };

// ── Tests ────────────────────────────────────────────────────────────────────
// Import the real module (stubs above must be set before import resolves)
const { ResplendencyData } = await import("../../module/data/item/resplendency-data.mjs");

describe("ResplendencyData schema", () => {
  it("has college / enduranceCost / paradoxDice / keyword / isStatBonus / description", () => {
    const s = ResplendencyData.defineSchema();
    expect(s.college).toBeDefined();
    expect(s.enduranceCost.options).toMatchObject({ initial: 1, min: 0, integer: true });
    expect(s.paradoxDice.options).toMatchObject({ initial: 0, min: 0, integer: true });
    expect(s.keyword.options).toMatchObject({ initial: "", blank: true });
    expect(s.isStatBonus.options).toMatchObject({ initial: false });
    expect(s.description).toBeDefined();
  });
  it("changes is an ArrayField of a key/mode/value SchemaField", () => {
    const s = ResplendencyData.defineSchema();
    expect(s.changes.element.config.key).toBeDefined();
    expect(s.changes.element.config.mode.options).toMatchObject({ initial: 2 });
    expect(s.changes.element.config.value).toBeDefined();
  });
});
