import { EX2E, getAnimaPalette } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const EFFECT_TIERS = ["burning", "bonfire", "totemic"];
const DEFAULT_GLOW   = { burning: "none",  bonfire: "pulse", totemic: "pulse" };
const DEFAULT_LIGHT  = { burning: "none",  bonfire: "pulse", totemic: "pulse" };

export class AnimaColorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: { title: "EX2E.AnimaColorDialogTitle" },
    position: { width: 480 },
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
    this._actor   = options.actor;
    this._slots   = [...(this._actor.getFlag("exalted2e", "animaColors")       ?? [null, null, null])];
    this._effects = { ...DEFAULT_GLOW,  ...(this._actor.getFlag("exalted2e", "animaEffects")      ?? {}) };
    this._lights  = { ...DEFAULT_LIGHT, ...(this._actor.getFlag("exalted2e", "animaLightEffects") ?? {}) };
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const palette = getAnimaPalette(this._actor);
    const slots   = this._slots;

    const paletteEntries = palette.map(entry => ({
      ...entry,
      slotIndex: slots.indexOf(entry.hex)
    }));

    const glowOptions = Object.entries(EX2E.animaEffects)
      .map(([value, label]) => ({ value, label }));

    // Populate from Foundry's live registry so new animation types added by
    // future Foundry versions appear automatically.
    const lightOptions = [
      { value: "none", label: "EX2E.AnimaEffectNone" },
      ...Object.entries(CONFIG.Canvas.lightAnimations ?? {})
        .map(([key, def]) => ({ value: key, label: def.label }))
    ];

    const effectTiers = EFFECT_TIERS.map(tier => ({
      tier,
      label:        EX2E.anima[tier],
      currentGlow:  this._effects[tier] ?? DEFAULT_GLOW[tier],
      currentLight: this._lights[tier]  ?? DEFAULT_LIGHT[tier]
    }));

    return {
      ...ctx,
      slots: [...slots],
      palette: paletteEntries,
      glowOptions,
      lightOptions,
      effectTiers
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    htmlElement.querySelectorAll("select.acd-effect-select").forEach(sel => {
      sel.addEventListener("change", ev => {
        this._effects[ev.currentTarget.dataset.tier] = ev.currentTarget.value;
      });
    });
    htmlElement.querySelectorAll("select.acd-light-select").forEach(sel => {
      sel.addEventListener("change", ev => {
        this._lights[ev.currentTarget.dataset.tier] = ev.currentTarget.value;
      });
    });
  }

  static #onAssignSlot(_event, target) {
    const hex = target.dataset.hex;
    if (!hex) return;
    const firstEmpty = this._slots.indexOf(null);
    if (firstEmpty === -1) return;
    if (this._slots.includes(hex)) return;
    this._slots[firstEmpty] = hex;
    this.render();
  }

  static #onClearSlot(_event, target) {
    const index = Number(target.dataset.index);
    if (isNaN(index) || index < 0 || index > 2) return;
    this._slots[index] = null;
    const filled = this._slots.filter(s => s !== null);
    this._slots = [...filled, ...Array(3 - filled.length).fill(null)];
    this.render();
  }

  static async #onConfirm() {
    await this._actor.setFlag("exalted2e", "animaColors",       this._slots);
    await this._actor.setFlag("exalted2e", "animaEffects",      this._effects);
    await this._actor.setFlag("exalted2e", "animaLightEffects", this._lights);
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
