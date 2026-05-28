import { buildEligibleCharms, moteRange, getCountermagicTier, emitDispelSpellEffect } from "../helpers/countermagic-helpers.mjs";
import { emitInterruptShaping } from "../combat/multi-tick-sorcery.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CountermagicDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-countermagic-dialog",
    classes: ["exalted2e", "countermagic-dialog"],
    position: { width: 380, height: "auto" },
    window: { resizable: false },
    actions: {
      confirm: CountermagicDialog.#onConfirm,
      cancel:  CountermagicDialog.#onCancel,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/countermagic-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._target         = options.target;
    this._counterActor   = options.counterActor;
    this._eligibleCharms = options.eligibleCharms;
    this._circle         = options.circle ?? 1;
  }

  get title() {
    return game.i18n.localize("EX2E.CountermagicTitle");
  }

  async _prepareContext(_options) {
    const target = this._target;
    const actor  = this._counterActor;

    let spellName  = "";
    let tradition  = "sorcery";
    let circle     = 1;
    let casterName = null;

    if (target.type === "shaping") {
      const state = target.combatant.flags?.exalted2e?.multiTickAction?.state ?? {};
      spellName  = state.spellName ?? "";
      tradition  = target.combatant.flags?.exalted2e?.multiTickAction?.actionKey === "necromancy"
                     ? "necromancy" : "sorcery";
      circle     = state.circle ?? 1;
      casterName = target.combatant.actor?.name ?? "";
    } else {
      const flag = target.ae.flags?.exalted2e?.spellEffect ?? {};
      spellName  = flag.spellName ?? target.ae.name;
      tradition  = flag.tradition ?? "sorcery";
      circle     = flag.circle ?? 1;
      if (target.type === "effect-other") casterName = target.targetActor?.name ?? "";
    }

    // Highest-tier first so the default selection has the widest mote range.
    this._eligibleCharms.sort((a, b) => getCountermagicTier(b) - getCountermagicTier(a));

    const charmRangeList = this._eligibleCharms.map(c => {
      const { min, max } = moteRange(getCountermagicTier(c), circle);
      return { charm: c, moteMin: min, moteMax: max };
    });
    const firstRange = charmRangeList[0] ?? { moteMin: 10, moteMax: 10 };

    const circleKeyMap = {
      sorcery:    { 1: "EX2E.CircleTerrestrial", 2: "EX2E.CircleCelestial", 3: "EX2E.CircleSolar" },
      necromancy: { 1: "EX2E.CircleShadowlands", 2: "EX2E.CircleLabyrinth", 3: "EX2E.CircleVoid" },
    };
    const traditionKey = tradition === "necromancy" ? "EX2E.TraditionNecromancy" : "EX2E.TraditionSorcery";

    return {
      spellName,
      casterName,
      traditionLabel: game.i18n.localize(traditionKey),
      circleLabel:    game.i18n.localize(circleKeyMap[tradition]?.[circle] ?? "EX2E.CircleTerrestrial"),
      charmRangeList,
      moteMin:       firstRange.moteMin,
      moteMax:       firstRange.moteMax,
      hasRange:      firstRange.moteMin < firstRange.moteMax,
      peripheralVal: actor?.system?.motes?.peripheral?.value ?? 0,
      peripheralMax: actor?.system?.motes?.peripheral?.max   ?? 0,
      personalVal:   actor?.system?.motes?.personal?.value   ?? 0,
      personalMax:   actor?.system?.motes?.personal?.max     ?? 0,
    };
  }

  _onRender(_context, _options) {
    const el          = this.element;
    const slider      = el.querySelector(".mote-slider");
    const display     = el.querySelector(".mote-display");
    const motesInput  = el.querySelector(".motes-value");
    const rangeGroup  = el.querySelector(".mote-range-group");
    const fixedGroup  = el.querySelector(".mote-fixed-group");
    const fixedValue  = el.querySelector(".mote-fixed-value");
    const charmSelect = el.querySelector("[name=charmIndex]");

    const updateMoteRange = (min, max) => {
      const hasRange = min < max;
      if (rangeGroup)  rangeGroup.style.display  = hasRange ? "" : "none";
      if (fixedGroup)  fixedGroup.style.display  = hasRange ? "none" : "";
      if (slider) { slider.min = min; slider.max = max; slider.value = min; }
      if (display)    display.textContent    = min + "m";
      if (motesInput) motesInput.value       = min;
      if (fixedValue) fixedValue.textContent = min + "m";
    };

    if (slider) {
      slider.addEventListener("input", () => {
        if (display)    display.textContent = slider.value + "m";
        if (motesInput) motesInput.value    = slider.value;
      });
    }

    if (charmSelect) {
      charmSelect.addEventListener("change", () => {
        const opt = charmSelect.options[charmSelect.selectedIndex];
        updateMoteRange(
          parseInt(opt.dataset.min ?? "10", 10),
          parseInt(opt.dataset.max ?? "10", 10)
        );
      });
    }
  }

  static async #onConfirm(_event, _btn) {
    const form  = this.element.querySelector(".countermagic-dialog");
    const idx   = parseInt(form.querySelector("[name=charmIndex]")?.value ?? "0", 10);
    const charm = this._eligibleCharms[idx];
    const { min: moteMin } = moteRange(getCountermagicTier(charm), this._circle);
    const motes = parseInt(form.querySelector("[name=motes]")?.value ?? String(moteMin), 10);

    if (!charm) { this._resolved = true; this._resolve(false); this.close(); return; }

    let ok = false;
    if (charm.type === "spell") {
      const result = await this._counterActor.spendMotes(motes, "peripheral");
      ok = !!result;
    } else {
      ok = await charm.activateCharm({ explicitMotesOverride: motes });
    }
    if (!ok) { this._resolved = true; this._resolve(false); this.close(); return; }

    const target = this._target;
    const actor  = this._counterActor;

    if (target.type === "shaping") {
      const stillShaping = target.combatant.flags?.exalted2e?.multiTickAction ?? null;
      if (!stillShaping) {
        ui.notifications.warn(game.i18n.localize("EX2E.CountermagicAlreadyResolved"));
        this._resolved = true;
        this._resolve(false);
        this.close();
        return;
      }
      await emitInterruptShaping(target.combatant, actor.name);
    } else if (target.type === "effect-self") {
      if (target.ae.parent?.effects?.get(target.ae.id)) {
        await target.ae.delete();
      }
    } else if (target.type === "effect-other") {
      await emitDispelSpellEffect(target.targetActor.id, target.ae.id);
    }

    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  static #onCancel(_event, _btn) {
    this._resolved = true;
    this._resolve(false);
    this.close();
  }

  _onClose(_options) {
    if (!this._resolved) this._resolve(false);
  }

  static async open(target, counterActor) {
    let circle    = 1;
    let tradition = "sorcery";
    if (target.type === "shaping") {
      const state = target.combatant.flags?.exalted2e?.multiTickAction?.state ?? {};
      circle    = state.circle ?? 1;
      tradition = target.combatant.flags?.exalted2e?.multiTickAction?.actionKey === "necromancy"
                    ? "necromancy" : "sorcery";
    } else {
      const flag = target.ae.flags?.exalted2e?.spellEffect ?? {};
      circle    = flag.circle ?? 1;
      tradition = flag.tradition ?? "sorcery";
    }

    const eligibleCharms = buildEligibleCharms(counterActor, circle, tradition);
    if (!eligibleCharms.length) {
      ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoEligibleCharm"));
      return false;
    }

    if (target.type === "effect-other") {
      const gmOnline = game.users.some(u => u.isGM && u.active);
      if (!gmOnline && !game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoGMOnline"));
        return false;
      }
    }

    return new Promise(resolve => {
      const dlg = new CountermagicDialog({ target, counterActor, eligibleCharms, circle }, resolve);
      dlg.render({ force: true });
    });
  }
}
