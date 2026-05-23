import { ExaltedRoll }          from "../rolls/exalted-roll.mjs";
import { rollMassCombatAttack } from "../rolls/mass-combat-roll.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ACTIONS = [
  { key: "close-attack",       labelKey: "EX2E.ActionAttackClose",    speed: 5, dvMod: -2 },
  { key: "ranged-attack",      labelKey: "EX2E.ActionAttackRanged",   speed: 5, dvMod: -2, requiresRanged: true },
  { key: "aim",                labelKey: "EX2E.ActionAim",            speed: 3, dvMod:  0 },
  { key: "guard",              labelKey: "EX2E.ActionGuard",          speed: 3, dvMod:  1 },
  { key: "move",               labelKey: "EX2E.ActionMove",           speed: 5, dvMod:  0, blockedIfHesitating: true },
  { key: "charge",             labelKey: "EX2E.ActionCharge",         speed: 3, dvMod: -1, needsRoll: true, blockedIfHesitating: true },
  { key: "rally",              labelKey: "EX2E.ActionRally",          speed: 4, dvMod: -1, needsRoll: true },
  { key: "change-formation",   labelKey: "EX2E.ActionChangeFormation",speed: 5, dvMod: -1, needsRoll: true },
  { key: "inactive",           labelKey: "EX2E.ActionInactive",       speed: 1, dvMod:  0}
];

