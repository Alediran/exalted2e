import { computeVentUpdate } from "../helpers/resonance-vent.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SpendResonanceDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, rollResult, options = {}) {
    super(options);
    this.actor       = actor;
    this._rollResult = rollResult;
  }

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "spend-resonance-dialog"],
    position: { width: 360, height: "auto" },
    window:   { resizable: false, title: "EX2E.VentResonance" },
    actions:  {
      applyVent: SpendResonanceDialog.#onApplyVent,
    },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/spend-resonance.hbs" },
  };

  static open(actor, rollResult) {
    new SpendResonanceDialog(actor, rollResult).render({ force: true });
  }

  async _prepareContext(options) {
    const context       = await super._prepareContext(options);
    const successes     = this._rollResult?.successes ?? 0;
    const currentLimit  = this.actor.system.limit ?? 0;
    const currentBanked = this.actor.system.splat?.abyssal?.bankedResonance ?? 0;
    const update        = computeVentUpdate(currentLimit, currentBanked, successes);
    return {
      ...context,
      actor:          this.actor,
      rollSuccesses:  successes,
      currentLimit,
      currentBanked,
      newLimit:       update.limit,
      newBanked:      update.bankedResonance,
    };
  }

  static async #onApplyVent(_event, _target) {
    const successes     = this._rollResult?.successes ?? 0;
    const currentLimit  = this.actor.system.limit ?? 0;
    const currentBanked = this.actor.system.splat?.abyssal?.bankedResonance ?? 0;
    const update        = computeVentUpdate(currentLimit, currentBanked, successes);
    await this.actor.update({
      "system.limit":                         update.limit,
      "system.splat.abyssal.bankedResonance": update.bankedResonance,
    });
    this.close();
  }
}
