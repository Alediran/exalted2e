import { getAnimaPalette } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AnimaColorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: { title: "EX2E.AnimaColorDialogTitle" },
    position: { width: 380 },
    actions: {
      assignSlot: AnimaColorDialog.#onAssignSlot,
      clearSlot:  AnimaColorDialog.#onClearSlot,
      confirm:    AnimaColorDialog.#onConfirm,
      cancel:     AnimaColorDialog.#onCancel
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/anima-color-dialog.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this._actor = options.actor;
    this._slots = [...(this._actor.getFlag("exalted2e", "animaColors") ?? [null, null, null])];
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const palette = getAnimaPalette(this._actor);
    const slots   = this._slots;

    const paletteEntries = palette.map(entry => {
      const slotIndex = slots.indexOf(entry.hex);
      return { ...entry, slotIndex };
    });

    return {
      ...ctx,
      slots: [...slots],
      palette: paletteEntries
    };
  }

  static #onAssignSlot(_event, target) {
    const hex = target.dataset.hex;
    if (!hex) return;
    const firstEmpty = this._slots.indexOf(null);
    if (firstEmpty === -1) return; // all slots full — do nothing
    if (this._slots.includes(hex)) return; // already assigned
    this._slots[firstEmpty] = hex;
    this.render();
  }

  static #onClearSlot(_event, target) {
    const index = Number(target.dataset.index);
    if (isNaN(index) || index < 0 || index > 2) return;
    this._slots[index] = null;
    // Compact: shift remaining non-null values left
    const filled = this._slots.filter(s => s !== null);
    this._slots = [...filled, ...Array(3 - filled.length).fill(null)];
    this.render();
  }

  static async #onConfirm() {
    await this._actor.setFlag("exalted2e", "animaColors", this._slots);
    this.close();
  }

  static #onCancel() {
    this.close();
  }

  static open(actor) {
    if (!actor) return;
    new AnimaColorDialog({ actor, id: `ex2e-anima-color-${actor.id}` }).render(true);
  }
}
