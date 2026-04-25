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
    flattenObject: (obj, prefix = "") => {
      const out = {};
      for (const [key, val] of Object.entries(obj ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
          Object.assign(out, foundry.utils.flattenObject(val, path));
        } else {
          out[path] = val;
        }
      }
      return out;
    },
    expandObject: (flat) => {
      const out = {};
      for (const [path, val] of Object.entries(flat ?? {})) {
        const parts = path.split(".");
        let cursor = out;
        for (let i = 0; i < parts.length - 1; i++) {
          if (typeof cursor[parts[i]] !== "object" || cursor[parts[i]] === null) {
            cursor[parts[i]] = {};
          }
          cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = val;
      }
      return out;
    }
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

// ── Document base classes ────────────────────────────────────────────
// Minimal Item / Actor stand-ins so module files that
// `class Foo extends Item` can load under Vitest without throwing
// ReferenceError. Tests don't instantiate these — they exercise
// exported pure helpers and synthetic data — so the body is empty.
globalThis.Item  = class _MockItem {};
globalThis.Actor = class _MockActor {};

// ── Roll ─────────────────────────────────────────────────────────────
globalThis.Roll = class _MockRoll {
  constructor(formula) { this.formula = formula; }
  async evaluate() { return this; }
  async toMessage() { return null; }

  /**
   * Substitute @key tokens against a roll-data object. `@a.b.c` walks
   * the data tree; missing tokens resolve to `opts.missing` (default
   * "0"). This mirrors Foundry's contract closely enough for charm-
   * formula tests.
   */
  static replaceFormulaData(formula, data, opts = {}) {
    return String(formula).replace(/@([\w.]+)/g, (token, key) => {
      const parts = key.split(".");
      let cursor = data;
      for (const p of parts) {
        if (cursor == null) {
          // Foundry's contract: when `opts.missing` is set, substitute it;
          // otherwise leave the original `@token` literal in place. The
          // tests use `{missing: "0"}` for arithmetic substitution, but
          // a future caller without `missing` should not silently lose
          // the token.
          return opts.missing ?? token;
        }
        cursor = cursor[p];
      }
      if (cursor == null) return opts.missing ?? token;
      return String(cursor);
    });
  }

  /**
   * Evaluate an arithmetic expression. Foundry uses a sandboxed parser;
   * the tests use Function() since they fully control the inputs.
   */
  static safeEval(expr) {
    return Function(`"use strict"; return (${expr});`)();
  }
};
