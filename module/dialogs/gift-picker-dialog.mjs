const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GiftPickerDialog — shown during DBT entry when the actor owns Gift charms.
 * Player selects which Gifts to activate alongside DBT (each adds 2m, capped
 * at Essence selections). Returns an array of item IDs; empty array on skip
 * or close.
 */
export class GiftPickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-gift-picker",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 380, height: "auto" },
    window:   { title: "EX2E.GiftPickerTitle", resizable: false },
    actions:  {
      confirmGifts: GiftPickerDialog.#onConfirm,
      skipGifts:    GiftPickerDialog.#onSkip
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/gift-picker-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve    = resolve;
    this._resolved   = false;
    this._gifts      = options.gifts      ?? [];
    this._baseCost   = options.baseCost   ?? 5;
    this._essenceMax = options.essenceMax ?? 1;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, gifts: this._gifts, baseCost: this._baseCost, essenceMax: this._essenceMax };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const form  = this.element.querySelector("form");
    if (!form) return;
    const boxes      = Array.from(form.querySelectorAll("input[data-gift-check]"));
    const totalSpan  = form.querySelector("#gift-total-motes");
    const max        = this._essenceMax;
    const base       = this._baseCost;

    const refresh = () => {
      const count = boxes.filter(b => b.checked).length;
      if (totalSpan) totalSpan.textContent = base + count * 2;
      for (const b of boxes) {
        if (!b.checked) b.disabled = count >= max;
      }
    };

    boxes.forEach(b => b.addEventListener("change", refresh));
    refresh();
  }

  static #onConfirm(event, target) {
    const form   = this.element.querySelector("form");
    const picked = [];
    for (const box of form.querySelectorAll("input[data-gift-check]")) {
      if (box.checked) picked.push(box.name.slice(3)); // strip "id:"
    }
    this._resolved = true;
    this._resolve(picked);
    this.close();
  }

  static #onSkip(event, target) {
    this._resolved = true;
    this._resolve([]);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve([]);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new GiftPickerDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
