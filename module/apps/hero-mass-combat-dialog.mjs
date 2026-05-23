import { rollHeroAttacksUnit } from "../rolls/mass-combat-roll.mjs";
import { ExaltedRoll }          from "../rolls/exalted-roll.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const HERO_ACTIONS = [
  { key: "close-attack",  labelKey: "EX2E.ActionAttackClose",   speed: 5, dvMod: -2 },
  { key: "ranged-attack", labelKey: "EX2E.ActionAttackRanged",  speed: 5, dvMod: -2, requiresRanged: true },
  { key: "aim",           labelKey: "EX2E.ActionAim",           speed: 3, dvMod:  0 },
  { key: "guard",         labelKey: "EX2E.ActionGuard",         speed: 3, dvMod:  1 },
  { key: "move",          labelKey: "EX2E.ActionMove",          speed: 5, dvMod:  0 },
  { key: "inactive",      labelKey: "EX2E.ActionInactive",      speed: 1, dvMod:  0 }
];

export class HeroMassCombatDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-hero-mass-combat-dialog",
    classes:  ["exalted2e", "roll-dialog", "hero-mass-combat-dialog"],
    position: { width: 480, height: "auto" },
    window:   { title: "EX2E.HeroMassCombatActions", resizable: false, minimizable: false },
    actions:  {
      selectAction: HeroMassCombatDialog.#onSelectAction,
      selectWeapon: HeroMassCombatDialog.#onSelectWeapon,
      roll:         HeroMassCombatDialog.#onRoll,
      confirm:      HeroMassCombatDialog.#onConfirm,
      cancel:       HeroMassCombatDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/hero-mass-combat.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve        = resolve;
    this._resolved       = false;
    this._heroActor      = options.heroActor;
    this._combat         = game.combat ?? null;
    this._combatant      = this._combat?.combatants.find(c => c.actor?.id === options.heroActor.id) ?? null;
    this._selectedAction = null;
    this._selectedWeapon = null;
    this._rollResult     = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const targetToken = [...game.user.targets][0] ?? null;
    const targetActor = targetToken?.actor ?? null;
    const hasTarget   = !!targetActor;
    const targetName  = targetActor?.name ?? null;
    const targetIsUnit = targetActor?.type === "unit";

    const weapons   = this._heroActor.items.filter(i => i.type === "weapon");
    const hasRanged = weapons.some(w => w.system.ranged);

    const actions = HERO_ACTIONS.map(a => ({
      ...a,
      label:    game.i18n.localize(a.labelKey),
      selected: a.key === this._selectedAction,
      blocked:  a.requiresRanged && !hasRanged
    }));

    const selectedDef = HERO_ACTIONS.find(a => a.key === this._selectedAction) ?? null;
    const isAttack    = selectedDef?.key === "close-attack" || selectedDef?.key === "ranged-attack";
    const ranged      = selectedDef?.key === "ranged-attack";

    const weaponRows = isAttack
      ? weapons
          .filter(w => ranged ? w.system.ranged : !w.system.ranged)
          .map(w => ({
            id:       w.id,
            name:     w.name,
            ability:  w.system.ability ?? "melee",
            damage:   w.system.damage  ?? 0,
            selected: w.id === this._selectedWeapon?.id
          }))
      : [];

    const canRoll    = isAttack && !!this._selectedWeapon && hasTarget;
    const canConfirm = !!selectedDef && (!isAttack || !!this._rollResult);

    return {
      ...context,
      hasTarget,
      targetName,
      targetIsUnit,
      actions,
      selectedAction: this._selectedAction,
      isAttack,
      weaponRows,
      rollResult:     this._rollResult,
      canRoll,
      canConfirm
    };
  }

  static #onSelectAction(_event, target) {
    this._selectedAction = target.dataset.actionKey;
    this._selectedWeapon = null;
    this._rollResult     = null;
    this.render();
  }

  static #onSelectWeapon(_event, target) {
    const weaponId = target.dataset.weaponId;
    this._selectedWeapon = this._heroActor.items.get(weaponId) ?? null;
    this._rollResult     = null;
    this.render();
  }

  static async #onRoll(_event, _target) {
    if (!this._selectedWeapon) return;
    const targetToken = [...game.user.targets][0] ?? null;
    const targetActor = targetToken?.actor ?? null;
    if (!targetActor) {
      ui.notifications.warn(game.i18n.localize("EX2E.HeroNoTarget"));
      return;
    }
    const ranged = this._selectedAction === "ranged-attack";
    if (targetActor.type === "unit") {
      await rollHeroAttacksUnit(this._heroActor, targetActor, this._selectedWeapon, { ranged });
    } else {
      await ExaltedRoll.rollAttack(this._heroActor, this._selectedWeapon.id, { explicitTargetActor: targetActor });
    }
    this._rollResult = true;
    this.render();
  }

  static async #onConfirm(_event, _target) {
    if (!this._selectedAction) return;
    const action   = HERO_ACTIONS.find(a => a.key === this._selectedAction);
    if (!action) return;
    const isAttack = action.key === "close-attack" || action.key === "ranged-attack";

    if (isAttack && !this._rollResult) return;

    if (action.key === "aim") {
      await this._heroActor.update({ "system.aimBonus": 3 });
    }

    if (this._combat && this._combatant) {
      await this._combat.advanceCurrentByTicks(action.speed);
    }
    if (action.dvMod < 0) {
      const label = game.i18n.localize(action.labelKey);
      await this._heroActor.applyDVPenalty("parry", Math.abs(action.dvMod), { label });
      await this._heroActor.applyDVPenalty("dodge", Math.abs(action.dvMod), { label });
    }
    if (this._combatant?.flags?.exalted2e?.hesitating) {
      await this._combatant.unsetFlag("exalted2e", "hesitating");
    }

    this._resolved = true;
    this._resolve(true);
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

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new HeroMassCombatDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
