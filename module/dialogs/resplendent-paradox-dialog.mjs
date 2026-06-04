import { RESPLENDENT_PARADOX_TRIGGERS, sumResplendentParadoxDice } from "../combat/resplendent-paradox.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM checklist for the Resplendent Paradox table. Resolves
 * { dice, triggerLabels } on confirm, or null on cancel/close.
 */
export class ResplendentParadoxDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:      "ex2e-resplendent-paradox-dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 360 },
    window:  { title: "EX2E.ResplendentParadoxRoll", resizable: false },
    actions: { rollParadox: ResplendentParadoxDialog.#onRoll },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/resplendent-paradox-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data     = {
      anima:           options.anima ?? "none",
      wearingIdentity: !!options.wearingIdentity,
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const animaPreselect = this._data.wearingIdentity
      ? (this._data.anima === "glowing" ? "anima_glowing"
        : (this._data.anima === "burning" ? "anima_burning" : null))
      : null;
    return {
      ...context,
      triggers: RESPLENDENT_PARADOX_TRIGGERS.map(t => ({
        ...t, checked: t.key === animaPreselect
      })),
    };
  }

  static #onRoll(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const obj  = fd.object;
    const keys = RESPLENDENT_PARADOX_TRIGGERS
      .filter(t => obj[t.key])
      .map(t => t.key);
    const dice = sumResplendentParadoxDice(keys);
    const triggerLabels = RESPLENDENT_PARADOX_TRIGGERS
      .filter(t => keys.includes(t.key))
      .map(t => t.labelKey);

    this._resolved = true;
    this._resolve({ dice, triggerLabels });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new ResplendentParadoxDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
