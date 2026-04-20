import { EX2E } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * FinishTurnDialog — asks the player how many ticks the current combatant's
 * action cost. Resolves to the chosen Speed (number) or `null` on cancel.
 *
 * Canonical Exalted 2e Speeds for common miscellaneous actions are offered
 * as quick-pick presets; any custom value can be typed in the free input.
 */
export class FinishTurnDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-finish-turn-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 340, height: "auto" },
    window: {
      title:     "EX2E.FinishTurnTitle",
      resizable: false
    },
    actions: {
      confirm: FinishTurnDialog.#onConfirm,
      cancel:  FinishTurnDialog.#onCancel,
      preset:  FinishTurnDialog.#onPreset
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/finish-turn-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data = {
      combatantName: options.combatantName ?? "",
      currentTick:   options.currentTick   ?? 0,
      defaultSpeed:  options.defaultSpeed  ?? 5
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      combatantName: this._data.combatantName,
      currentTick:   this._data.currentTick,
      defaultSpeed:  this._data.defaultSpeed,
      // Presets are sourced from the shared action config so Finish Turn
      // and the Flurry dialog stay in lock-step on Speeds.
      presets: Object.entries(EX2E.actions)
        .filter(([, a]) => a.preset)
        .map(([key, a]) => ({ key, speed: a.speed, labelKey: a.labelKey }))
    };
  }

  static #onPreset(event, target) {
    const input = this.element.querySelector("[name='speed']");
    if (input) input.value = parseInt(target.dataset.speed) || 0;
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const speed = parseInt(fd.object.speed) || 0;
    if (speed < 0) return;
    this._resolved = true;
    this._resolve(speed);
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

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new FinishTurnDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
