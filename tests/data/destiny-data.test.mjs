import { describe, it, expect } from "vitest";

// ── Foundry stub ────────────────────────────────────────────────────────────
const fields = {
  StringField:  class { constructor(o={}) { this.options = o; } },
  NumberField:  class { constructor(o={}) { this.options = o; } },
  BooleanField: class { constructor(o={}) { this.options = o; } },
  HTMLField:    class { constructor(o={}) { this.options = o; } },
  SchemaField:  class { constructor(cfg) { this.config = cfg; } },
};
globalThis.foundry = { data: { fields }, abstract: { TypeDataModel: class {
  static defineSchema() { return {}; }
  prepareDerivedData() {}
} } };

// ── EX2E stub ───────────────────────────────────────────────────────────────
const EX2E = {
  destinyTrigger:   { simple: { paradoxDice: 1 }, intelligent: { paradoxDice: 3 } },
  destinyScope:     {
    0: { effectPoints: 0, paradoxDice: 0, invitesCensure: false },
    4: { effectPoints: 4, paradoxDice: 1, invitesCensure: false },
    6: { effectPoints: 6, paradoxDice: 1, invitesCensure: true  },
  },
  destinyDuration:  {
    0: { effectPoints: 0, paradoxDice: 0, invitesCensure: false },
    2: { effectPoints: 2, paradoxDice: 1, invitesCensure: false },
  },
  destinyFrequency: {
    1: { effectPoints: 1, paradoxDice: 1, invitesCensure: false },
    3: { effectPoints: 3, paradoxDice: 1, invitesCensure: true  },
  },
};
globalThis.game = { exalted2e: { EX2E } };

// ── Tests ────────────────────────────────────────────────────────────────────
// Import the real module (stubs above must be set before import resolves)
const { DestinyData } = await import("../../module/data/item/destiny-data.mjs");

describe("DestinyData schema", () => {
  it("destinyType field has initial 'ascending'", () => {
    const schema = DestinyData.defineSchema();
    expect(schema.destinyType.options.initial).toBe("ascending");
  });
  it("effectPoints SchemaField contains only 'total' (spent is derived)", () => {
    const schema = DestinyData.defineSchema();
    expect(schema.effectPoints.config.total).toBeDefined();
    expect(schema.effectPoints.config.spent).toBeUndefined();
  });
  it("scope min 0 max 10", () => {
    const schema = DestinyData.defineSchema();
    expect(schema.scope.options).toMatchObject({ min: 0, max: 10, integer: true });
  });
  it("frequency min 1 max 4", () => {
    const schema = DestinyData.defineSchema();
    expect(schema.frequency.options).toMatchObject({ min: 1, max: 4, integer: true });
  });
  it("providence.virtue field exists for virtue-requiring providences", () => {
    const schema = DestinyData.defineSchema();
    expect(schema.providence.config.virtue).toBeDefined();
  });
});

describe("DestinyData.prepareDerivedData", () => {
  function makeDestiny(overrides = {}) {
    const d = new DestinyData();
    Object.assign(d, {
      trigger: "simple", scope: 0, duration: 0, frequency: 1,
      effectPoints: { total: 5 },
      ...overrides,
    });
    d.prepareDerivedData();
    return d;
  }

  it("paradoxDice = trigger(1) + scope(0) + duration(0) + freq(1) = 2 for simple/0/0/1", () => {
    const d = makeDestiny({ trigger: "simple", scope: 0, duration: 0, frequency: 1 });
    expect(d.paradoxDice).toBe(2);
  });

  it("paradoxDice = 3+0+0+1 = 4 for intelligent trigger", () => {
    const d = makeDestiny({ trigger: "intelligent", scope: 0, duration: 0, frequency: 1 });
    expect(d.paradoxDice).toBe(4);
  });

  it("paradoxDice uses THIS level only — scope 4 adds 1 not cumulative", () => {
    const d = makeDestiny({ trigger: "simple", scope: 4, duration: 0, frequency: 1 });
    expect(d.paradoxDice).toBe(3); // 1 (trigger) + 1 (scope@4) + 0 (dur) + 1 (freq@1)
  });

  it("effectPoints.spent = scope + duration + frequency costs", () => {
    const d = makeDestiny({ trigger: "simple", scope: 4, duration: 2, frequency: 1 });
    expect(d.effectPoints.spent).toBe(7); // scope:4 + duration:2 + freq:1
  });

  it("invitesCensure false when all traits below censure threshold", () => {
    const d = makeDestiny({ scope: 0, duration: 0, frequency: 1 });
    expect(d.invitesCensure).toBe(false);
  });

  it("invitesCensure true when scope invites censure", () => {
    const d = makeDestiny({ scope: 6, duration: 0, frequency: 1 });
    expect(d.invitesCensure).toBe(true);
  });

  it("invitesCensure true when frequency invites censure", () => {
    const d = makeDestiny({ scope: 0, duration: 0, frequency: 3 });
    expect(d.invitesCensure).toBe(true);
  });
});
