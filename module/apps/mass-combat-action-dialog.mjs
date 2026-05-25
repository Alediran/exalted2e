import { ExaltedRoll }          from "../rolls/exalted-roll.mjs";
import { rollMassCombatAttack } from "../rolls/mass-combat-roll.mjs";
import {
  rollCharge,
  rollChangeFormation,
  rollDisengage,
  rollSplitUnit,
  rollMergeUnits,
  rollRally,
  performSignalUnits,
  rollTurnUnit,
} from "../rolls/unit-action-roll.mjs";
import {
  computeChangeFormationDifficulty,
  computeChargePool,
  computeChargeDifficulty,
  computeMergeMagnitude,
  applyRelayBonus,
} from "../rolls/mass-combat-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ACTIONS = [
  { key: "close-attack",       labelKey: "EX2E.ActionAttackClose",    speed: 5, dvMod: -2 },
  { key: "ranged-attack",      labelKey: "EX2E.ActionAttackRanged",   speed: 5, dvMod: -2, requiresRanged: true },
  { key: "aim",                labelKey: "EX2E.ActionAim",            speed: 3, dvMod:  0 },
  { key: "guard",              labelKey: "EX2E.ActionGuard",          speed: 3, dvMod:  1 },
  { key: "move",               labelKey: "EX2E.ActionMove",           speed: 5, dvMod:  0, blockedIfHesitating: true },
  { key: "charge",             labelKey: "EX2E.ActionCharge",         speed: 3, dvMod: -1, blockedIfHesitating: true },
  { key: "rally",              labelKey: "EX2E.ActionRally",          speed: 4, dvMod: -1, needsRoll: true },
  { key: "change-formation",   labelKey: "EX2E.ActionChangeFormation",speed: 5, dvMod: -1, needsRoll: true },
  { key: "turn",               labelKey: "EX2E.ActionTurn",           speed: 3, dvMod: -1 },
  { key: "disengage",          labelKey: "EX2E.ActionDisengage",      speed: 0, dvMod:  0, blockedIfNotEngaged: true },
  { key: "split",              labelKey: "EX2E.ActionSplitUnit",      speed: 3, dvMod: -1 },
  { key: "merge",              labelKey: "EX2E.ActionMergeUnits",     speed: 3, dvMod: -1, requiresTarget: true },
  { key: "inactive",           labelKey: "EX2E.ActionInactive",       speed: 1, dvMod:  0},
  { key: "signal",             labelKey: "EX2E.ActionSignal",         speed: 3, dvMod:  0 },
];

const FORMATION_MIN_DRILL = { none: 99, unordered: 1, skirmish: 2, relaxed: 2, close: 3 };

