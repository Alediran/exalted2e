import { EX2E } from "../config.mjs";
import { evaluateCharmFormula } from "../documents/item.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * FormulaBuilderDialog — assists authors in writing formulas for Charm
 * weapon-attack stats. The dialog opens pre-loaded with the current field
 * value, offers a token palette (attributes, abilities, essence, math
 * operators, functions), and shows a live preview evaluated against the
 * owning actor's roll-data when available.
 *
 * Resolves with the edited formula string, or `null` if the user cancels.
 */
export class FormulaBuilderDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-formula-builder-dialog",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 480, height: "auto" },
    window:   {
      title:       "EX2E.FormulaBuilder",
      resizable:   false,
      minimizable: false
    },
    actions: {
      insertToken: FormulaBuilderDialog.#onInsertToken,
      confirm:     FormulaBuilderDialog.#onConfirm,
      cancel:      FormulaBuilderDialog.#onCancel,
      clear:       FormulaBuilderDialog.#onClear
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/formula-builder-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve   = resolve;
    this._resolved  = false;
    this._actor     = options.actor    ?? null;
    this._fieldName = options.fieldName ?? "";
    this._formula   = String(options.formula ?? "");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Build the palette. Grouped by category so the template can render
    // labelled sections without knowing the structure up-front.
    const attributeTokens = [
      ["@str", "EX2E.AttrStrength"],     ["@dex", "EX2E.AttrDexterity"],
      ["@sta", "EX2E.AttrStamina"],      ["@cha", "EX2E.AttrCharisma"],
      ["@man", "EX2E.AttrManipulation"], ["@app", "EX2E.AttrAppearance"],
      ["@per", "EX2E.AttrPerception"],   ["@int", "EX2E.AttrIntelligence"],
      ["@wit", "EX2E.AttrWits"]
    ].map(([token, key]) => ({ token, label: game.i18n.localize(key) }));

    const abilityTokens = EX2E.abilities.map(key => ({
      token: `@${key}`,
      label: game.i18n.localize(EX2E.abilityLabels[key] ?? key)
    }));

    const otherTokens = [
      { token: "@essence",   label: game.i18n.localize("EX2E.Essence") },
      { token: "@willpower", label: game.i18n.localize("EX2E.Willpower") }
    ];

    const operatorTokens = ["+", "−", "*", "/", "(", ")"].map(t => ({ token: t === "−" ? "-" : t, label: t }));
    const functionTokens = [
      { token: "floor(",  label: "floor()"  },
      { token: "ceil(",   label: "ceil()"   },
      { token: "round(",  label: "round()"  },
      { token: "max(, ",  label: "max(a, b)" },
      { token: "min(, ",  label: "min(a, b)" }
    ];

    return {
      ...context,
      fieldName: this._fieldName,
      formula:   this._formula,
      preview:   this._computePreview(this._formula),
      actorName: this._actor?.name ?? "",
      attributeTokens,
      abilityTokens,
      otherTokens,
      operatorTokens,
      functionTokens
    };
  }

  /** Evaluate the formula against the current actor for the preview line. */
  _computePreview(formula) {
    if (!this._actor) return null;
    const rollData = this._actor.getRollData?.() ?? {};
    try {
      return evaluateCharmFormula(formula, rollData, null);
    } catch (_) {
      return null;
    }
  }

  _onRender(context, options) {
    const form  = this.element?.querySelector("form");
    const input = form?.querySelector("[name='formula']");
    const previewEl = form?.querySelector(".formula-preview-value");
    if (!input) return;
    // Live preview as the user types.
    input.addEventListener("input", () => {
      this._formula = input.value;
      if (previewEl) {
        const val = this._computePreview(input.value);
        previewEl.textContent = val === null ? "—" : String(val);
      }
    });
  }

  /**
   * Insert the clicked palette token at the cursor (or append). Leaves a
   * trailing space after attribute/function tokens so chained edits feel
   * natural — the user doesn't have to backspace into the next click.
   */
  static #onInsertToken(event, target) {
    const form  = this.element?.querySelector("form");
    const input = form?.querySelector("[name='formula']");
    if (!input) return;
    const token  = target.dataset.token ?? "";
    const before = input.value.slice(0, input.selectionStart ?? input.value.length);
    const after  = input.value.slice(input.selectionEnd ?? input.value.length);
    // Insert a separating space when joining two identifiers / numbers.
    const needsSpace = before.length > 0
      && !/[\s+\-*/(,]$/.test(before)
      && !/^[\s+\-*/),]/.test(token);
    const insert = needsSpace ? ` ${token}` : token;
    input.value = `${before}${insert}${after}`;
    this._formula = input.value;
    // Move caret to end of inserted text.
    const caret = (before + insert).length;
    input.focus();
    input.setSelectionRange(caret, caret);
    // Dispatch an input event so the preview updates without rerender.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  static #onClear(event, target) {
    const form  = this.element?.querySelector("form");
    const input = form?.querySelector("[name='formula']");
    if (!input) return;
    input.value = "";
    this._formula = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  static #onConfirm(event, target) {
    const form = this.element?.querySelector("form");
    const fd   = form ? new foundry.applications.ux.FormDataExtended(form) : null;
    const formula = (fd?.object?.formula ?? this._formula ?? "").trim();
    this._resolved = true;
    this._resolve(formula);
    this.close();
  }

  static #onCancel(event, target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  /**
   * @param {object}  options
   * @param {string}  options.formula    Current formula value.
   * @param {string}  [options.fieldName] Display name of the field (for title).
   * @param {Actor}   [options.actor]     Actor to evaluate the preview against.
   * @returns {Promise<string|null>}
   */
  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new FormulaBuilderDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
