import { vi } from "vitest";

// ── Foundry data field stubs ─────────────────────────────────────────
// Minimum viable classes for `extends foundry.abstract.TypeDataModel`
// and the field-constructor calls in defineSchema(). The actual fields
// store config but don't validate — tests exercise prepareDerivedData
// directly with synthetic system objects, bypassing the schema layer.
class _MockDataField {
  constructor(config = {}) {
    this.config = config;
    // Mirror Foundry's real DataField API surface — actual fields expose
    // their constructor options as `.options`. Tests inspect this to
    // assert schema shape (initial, min, max, integer flags).
    this.options = config;
    // SchemaField in real Foundry exposes sub-fields via `.fields`.
    // Mirror that so schema tests can use either `.options` or `.fields`.
    this.fields = config;
  }
}

// Scalar field types expose `.initial` directly (not nested under `.options`)
// to match Foundry's DataField API where `field.initial` is a top-level getter.
class _MockScalarField extends _MockDataField {
  constructor(config = {}) {
    super(config);
    if ("initial" in config) this.initial = config.initial;
  }
}
class _MockTypeDataModel {}

globalThis.foundry = {
  abstract: { TypeDataModel: _MockTypeDataModel },
  data: {
    regionBehaviors: { RegionBehaviorType: _MockTypeDataModel },
    fields: {
      SchemaField:  _MockDataField,
      StringField:  _MockScalarField,
      NumberField:  _MockScalarField,
      BooleanField: _MockScalarField,
      ArrayField:   _MockDataField,
      HTMLField:    _MockScalarField,
      ObjectField:      _MockDataField,
      TypedObjectField: class extends _MockDataField { constructor(element, config = {}) { super(config); this.element = element; } }
    }
  },
  utils: {
    deepClone:     obj => structuredClone(obj),
    mergeObject:   (a, b) => {
      // Deep merge: modifies `a` in place and returns it
      for (const key in b ?? {}) {
        if (b.hasOwnProperty(key)) {
          if (a[key] && typeof a[key] === "object" && typeof b[key] === "object" && !Array.isArray(b[key])) {
            foundry.utils.mergeObject(a[key], b[key]);
          } else {
            a[key] = b[key];
          }
        }
      }
      return a;
    },
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
    },
    api: {
      DialogV2: {
        confirm: vi.fn().mockResolvedValue(true),
        prompt:  vi.fn().mockResolvedValue(null),
      }
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
// ReferenceError. Subclasses may call `super._preUpdate(...)` etc. —
// the no-op methods below ensure those calls resolve cleanly.
globalThis.Item = class _MockItem {
  async _preCreate() {}
  async _preUpdate() {}
  async _preDelete() {}
  prepareData() {}
  prepareDerivedData() {}
};
globalThis.Actor = class _MockActor {
  async _preCreate() {}
  async _preUpdate() {}
  async _preDelete() {}
  prepareData() {}
  prepareDerivedData() {}
  getRollData() { return {}; }
};

// ── Constants ────────────────────────────────────────────────────────
globalThis.CONST = {
  USER_ROLES: {
    GAMEMASTER: 4,
    ASSISTANT:  3,
    TRUSTED:    2,
    PLAYER:     1,
    NONE:       0
  },
  TOKEN_DISPOSITIONS: {
    FRIENDLY: 1,
    NEUTRAL:  0,
    HOSTILE: -1
  },
  REGION_EVENTS: {
    TOKEN_ENTER:      "tokenEnter",
    TOKEN_EXIT:       "tokenExit",
    TOKEN_TURN_START: "tokenTurnStart",
    TOKEN_TURN_END:   "tokenTurnEnd",
  }
};

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

// ── Combat base class ─────────────────────────────────────────────────
globalThis.Combat = class _MockCombat {
  getFlag() { return undefined; }
  setFlag() { return Promise.resolve(); }
  update() { return Promise.resolve(); }
};

// ── ApplicationV2 + HandlebarsApplicationMixin ────────────────────────
// Required by sheets, dialogs, and apps that extend AppV2 at module load.
class _MockApplicationV2 {
  static DEFAULT_OPTIONS = {};
  render() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  async _prepareContext() { return {}; }
}

foundry.applications.api.ApplicationV2 = _MockApplicationV2;
foundry.applications.api.HandlebarsApplicationMixin = (Base) => {
  return class extends Base {
    static DEFAULT_OPTIONS = Base.DEFAULT_OPTIONS ?? {};
  };
};

// ── Sheet base classes ────────────────────────────────────────────────
foundry.applications.sheets = {
  ActorSheetV2: class _MockActorSheetV2 extends _MockApplicationV2 {},
  ItemSheetV2:  class _MockItemSheetV2  extends _MockApplicationV2 {},
};

// ── Template loading ──────────────────────────────────────────────────
foundry.applications.handlebars.loadTemplates = vi.fn().mockResolvedValue([]);

// ── Sheet registration API ────────────────────────────────────────────
// foundry.documents.collections.{Actors,Items} used by register-sheets.mjs
foundry.documents = {
  collections: {
    Actors: { registerSheet: vi.fn(), unregisterSheet: vi.fn() },
    Items:  { registerSheet: vi.fn(), unregisterSheet: vi.fn() },
  }
};
// Core sheet classes unregistered by register-sheets
foundry.appv1 = {
  sheets: {
    ActorSheet: class _MockActorSheet {},
    ItemSheet:  class _MockItemSheet  {},
  }
};

// ── Handlebars ────────────────────────────────────────────────────────
globalThis.Handlebars = {
  registerHelper: vi.fn(),
  SafeString: class { constructor(s) { this.string = s; } },
  helpers: {},
};