function isNumbersEligible(rallyingUnit) {
  if (!game.combat) return false;
  const myMag = rallyingUnit.system.magnitude.value;
  for (const combatant of game.combat.combatants) {
    const actor = combatant.actor;
    if (!actor || actor.id === rallyingUnit.id || actor.type !== "unit") continue;
    const joinMag = combatant.flags?.exalted2e?.magnitudeAtJoinWar ?? null;
    const curMag  = actor.system.magnitude.value;
    if (joinMag !== null && joinMag > curMag && curMag > myMag) return true;
  }
  return false;
}

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
    this._selectedRallySubEffect = "second-wind";
  }

  async _prepareContext(options) {
    const context    = await super._prepareContext(options);
    const unitSystem = this._unitActor.system;
    const sys        = unitSystem;
    const hesitating = this._combatant?.flags?.exalted2e?.hesitating ?? false;
    const commander  = unitSystem.commanderActor ?? null;

    const targetToken = [...game.user.targets][0];
    const targetActor = targetToken?.actor ?? null;
    const hasTarget   = !!targetActor && targetActor.type === "unit";

    const actions = ACTIONS.map(a => {
      let blocked =
        (a.blockedIfHesitating && hesitating) ||
        (a.requiresRanged && !unitSystem.rangedCombatRating);
      if (a.blockedIfNotEngaged && !sys.engaged) blocked = true;
      if (a.requiresTarget && !hasTarget) blocked = true;
      return {
        ...a,
        label:    game.i18n.localize(a.labelKey),
        selected: a.key === this._selectedAction,
        blocked
      };
    });

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
        selectedPool    = applyRelayBonus(cha + abilScore, unitSystem.relayCommandPool ?? 0);
        selectedDiff    = Math.max(1, mag - drill);
        selectedFormula = `(Cha ${cha} + ${abilLabel}) = ${selectedPool} dice, difficulty ${selectedDiff}`;
      } else if (this._selectedAction === "change-formation") {
        const engagedMod = unitSystem.engaged ? 2 : 0;
        selectedPool     = applyRelayBonus(cha + war, unitSystem.relayCommandPool ?? 0);
        selectedDiff     = Math.max(1, mag - drill + engagedMod);
        const engNote    = engagedMod > 0 ? " (+2 engaged)" : "";
        selectedFormula  = `(Cha ${cha} + War ${war}) = ${selectedPool} dice, difficulty ${selectedDiff}${engNote}`;
      }
    } else if (selectedDef?.needsRoll && !commander) {
      selectedFormula = game.i18n.localize("EX2E.JoinWarNoCommander");
    }

    // Show charge formula preview even though roll happens at confirm time
    if (this._selectedAction === "charge" && commander) {
      const cha       = commander.system.attributes?.charisma?.value ?? 0;
      const war       = commander.system.abilities?.war?.value       ?? 0;
      selectedPool    = computeChargePool(cha, war);
      selectedDiff    = computeChargeDifficulty(sys.magnitude.value, sys.drill);
      selectedFormula = `(Cha ${cha} + War ${war}) = ${selectedPool} dice, difficulty ${selectedDiff}`;
    }

    // Show turn formula preview even though roll happens at confirm time
    if (this._selectedAction === "turn" && commander) {
      const cha       = commander.system.attributes?.charisma?.value ?? 0;
      const war       = commander.system.abilities?.war?.value       ?? 0;
      selectedPool    = applyRelayBonus(computeChargePool(cha, war), unitSystem.relayCommandPool ?? 0);
      selectedDiff    = computeChargeDifficulty(sys.magnitude.value, sys.drill);
      selectedFormula = `(Cha ${cha} + War ${war}) = ${selectedPool} dice, difficulty ${selectedDiff}`;
    }

    const formationOptions = ["none","unordered","skirmish","relaxed","close"]
      .filter(k => sys.drill >= (FORMATION_MIN_DRILL[k] ?? Infinity))
      .map(k => ({
        value:   k,
        label:   game.i18n.localize(`EX2E.Formation${k.charAt(0).toUpperCase() + k.slice(1)}`),
        current: k === unitSystem.formation
      }));

    const splitMaxMagnitude    = Math.max(1, sys.magnitude.value - 1);
    const mergeResultMagnitude = hasTarget
      ? computeMergeMagnitude(sys.magnitude.value, targetActor.system.magnitude.value)
      : 0;

    const showRallySubEffects = this._selectedAction === "rally";
    const numbersEligible = showRallySubEffects && isNumbersEligible(this._unitActor);
    const rallySubEffects = showRallySubEffects ? [
      { key: "second-wind",  labelKey: "EX2E.RallySecondWind",  disabled: false, disabledReason: null },
      { key: "organisation", labelKey: "EX2E.RallyOrganisation", disabled: false, disabledReason: null },
      { key: "numbers",      labelKey: "EX2E.RallyNumbers",      disabled: !numbersEligible, disabledReason: numbersEligible ? null : "EX2E.RallyNumbersIneligible" },
    ] : [];
    const selectedRallySubEffect = this._selectedRallySubEffect ?? "second-wind";

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
      formationOptions,
      showAttackedCheckbox: selectedDef?.key === "change-formation",
      showSplitInput:       selectedDef?.key === "split",
      splitMaxMagnitude,
      showMergeInfo:        selectedDef?.key === "merge" && hasTarget,
      showMergeNoTarget:    selectedDef?.key === "merge" && !hasTarget,
      mergeTargetName:      hasTarget ? targetActor.name : "",
      mergeResultMagnitude,
      hasTarget,
      showRallySubEffects,
      rallySubEffects,
      selectedRallySubEffect,
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
      pool = applyRelayBonus(cha + Math.max(war, perf), unitSystem.relayCommandPool ?? 0);
      diff = Math.max(1, mag - drill);
    } else if (this._selectedAction === "charge") {
      pool = cha + war;
      diff = Math.max(1, mag - drill);
    } else {
      // change-formation
      const attackedSinceLastAction = this.element?.querySelector('[name="attackedSinceLastAction"]')?.checked ?? false;
      pool = applyRelayBonus(cha + war, unitSystem.relayCommandPool ?? 0);
      diff = computeChangeFormationDifficulty(mag, drill, { engaged: unitSystem.engaged, attackedSinceLastAction });
    }

    if (pool <= 0) {
      ui.notifications.warn(game.i18n.localize("EX2E.CannotRollZeroPool"));
      return;
    }
    const roll   = new ExaltedRoll({ pool });
    const result = await roll.evaluate();
    this._rollResult = {
      pool,
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
    const targetToken = [...game.user.targets][0];
    const targetActor = targetToken?.actor ?? null;
    const hasTarget   = !!targetActor && targetActor.type === "unit";
    const isBlocked  = (action.blockedIfHesitating && hesitating)
                     || (action.requiresRanged && !unitSystem.rangedCombatRating)
                     || (action.blockedIfNotEngaged && !unitSystem.engaged)
                     || (action.requiresTarget && !hasTarget);
    if (isBlocked) {
      ui.notifications.warn(game.i18n.localize("EX2E.JoinWarRollFirst"));
      return;
    }

    // 1. Execute action-specific effect
    switch (this._selectedAction) {
      case "close-attack":
        await rollMassCombatAttack(unit, { ranged: false });
        break;

      case "ranged-attack":
        await rollMassCombatAttack(unit, { ranged: true });
        break;

      case "aim":
        await unit.update({ "system.aimBonus": 3 });
        break;

      case "charge":
        await rollCharge(unit);
        break;

      case "turn":
        await rollTurnUnit(unit);
        break;

      case "change-formation": {
        const select = this.element?.querySelector("select[name='targetFormation']");
        const newFormation = select?.value ?? unitSystem.formation;
        const attackedSinceLastAction = this.element?.querySelector('[name="attackedSinceLastAction"]')?.checked ?? false;
        await rollChangeFormation(unit, {
          newFormation,
          attackedSinceLastAction,
          pool:        this._rollResult?.pool ?? 0,
          successes:   this._rollResult?.successes ?? 0,
          diceDetails: this._rollResult?.diceDetails ?? [],
          success:     this._rollResult?.success ?? false,
          diff:        this._rollResult?.diff ?? 1,
        });
        break;
      }

      case "disengage":
        await rollDisengage(unit);
        break;

      case "split": {
        const newUnitMagnitude = parseInt(
          this.element?.querySelector('[name="newUnitMagnitude"]')?.value ?? "1",
          10
        );
        await rollSplitUnit(unit, { newUnitMagnitude });
        break;
      }

      case "merge": {
        if (!targetActor) {
          ui.notifications.warn(game.i18n.localize("EX2E.NoTargetUnit"));
          return;
        }
        const resultMagnitude = computeMergeMagnitude(
          unit.system.magnitude.value,
          targetActor.system.magnitude.value
        );
        await rollMergeUnits(unit, targetActor, { resultMagnitude });
        break;
      }

      case "rally": {
        const subEffect = this.element?.querySelector('[name="rallySubEffect"]:checked')?.value ?? "second-wind";
        await rollRally(unit, {
          subEffect,
          pool:        this._rollResult?.pool ?? 0,
          successes:   this._rollResult?.successes ?? 0,
          diceDetails: this._rollResult?.diceDetails ?? [],
          success:     this._rollResult?.success ?? false,
          diff:        this._rollResult?.diff ?? 1,
        });
        break;
      }

      case "signal":
        await performSignalUnits(unit);
        break;

      default:
        if (action.needsRoll) {
          await this._postActionChatCard(action, null);
        }
        break;
    }

    // If this unit was absorbed in a merge, skip housekeeping
    if (!game.actors.get(this._unitActor.id)) {
      this.close();
      return;
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

    // 4. Clear hesitating (rally handles this internally; skip to avoid clearing on failure)
    if (this._selectedAction !== "rally" && this._combatant?.flags?.exalted2e?.hesitating) {
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
        : game.i18n.localize(action.key === "rally" ? "EX2E.RallyFailed" : action.key === "change-formation" ? "EX2E.FormationChangeFailed" : "EX2E.ActionFailed");
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
