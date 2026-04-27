import { computeAttackExcellencyCaps } from "../rolls/excellency-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * SocialAttackDialog — Collects social attack configuration.
 * Used by ExaltedRoll.rollSocialAttack().
 */
export class SocialAttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-social-attack-dialog",
    // Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
    // miscomputes `left` when it writes through a native modal <dialog>
    // element that also has `height: "auto"`, leaving the window stuck
    // off-axis. Using the standard Foundry window frame gives us
    // predictable, draggable positioning.
    classes: ["exalted2e", "roll-dialog", "social-attack-dialog"],
    position: { width: 420, height: "auto" },
    window: {
      title:        "EX2E.SocialAttackTitle",
      resizable:    false,
      minimizable:  false
    },
    actions: {
      confirmSocialAttack: SocialAttackDialog.#onConfirm,
      pickTarget:          SocialAttackDialog.#onPickTarget
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/social-attack-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._attacker = options.attacker;
    this._data = {
      target:       options.target       ?? game.user.targets.first()?.actor ?? null,
      attribute:    options.attribute    ?? "charisma",
      ability:      options.ability      ?? "presence",
      intent:       options.intent       ?? "build",
      subject:      options.subject      ?? "",
      claims:       options.claims       ?? {
        supportingIntimacy:   false,
        supportingVirtue:     false,
        supportingMotivation: false,
        opposingIntimacy:     false,
        opposingVirtue:       false,
        opposingMotivation:   false,
        immediateThreat:      false,
        unnaturalInfluence:   false
      },
      stuntDice:    String(options.stuntDice ?? 0),
      // 3c-1: Excellency block defaults
      moteType:     options.moteType     ?? "peripheral",
      firstExcDice: options.firstExcDice ?? 0,
      secondExcSucc: options.secondExcSucc ?? 0
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const a = this._attacker;
    const t = this._data.target;
    const attAppVal = a?.system?.attributes?.appearance?.value ?? 0;
    const defAppVal = t?.system?.attributes?.appearance?.value ?? 0;
    const appearanceDelta = Math.max(-3, Math.min(3, attAppVal - defAppVal));

    // 3c-1: charm picker. Filter to social-ability supplemental/reflexive-step-1
    // charms keyed to the currently-selected ability, excluding Excellencies.
    const SOCIAL_ABILITIES = ["presence", "performance", "investigation", "bureaucracy"];
    const allCharms = a?.items?.filter(i => i.type === "charm") ?? [];
    const eligible = allCharms.filter(c => {
      if (c.system.excellency) return false;
      if (c.system.ability !== this._data.ability) return false;
      if (!SOCIAL_ABILITIES.includes(c.system.ability)) return false;
      const ct = c.system.charmType;
      if (ct === "supplemental") return true;
      if (ct === "reflexive" && (c.system.steps ?? []).includes(1)) return true;
      return false;
    });
    const pickerCharms = eligible.map(c => {
      const cost = c.system?.cost ?? {};
      const parts = [];
      if (cost.motes)            parts.push(`${cost.motes}m`);
      if (cost.willpower)        parts.push(`${cost.willpower}wp`);
      if (cost.bashingHealth)    parts.push(`${cost.bashingHealth}hl(B)`);
      if (cost.lethalHealth)     parts.push(`${cost.lethalHealth}hl(L)`);
      if (cost.aggravatedHealth) parts.push(`${cost.aggravatedHealth}hl(A)`);
      if (cost.xp)               parts.push(`${cost.xp}xp`);
      const kws = c.system?.keywords ?? [];
      const TAG_KEYWORDS = ["Unnatural Mental Influence", "Compel", "Emotion", "Illusion"];
      const tags = kws.filter(k => TAG_KEYWORDS.includes(k));
      return {
        id:        c.id,
        name:      c.name,
        costLabel: parts.join(" · "),
        tagLabel:  tags.join(", "),
        isUmi:     kws.includes("Unnatural Mental Influence")
      };
    });

    // 3c-1: Excellency caps
    const { firstExcMax, secondExcMax } = a
      ? computeAttackExcellencyCaps(a, this._data.attribute, this._data.ability)
      : { firstExcMax: 0, secondExcMax: 0 };

    return {
      ...context,
      ...this._data,
      appearanceDelta,
      pickerCharms,
      hasPickerCharms: pickerCharms.length > 0,
      firstExcMax,
      secondExcMax,
      stuntChoices: {
        0: game.i18n.localize("EX2E.NoStunt"),
        1: game.i18n.localize("EX2E.Stunt1"),
        2: game.i18n.localize("EX2E.Stunt2"),
        3: game.i18n.localize("EX2E.Stunt3")
      },
      moteTypeChoices: {
        personal:   game.i18n.localize("EX2E.MotesPersonal"),
        peripheral: game.i18n.localize("EX2E.MotesPeripheral")
      }
    };
  }

  _onRender(context, options) {
    const el = this.element;
    const firstExcInput  = el.querySelector("[name='firstExcDice']");
    const secondExcInput = el.querySelector("[name='secondExcSucc']");
    const totalCostEl    = el.querySelector(".exc-total-cost");
    const umiCheckbox    = el.querySelector("[name='unnaturalInfluence']");
    const umiHint        = el.querySelector(".umi-charm-driven-hint");
    const pickerInputs   = el.querySelectorAll(".social-charm-picker input[type='checkbox']");

    let currentFirstExcMax  = context.firstExcMax;
    let currentSecondExcMax = context.secondExcMax;

    const enforceExcCap = () => {
      if (!firstExcInput || !secondExcInput) return;
      const firstVal  = parseInt(firstExcInput.value)  || 0;
      const secondVal = (parseInt(secondExcInput.value) || 0) * 2;
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax,  currentFirstExcMax - secondVal);
      secondExcInput.max  = Math.max(0, secondAllowed);
      firstExcInput.max   = Math.max(0, firstAllowed);
      const firstMaxEl  = el.querySelector(".exc-first-max");
      const secondMaxEl = el.querySelector(".exc-second-max");
      if (firstMaxEl)  firstMaxEl.textContent  = Math.max(0, firstAllowed);
      if (secondMaxEl) secondMaxEl.textContent = Math.max(0, secondAllowed);
      if (firstVal  > firstAllowed)  firstExcInput.value  = Math.max(0, firstAllowed);
      if ((parseInt(secondExcInput.value) || 0) > secondAllowed) secondExcInput.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcCap();
      if (!totalCostEl) return;
      const firstCost  = parseInt(firstExcInput?.value)  || 0;
      const secondCost = (parseInt(secondExcInput?.value) || 0) * 2;
      totalCostEl.textContent = firstCost + secondCost;
    };

    const updateUmiLock = () => {
      const anyUmiPicked = Array.from(pickerInputs).some(input => {
        if (!input.checked) return false;
        return input.dataset.umi === "true";
      });
      if (!umiCheckbox) return;
      if (anyUmiPicked) {
        umiCheckbox.checked  = true;
        umiCheckbox.disabled = true;
        if (umiHint) umiHint.style.display = "";
      } else {
        umiCheckbox.disabled = false;
        if (umiHint) umiHint.style.display = "none";
      }
    };

    firstExcInput?.addEventListener("input",  updateTotal);
    secondExcInput?.addEventListener("input", updateTotal);
    pickerInputs.forEach(input => input.addEventListener("change", updateUmiLock));

    // Re-render on attribute/ability change so the picker filter and
    // Excellency caps refresh against the new selection.
    const attrSelect    = el.querySelector("[name='attribute']");
    const abilitySelect = el.querySelector("[name='ability']");
    attrSelect?.addEventListener("change", (e) => {
      this._data.attribute = e.target.value;
      this.render();
    });
    abilitySelect?.addEventListener("change", (e) => {
      this._data.ability = e.target.value;
      this.render();
    });

    updateTotal();
    updateUmiLock();
  }

  static async #onPickTarget(event, target) {
    const { pickTargetActor } = await import("../helpers/targeting.mjs");
    const picked = await pickTargetActor();
    if (picked) {
      this._data.target = picked;
      this.render();
    }
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    if (!this._data.target) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetSelected"));
      return;
    }

    // 3c-1: Collect picker charm ids (checkboxes named charm-<id>).
    const charmIds = Object.keys(data)
      .filter(k => k.startsWith("charm-") && data[k])
      .map(k => k.slice("charm-".length));

    this._resolved = true;
    this._resolve({
      defender:  this._data.target,
      attribute: data.attribute  || "charisma",
      ability:   data.ability    || "presence",
      intent:    data.intent     || "build",
      subject:   data.subject    || "",
      claims: {
        supportingIntimacy:   !!data.supportingIntimacy,
        supportingVirtue:     !!data.supportingVirtue,
        supportingMotivation: !!data.supportingMotivation,
        opposingIntimacy:     !!data.opposingIntimacy,
        opposingVirtue:       !!data.opposingVirtue,
        opposingMotivation:   !!data.opposingMotivation,
        immediateThreat:      !!data.immediateThreat,
        unnaturalInfluence:   !!data.unnaturalInfluence
      },
      stuntDice:     Number(data.stuntDice) || 0,
      // 3c-1
      charmIds,
      firstExcDice:  parseInt(data.firstExcDice)  || 0,
      secondExcSucc: parseInt(data.secondExcSucc) || 0,
      moteType:      data.moteType || "peripheral"
    });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new SocialAttackDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
