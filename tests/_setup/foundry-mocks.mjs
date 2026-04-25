import { vi } from "vitest";

// ── Foundry data field stubs ─────────────────────────────────────────
// Minimum viable classes for `extends foundry.abstract.TypeDataModel`
// and the field-constructor calls in defineSchema(). The actual fields
// store config but don't validate — tests exercise prepareDerivedData
// directly with synthetic system objects, bypassing the schema layer.
class _MockDataField {
  constructor(config = {}) { this.config = config; }
}
class _MockTypeDataModel {}

globalThis.foundry = {
  abstract: { TypeDataModel: _MockTypeDataModel },
  data: {
    fields: {
      SchemaField:  _MockDataField,
      StringField:  _MockDataField,
      NumberField:  _MockDataField,
      BooleanField: _MockDataField,
      ArrayField:   _MockDataField,
      HTMLField:    _MockDataField
    }
  },
  utils: {
    deepClone:     obj => structuredClone(obj),
    mergeObject:   (a, b) => Object.assign({}, a, b),
    flattenObject: () => ({}),
    expandObject:  () => ({})
  },
  applications: {
    handlebars: {
      renderTemplate: vi.fn().mockResolvedValue("<div>mock card</div>")
    }
  }
};

// ── Game state ───────────────────────────────────────────────────────
globalThis.game = {
  i18n: {
    localize: key => key,
    format:   (key, data) => `${key}:${JSON.stringify(data)}`
  },
  settings: {
    get: () => false,
    register: vi.fn()
  },
  user: { isGM: false, targets: { first: () => null } },
  actors: { get: vi.fn(), filter: vi.fn().mockReturnValue([]) },
  combat: null
};

// ── Hooks ────────────────────────────────────────────────────────────
globalThis.Hooks = {
  on:   vi.fn(),
  once: vi.fn(),
  off:  vi.fn(),
  call: vi.fn()
};

// ── ChatMessage ──────────────────────────────────────────────────────
globalThis.ChatMessage = {
  create:     vi.fn().mockResolvedValue({ id: "test-msg", flags: {}, update: vi.fn() }),
  getSpeaker: vi.fn().mockReturnValue({})
};

// ── UI ───────────────────────────────────────────────────────────────
globalThis.ui = {
  notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
};

// ── Roll ─────────────────────────────────────────────────────────────
globalThis.Roll = class _MockRoll {
  constructor(formula) { this.formula = formula; }
  async evaluate() { return this; }
  async toMessage() { return null; }
};
