const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * AddSpecialtyDialog – Prompts the user to pick an ability and enter a
 * specialty name before adding it to the character.
 */
export class AddSpecialtyDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-add-specialty-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 320, height: "auto" },
    window: {
      title:     "EX2E.AddSpecialty",
      resizable: false
    },
    actions: {
      confirmAdd: AddSpecialtyDialog.#onConfirmAdd
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/add-specialty-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data     = {
      abilities: options.abilities ?? []
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      ...this._data
    };
  }

  static #onConfirmAdd(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new FormDataExtended(form);
    const data = fd.object;

    const ability       = data.ability?.trim()       || "";
    const specialtyName = data.specialtyName?.trim() || "";

    if (!ability || !specialtyName) return;

    this._resolved = true;
    this._resolve({ ability, name: specialtyName });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new AddSpecialtyDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
