const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * AttackDialog – Collects attack configuration: target DV, stunt, excellencies.
 * Used by ExaltedRoll.rollAttack().
 */
export class AttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-attack-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 360, height: "auto" },
    window: {
      title:     "EX2E.AttackRoll",
      resizable: false
    },
    actions: {
      confirmAttack: AttackDialog.#onConfirmAttack
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/attack-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data     = {
      pool:           options.pool           ?? 1,
      stunt:          options.stunt          ?? 0,
      moteType:       options.moteType       ?? "peripheral",
      excellency:     options.excellency     ?? { first: false, second: false, third: false },
      firstExcMax:    options.firstExcMax    ?? 0,
      secondExcMax:   options.secondExcMax   ?? 0,
      firstExcLabel:  options.firstExcLabel  ?? game.i18n.localize("EX2E.FirstExcellency"),
      secondExcLabel: options.secondExcLabel ?? game.i18n.localize("EX2E.SecondExcellency"),
      flurryPenalty:  options.flurryPenalty  ?? 0,
      // Non-Excellency attack charms (Supplemental / Simple) keyed to the
      // ability being rolled. Rendered as a checkbox list so the attacker
      // can activate Unblockable / Undodgeable (and similar) alongside the
      // attack roll.
      charms:         options.charms         ?? []
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Project each charm down to the fields the template needs — name, cost
    // label, and the keywords array so the UI can flag Unblockable /
    // Undodgeable picks.
    const charms = this._data.charms.map(c => {
      const cost = c.system?.cost ?? {};
      const parts = [];
      if (cost.motes)            parts.push(`${cost.motes}m`);
      if (cost.willpower)        parts.push(`${cost.willpower}wp`);
      if (cost.bashingHealth)    parts.push(`${cost.bashingHealth}hl(B)`);
      if (cost.lethalHealth)     parts.push(`${cost.lethalHealth}hl(L)`);
      if (cost.aggravatedHealth) parts.push(`${cost.aggravatedHealth}hl(A)`);
      if (cost.xp)               parts.push(`${cost.xp}xp`);
      const keywords = c.system?.keywords ?? [];
      return {
        id:          c.id,
        name:        c.name,
        costLabel:   parts.join(" · "),
        keywords,
        tagLabel:    keywords.filter(k => k === "Unblockable" || k === "Undodgeable").join(", ")
      };
    });
    return {
      ...context,
      ...this._data,
      charms,
      hasCharms: charms.length > 0,
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

    let currentFirstExcMax  = this._data.firstExcMax;
    let currentSecondExcMax = this._data.secondExcMax;

    const enforceExcCap = () => {
      if (!firstExcInput || !secondExcInput) return;
      const firstVal  = parseInt(firstExcInput.value)  || 0;
      const secondVal = (parseInt(secondExcInput.value) || 0) * 2;
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax, currentFirstExcMax - secondVal);
      secondExcInput.max = Math.max(0, secondAllowed);
      firstExcInput.max  = Math.max(0, firstAllowed);
      const firstMaxEl  = el.querySelector(".exc-first-max");
      const secondMaxEl = el.querySelector(".exc-second-max");
      if (firstMaxEl)  firstMaxEl.textContent  = Math.max(0, firstAllowed);
      if (secondMaxEl) secondMaxEl.textContent = Math.max(0, secondAllowed);
      if (firstVal > firstAllowed)  firstExcInput.value  = Math.max(0, firstAllowed);
      if ((parseInt(secondExcInput.value) || 0) > secondAllowed) secondExcInput.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcCap();
      if (!totalCostEl) return;
      const firstCost  = parseInt(firstExcInput?.value)  || 0;
      const secondCost = (parseInt(secondExcInput?.value) || 0) * 2;
      totalCostEl.textContent = firstCost + secondCost;
    };

    firstExcInput?.addEventListener("input", updateTotal);
    secondExcInput?.addEventListener("input", updateTotal);
    updateTotal();
  }

  static #onConfirmAttack(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    // Collect ticked charm checkboxes — each has name="charm-<id>".
    const charmIds = Object.keys(data)
      .filter(k => k.startsWith("charm-") && data[k])
      .map(k => k.slice("charm-".length));

    this._resolved = true;
    this._resolve({
      pool:          parseInt(data.pool)     || this._data.pool,
      stunt:         parseInt(data.stunt)    || 0,
      moteType:      data.moteType           || "peripheral",
      firstExcDice:  parseInt(data.firstExcDice)  || 0,
      secondExcSucc: parseInt(data.secondExcSucc) || 0,
      charmIds
    });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new AttackDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
