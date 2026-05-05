const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CooperativeCharmDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-cooperative-charm",
    classes:  ["exalted2e", "cooperative-charm-dialog"],
    position: { width: 420, height: "auto" },
    window:   { resizable: false, title: "EX2E.CooperativeActivationTitle" },
    actions:  {
      cooperate: CooperativeCharmDialog.#onCooperate,
      solo:      CooperativeCharmDialog.#onSolo,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/cooperative-charm.hbs" }
  };

  constructor(charm, candidates, options = {}, resolve) {
    super(options);
    this._charm      = charm;
    this._candidates = candidates;
    this._resolve    = resolve;
    this._resolved   = false;
  }

  async _prepareContext(options) {
    const context   = await super._prepareContext(options);
    const moteCost  = this._charm.system.cost?.motes ?? 0;
    return {
      ...context,
      charmName: this._charm.name,
      moteCost,
      candidates: this._candidates.map(({ actor, eligible, reason }) => ({
        id:        actor.id,
        name:      actor.name,
        available: actor.system.motes?.peripheral?.value ?? 0,
        moteCost,
        eligible,
        reason:    reason ? game.i18n.localize(reason) : null,
      })),
    };
  }

  static #onCooperate(_event, _target) {
    const checked = [...this.element.querySelectorAll(".supporter-check:checked")]
      .map(el => el.dataset.actorId);
    const supporters = checked.map(id => game.actors.get(id)).filter(Boolean);
    this._resolved = true;
    this._resolve({ supporters });
    this.close();
  }

  static #onSolo(_event, _target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  /**
   * Build the candidate list from the current combat and open the dialog.
   * Returns null immediately if there are no candidates (no dialog opened).
   */
  static async prompt(charm, actor) {
    if (!game.combat) return null;
    const leadCombatant = game.combat.combatants.find(c => c.actorId === actor.id);
    if (!leadCombatant || leadCombatant.initiative == null) return null;

    const moteCost = charm.system.cost?.motes ?? 0;
    const candidates = [];

    for (const c of game.combat.combatants) {
      if (c.id === leadCombatant.id) continue;
      if (c.initiative !== leadCombatant.initiative) continue;
      const a = c.actor;
      if (!a) continue;

      let eligible = true;
      let reason   = null;

      if (a.system.exaltType !== "terrestrial") {
        eligible = false; reason = "EX2E.CooperationIneligibleNotDB";
      } else if (!a.items.some(i => i.type === "charm" && i.name === charm.name)) {
        eligible = false; reason = "EX2E.CooperationIneligibleMissingCharm";
      } else if ((a.system.motes?.peripheral?.value ?? 0) < moteCost) {
        eligible = false; reason = "EX2E.CooperationIneligibleMotes";
      }

      candidates.push({ actor: a, eligible, reason });
    }

    // If there are no candidates at all (eligible or not), skip the dialog.
    if (candidates.length === 0) return null;

    return new Promise(resolve => {
      new CooperativeCharmDialog(charm, candidates, {}, resolve).render({ force: true });
    });
  }
}