export class MassCombatActionDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-mass-combat-action-dialog",
    classes:  ["exalted2e", "roll-dialog", "mass-combat-action-dialog"],
    position: { width: 480, height: "auto" },
    window:   { title: "EX2E.DeclareAction", resizable: false, minimizable: false },
    actions:  {
      selectAction: MassCombatActionDialog.#onSelectAction,
      roll:         MassCombatActionDialog.#onRoll,
      confirm:      MassCombatActionDialog.#onConfirm,
      cancel:       MassCombatActionDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/mass-combat-action.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve         = resolve;
    this._resolved        = false;
    this._unitActor       = options.unitActor;
    this._combat          = game.combat ?? null;
    this._combatant       = this._combat?.combatants.find(c => c.actor?.id === options.unitActor.id) ?? null;
    this._selectedAction  = null;
    this._rollResult      = null;
  }

  async _prepareContext(options) {
    const context    = await super._prepareContext(options);
    const unitSystem = this._unitActor.system;
    const hesitating = this._combatant?.flags?.exalted2e?.hesitating ?? false;
    const commander  = unitSystem.commanderActor ?? null;

    const actions = ACTIONS.map(a => ({
      ...a,
      label:   game.i18n.localize(a.labelKey),
      selected: a.key === this._selectedAction,
      blocked:  (a.blockedIfHesitating && hesitating) || (a.requiresRanged && !unitSystem.rangedCombatRating)
    }));

    const selectedDef = ACTIONS.find(a => a.key === this._selectedAction) ?? null;
    let selectedFormula = null;
    let selectedPool    = null;
    let selectedDiff    = null;

    if (selectedDef?.needsRoll && commander) {
      const cha   = commander.system.attributes?.charisma?.value ?? 0;
      const war   = commander.system.abilities?.war?.value       ?? 0;
      const perf  = commander.system.abilities?.performance?.value ?? 0;
      const mag   = unitSystem.magnitude.value;
      const drill = unitSystem.drill;

      if (this._selectedAction === "rally") {
        const abilScore = Math.max(war, perf);
        const abilLabel = abilScore === war ? `War ${war}` : `Performance ${perf}`;
        selectedPool    = cha + abilScore;
        selectedDiff    = Math.max(1, mag - drill);
        selectedFormula = `(Cha ${cha} + ${abilLabel}) = ${selectedPool} dice, difficulty ${selectedDiff}`;
      } else if (this._selectedAction === "charge") {
        selectedPool    = cha + war;
        selectedDiff    = Math.max(1, mag - drill);
        selectedFormula = `(Cha ${cha} + War ${war}) = ${selectedPool} dice, difficulty ${selectedDiff}`;
      } else if (this._selectedAction === "change-formation") {
        const engagedMod = unitSystem.engaged ? 2 : 0;
        selectedPool     = cha + war;
        selectedDiff     = Math.max(1, mag - drill + engagedMod);
        const engNote    = engagedMod > 0 ? " (+2 engaged)" : "";
        selectedFormula  = `(Cha ${cha} + War ${war}) = ${selectedPool} dice, difficulty ${selectedDiff}${engNote}`;
      }
    } else if (selectedDef?.needsRoll && !commander) {
      selectedFormula = game.i18n.localize("EX2E.JoinWarNoCommander");
    }

    const formationOptions = ["none","unordered","skirmish","relaxed","close"].map(k => ({
      value:   k,
      label:   game.i18n.localize(`EX2E.Formation${k.charAt(0).toUpperCase() + k.slice(1)}`),
      current: k === unitSystem.formation
    }));

    return {
      ...context,
      unitName:             this._unitActor.name,
      hesitating,
      actions,
      selectedAction:       this._selectedAction,
      selectedNeedsRoll:    selectedDef?.needsRoll ?? false,
      selectedFormula,
      selectedPool,
      selectedDiff,
      rollResult:           this._rollResult,
      rollResultSummary:    this._rollResult
        ? game.i18n.format("EX2E.RollResultSummary", { successes: this._rollResult.successes, diff: this._rollResult.diff })
        : null,
      showFormationSelect:  this._selectedAction === "change-formation",
      formationOptions
    };
  }

  static #onSelectAction(event, target) {
    this._selectedAction = target.dataset.actionKey;
    this._rollResult     = null;
    this.render();
  }

  static async #onRoll(_event, _target) {
    const unitSystem = this._unitActor.system;
    const commander  = unitSystem.commanderActor ?? null;
    if (!commander) return;
    const cha   = commander.system.attributes?.charisma?.value ?? 0;
    const war   = commander.system.abilities?.war?.value       ?? 0;
    const perf  = commander.system.abilities?.performance?.value ?? 0;
    const mag   = unitSystem.magnitude.value;
    const drill = unitSystem.drill;

    let pool, diff;
    if (this._selectedAction === "rally") {
      pool = cha + Math.max(war, perf);
      diff = Math.max(1, mag - drill);
    } else if (this._selectedAction === "charge") {
      pool = cha + war;
      diff = Math.max(1, mag - drill);
    } else {
      // change-formation
      const engagedMod = unitSystem.engaged ? 2 : 0;
      pool = cha + war;
      diff = Math.max(1, mag - drill + engagedMod);
    }

    if (pool <= 0) {
      ui.notifications.warn(game.i18n.localize("EX2E.CannotRollZeroPool"));
      return;
    }
    const roll   = new ExaltedRoll({ pool });
    const result = await roll.evaluate();
    this._rollResult = {
      successes:   result.successes,
      diceDetails: result.diceDetails,
      success:     result.successes >= diff,
      diff
    };
    this.render();
  }

  static async #onConfirm(_event, _target) {
    if (!this._selectedAction) {
      ui.notifications.warn(game.i18n.localize("EX2E.JoinWarRollFirst"));
      return;
    }

    const action = ACTIONS.find(a => a.key === this._selectedAction);
    if (!action) return;

    const unit       = this._unitActor;
    const unitSystem = unit.system;
    const hesitating = this._combatant?.flags?.exalted2e?.hesitating ?? false;
    const isBlocked  = (action.blockedIfHesitating && hesitating)
                     || (action.requiresRanged && !unitSystem.rangedCombatRating);
    if (isBlocked) {
      ui.notifications.warn(game.i18n.localize("EX2E.JoinWarRollFirst"));
      return;
    }

    // 1. Execute action-specific effect
    if (this._selectedAction === "close-attack") {
      await rollMassCombatAttack(unit, { ranged: false });

    } else if (this._selectedAction === "ranged-attack") {
      await rollMassCombatAttack(unit, { ranged: true });

    } else if (this._selectedAction === "aim") {
      await unit.update({ "system.aimBonus": 3 });

    } else if (this._selectedAction === "change-formation") {
      const select = this.element?.querySelector("select[name='targetFormation']");
      const newFormation = select?.value ?? unitSystem.formation;
      if (this._rollResult?.success) {
        await unit.update({ "system.formation": newFormation });
      }
      await this._postActionChatCard(action, newFormation);

    } else if (action.needsRoll) {
      await this._postActionChatCard(action, null);
    }

    // 2. Advance ticks (only when in combat)
    if (this._combat && this._combatant) {
      await this._combat.advanceCurrentByTicks(action.speed);
    }

    // 3. Apply DV penalty
    if (action.dvMod < 0) {
      const label = game.i18n.localize(action.labelKey);
      await unit.applyDVPenalty("parry", Math.abs(action.dvMod), { label });
      await unit.applyDVPenalty("dodge", Math.abs(action.dvMod), { label });
    }

    // 4. Clear hesitating
    if (this._combatant?.flags?.exalted2e?.hesitating) {
      await this._combatant.unsetFlag("exalted2e", "hesitating");
    }

    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  async _postActionChatCard(action, targetFormation) {
    const actionLabel = game.i18n.localize(action.labelKey);
    let resultLine = "";
    if (this._rollResult) {
      const outcome = this._rollResult.success
        ? game.i18n.localize(action.key === "rally" ? "EX2E.RallySuccess" : action.key === "change-formation" ? "EX2E.FormationChanged" : "EX2E.ActionSucceeded")
        : game.i18n.localize(action.key === "rally" ? "EX2E.RallyFailure" : action.key === "change-formation" ? "EX2E.FormationChangeFailed" : "EX2E.ActionFailed");
      resultLine = `<br>${game.i18n.format("EX2E.RollResultSummary", { successes: this._rollResult.successes, diff: this._rollResult.diff })} — <strong>${outcome}</strong>`;
      if (action.key === "change-formation" && this._rollResult.success && targetFormation) {
        const fKey  = targetFormation.charAt(0).toUpperCase() + targetFormation.slice(1);
        resultLine += ` → ${game.i18n.localize(`EX2E.Formation${fKey}`)}`;
      }
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this._unitActor }),
      content: `<div class="mass-combat-action-card"><strong>${this._unitActor.name}</strong> — <em>${actionLabel}</em>${resultLine}</div>`
    });
  }

  static #onCancel(_event, _target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new MassCombatActionDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
