import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { computeJoinWarPool } from "../rolls/mass-combat-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class JoinWarDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-join-war-dialog",
    classes:  ["exalted2e", "roll-dialog", "join-war-dialog"],
    position: { width: 440, height: "auto" },
    window:   { title: "EX2E.JoinWar", resizable: false, minimizable: false },
    actions:  {
      roll:    JoinWarDialog.#onRoll,
      confirm: JoinWarDialog.#onConfirm,
      cancel:  JoinWarDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/join-war.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve    = resolve;
    this._resolved   = false;
    this._combatant  = options.combatant;
    this._combat     = options.combat;
    this._rollResult = null;
  }

  async _prepareContext(options) {
    const context   = await super._prepareContext(options);
    const unit      = this._combatant.actor?.system;
    const commander = unit?.commanderActor ?? null;
    const formation = unit?.formation ?? "unordered";
    const magnitude = unit?.magnitude?.value ?? 0;
    const pool      = computeJoinWarPool(commander, formation, magnitude);

    let formulaStr;
    if (!commander) {
      formulaStr = game.i18n.localize("EX2E.JoinWarNoCommander");
    } else if (formation === "none") {
      const wits = commander.system.attributes?.wits?.value ?? 0;
      const awr  = commander.system.abilities?.awareness?.value ?? 0;
      formulaStr = game.i18n.format("EX2E.JoinWarFormulaAwareness", { wits, awr, pool });
    } else {
      const wits = commander.system.attributes?.wits?.value ?? 0;
      const war  = commander.system.abilities?.war?.value  ?? 0;
      formulaStr = game.i18n.format("EX2E.JoinWarFormulaWar", { wits, war, magnitude, pool });
    }

    const formKey  = formation.charAt(0).toUpperCase() + formation.slice(1);
    return {
      ...context,
      unitName:      this._combatant.actor?.name ?? game.i18n.localize("EX2E.UnknownUnit"),
      formation:     game.i18n.localize(`EX2E.Formation${formKey}`),
      commanderName: commander?.name ?? null,
      pool,
      formulaStr,
      rollResult:    this._rollResult
    };
  }

  static async #onRoll(_event, _target) {
    const unit      = this._combatant.actor?.system;
    const commander = unit?.commanderActor ?? null;
    const formation = unit?.formation ?? "unordered";
    const magnitude = unit?.magnitude?.value ?? 0;
    const pool      = computeJoinWarPool(commander, formation, magnitude);

    if (pool <= 0) return;
    const roll   = new ExaltedRoll({ pool });
    const result = await roll.evaluate();
    this._rollResult = { successes: result.successes, diceDetails: result.diceDetails };
    this.render();
  }

  static async #onConfirm(_event, _target) {
    const raw       = this.element?.querySelector("input[name='manualTick']")?.value ?? "";
    const hasManual = raw !== "" && !Number.isNaN(Number(raw));

    let successes;
    if (hasManual) {
      successes = Math.max(0, Number(raw));
    } else if (this._rollResult) {
      successes = this._rollResult.successes;
    } else {
      ui.notifications.warn(game.i18n.localize("EX2E.JoinWarRollFirst"));
      return;
    }

    await this._combatant.setFlag("exalted2e", "joinBattleSuccesses", successes);
    await this._combat._recomputeTicks();

    this._resolved = true;
    this._resolve(successes);
    this.close();
  }

  static #onCancel(_event, _target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(combatant, combat) {
    return new Promise(resolve => {
      const dialog = new JoinWarDialog({ combatant, combat }, resolve);
      dialog.render({ force: true });
    });
  }
}
