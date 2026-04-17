const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Step2DefenseDialog — opens when the defender clicks Dodge or Parry on an
 * attack-result card. Lists Reflexive Step-2 Charms and, when the defender
 * owns one, exposes First/Second Excellency inputs that mirror the attack
 * dialog (same live cap enforcement + mote total).
 *
 * Resolves to:
 *   { charmIds: string[],
 *     firstExcDice: number,
 *     secondExcSucc: number,
 *     moteType: "personal" | "peripheral" }
 * or `null` if cancelled.
 */
export class Step2DefenseDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-step2-defense-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 400, height: "auto" },
    window: {
      title:     "EX2E.Step2DefenseDialogTitle",
      resizable: false
    },
    actions: {
      confirm: Step2DefenseDialog.#onConfirm,
      cancel:  Step2DefenseDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/step2-defense-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data = {
      charms:         options.charms         ?? [],
      defenseType:    options.defenseType    ?? "dodge",
      dv:             options.dv             ?? 0,
      targetName:     options.targetName     ?? null,
      excellency:     options.excellency     ?? { first: false, second: false },
      firstExcMax:    options.firstExcMax    ?? 0,
      secondExcMax:   options.secondExcMax   ?? 0,
      firstExcLabel:  options.firstExcLabel  ?? game.i18n.localize("EX2E.FirstExcellency"),
      secondExcLabel: options.secondExcLabel ?? game.i18n.localize("EX2E.SecondExcellency")
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const labelKey = this._data.defenseType === "parry" ? "EX2E.ParryDV" : "EX2E.DodgeDV";
    const exc      = this._data.excellency;
    return {
      ...context,
      defenseLabelKey: labelKey,
      dv:           this._data.dv,
      targetName:   this._data.targetName,
      charms:       this._data.charms.map(c => {
        const cost = c.system.cost ?? {};
        const parts = [];
        if (cost.motes)        parts.push(`${cost.motes}m`);
        if (cost.willpower)    parts.push(`${cost.willpower}wp`);
        if (cost.healthLevels) parts.push(`${cost.healthLevels}hl`);
        return { id: c.id, name: c.name, costLabel: parts.join(" · ") };
      }),
      excellency:     exc,
      hasExcellency:  !!(exc.first || exc.second),
      firstExcMax:    this._data.firstExcMax,
      secondExcMax:   this._data.secondExcMax,
      firstExcLabel:  this._data.firstExcLabel,
      secondExcLabel: this._data.secondExcLabel,
      moteTypeChoices: {
        personal:   game.i18n.localize("EX2E.MotesPersonal"),
        peripheral: game.i18n.localize("EX2E.MotesPeripheral")
      }
    };
  }

  _onRender(context, options) {
    const el             = this.element;
    const firstExcInput  = el.querySelector("[name='firstExcDice']");
    const secondExcInput = el.querySelector("[name='secondExcSucc']");
    const totalCostEl    = el.querySelector(".exc-total-cost");
    if (!firstExcInput && !secondExcInput) return;

    const firstExcMax  = this._data.firstExcMax;
    const secondExcMax = this._data.secondExcMax;

    const enforceExcCap = () => {
      const firstVal  = parseInt(firstExcInput?.value)  || 0;
      const secondVal = (parseInt(secondExcInput?.value) || 0) * 2;
      const secondAllowed = Math.min(secondExcMax, Math.floor((firstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(firstExcMax, firstExcMax - secondVal);
      if (secondExcInput) secondExcInput.max = Math.max(0, secondAllowed);
      if (firstExcInput)  firstExcInput.max  = Math.max(0, firstAllowed);
      const firstMaxEl  = el.querySelector(".exc-first-max");
      const secondMaxEl = el.querySelector(".exc-second-max");
      if (firstMaxEl)  firstMaxEl.textContent  = Math.max(0, firstAllowed);
      if (secondMaxEl) secondMaxEl.textContent = Math.max(0, secondAllowed);
      if (firstExcInput  && firstVal  > firstAllowed)  firstExcInput.value  = Math.max(0, firstAllowed);
      if (secondExcInput && (parseInt(secondExcInput.value) || 0) > secondAllowed) {
        secondExcInput.value = Math.max(0, secondAllowed);
      }
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

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new FormDataExtended(form);
    const data = fd.object;

    const charmIds = Object.keys(data)
      .filter(k => k.startsWith("charm-") && data[k])
      .map(k => k.slice("charm-".length));

    this._resolved = true;
    this._resolve({
      charmIds,
      firstExcDice:  parseInt(data.firstExcDice)  || 0,
      secondExcSucc: parseInt(data.secondExcSucc) || 0,
      moteType:      data.moteType || "peripheral"
    });
    this.close();
  }

  static #onCancel(event, target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new Step2DefenseDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
