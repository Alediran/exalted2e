const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * ComboCharmPickerDialog – lists the actor's owned charms (filtered
 * to exclude those already in the Combo) and returns the selected
 * charmUids. Multi-select; returns [] on cancel.
 */
export class ComboCharmPickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-combo-charm-picker",
    tag:      "dialog",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 380, height: "auto" },
    window:   { title: "EX2E.ComboPickerTitle", resizable: false },
    actions:  {
      confirmPick: ComboCharmPickerDialog.#onConfirmPick
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/combo-charm-picker-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    // `options.candidates` is [{ uid, name }] — the caller (ComboSheet)
    // has already filtered out uids already present in the Combo so
    // the picker only shows new additions.
    this._candidates = options.candidates ?? [];
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, candidates: this._candidates };
  }

  static #onConfirmPick(event, target) {
    const form = this.element.querySelector("form");
    // Read checkboxes directly — each is named `uid:<charmUid>`.
    const picked = [];
    for (const box of form.querySelectorAll("input[type='checkbox'][name^='uid:']")) {
      if (box.checked) picked.push(box.name.slice(4));
    }
    this._resolved = true;
    this._resolve(picked);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve([]);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new ComboCharmPickerDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
