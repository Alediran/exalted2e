const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * RollDialog – A pre-roll configuration dialog letting players set:
 *   - stunt bonus (0-3)
 *   - mote cost and pool
 *   - attribute selector (updates pool dynamically)
 *   - First / Second / Third Excellency (shown only when the actor owns the charm)
 *
 * Uses data-action="confirmRoll" instead of a form submit button to avoid
 * the browser's default GET navigation behaviour inside <dialog> elements.
 */
export class RollDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-roll-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 360, height: "auto" },
    window: {
      title:     "EX2E.RollDialogTitle",
      resizable: false
    },
    actions: {
      confirmRoll: RollDialog.#onConfirmRoll
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/roll-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data     = {
      pool:                options.pool                ?? 1,
      flavor:              options.flavor              ?? "",
      stunt:               options.stunt               ?? 0,
      moteCost:            options.moteCost            ?? 0,
      moteType:            options.moteType            ?? "peripheral",
      actorName:           options.actorName           ?? "",
      attribute:           options.attribute           ?? "",
      attributeChoices:    options.attributeChoices    ?? [],
      attributeValues:     options.attributeValues     ?? {},
      abilityValue:        options.abilityValue        ?? 0,
      specialties:         options.specialties         ?? [],
      // Excellency
      excellency:          options.excellency          ?? { first: false, second: false, third: false },
      excellencyPerAttr:   options.excellencyPerAttr   ?? null,
      isAttrBased:         options.isAttrBased         ?? false,
      firstExcMax:         options.firstExcMax         ?? 0,
      secondExcMax:        options.secondExcMax        ?? 0,
      firstExcMaxPerAttr:  options.firstExcMaxPerAttr  ?? null,
      secondExcMaxPerAttr: options.secondExcMaxPerAttr ?? null
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      ...this._data,
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

    const attrSelect      = el.querySelector("[name='attribute']");
    const poolHidden      = el.querySelector("[name='pool']");
    const specialtySelect = el.querySelector("[name='specialty']");
    const moteCostInput   = el.querySelector("[name='moteCost']");
    const firstExcInput   = el.querySelector("[name='firstExcDice']");
    const secondExcInput  = el.querySelector("[name='secondExcSucc']");
    const thirdExcCheck   = el.querySelector("[name='useThirdExc']");
    const totalCostEl     = el.querySelector(".exc-total-cost");

    // Current excellency cap — may be updated when attribute changes (attr-based exalts)
    let currentFirstExcMax  = this._data.firstExcMax;
    let currentSecondExcMax = this._data.secondExcMax;

    const enforceExcCap = () => {
      if (!firstExcInput || !secondExcInput) return;
      const firstVal  = parseInt(firstExcInput.value)  || 0;
      const secondVal = parseInt(secondExcInput.value) * 2 || 0;

      // Remaining budget for each after the other's spend
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax,  currentFirstExcMax - secondVal);

      secondExcInput.max = Math.max(0, secondAllowed);
      firstExcInput.max  = Math.max(0, firstAllowed);

      // Update displayed max labels
      const firstMaxEl  = el.querySelector(".exc-first-max");
      const secondMaxEl = el.querySelector(".exc-second-max");
      if (firstMaxEl)  firstMaxEl.textContent  = Math.max(0, firstAllowed);
      if (secondMaxEl) secondMaxEl.textContent = Math.max(0, secondAllowed);

      // Clamp values if they now exceed the new max
      if (firstVal > firstAllowed)  firstExcInput.value  = Math.max(0, firstAllowed);
      if (secondVal > secondAllowed) secondExcInput.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcCap();
      if (!totalCostEl) return;
      const base       = parseInt(moteCostInput?.value)  || 0;
      const firstCost  = parseInt(firstExcInput?.value)  || 0;
      const secondCost = (parseInt(secondExcInput?.value) || 0) * 2;
      const thirdCost  = thirdExcCheck?.checked ? 4 : 0;
      totalCostEl.textContent = base + firstCost + secondCost + thirdCost + ' m';
    };

    const updatePool = () => {
      if (!attrSelect) return;
      const attrVal   = this._data.attributeValues?.[attrSelect.value] ?? 0;
      const specIdx   = parseInt(specialtySelect?.value);
      const specBonus = (!isNaN(specIdx) && this._data.specialties[specIdx])
        ? (this._data.specialties[specIdx].value ?? 1)
        : 0;
      const newPool = attrVal + this._data.abilityValue + specBonus;
      if (poolHidden) poolHidden.value = newPool;

      // For attribute-based Excellencies, update sections and max values dynamically
      if (this._data.isAttrBased) {
        const exc = this._data.excellencyPerAttr?.[attrSelect.value] ?? {};

        const firstSec  = el.querySelector(".exc-first-section");
        const secondSec = el.querySelector(".exc-second-section");
        const thirdSec  = el.querySelector(".exc-third-section");
        if (firstSec)  firstSec.style.display  = exc.first  ? "" : "none";
        if (secondSec) secondSec.style.display = exc.second ? "" : "none";
        if (thirdSec)  thirdSec.style.display  = exc.third  ? "" : "none";

        currentFirstExcMax  = this._data.firstExcMaxPerAttr?.[attrSelect.value]  ?? 0;
        currentSecondExcMax = this._data.secondExcMaxPerAttr?.[attrSelect.value] ?? 0;

        // Reset excellency inputs when attribute changes
        if (firstExcInput)  firstExcInput.value  = 0;
        if (secondExcInput) secondExcInput.value = 0;
      }

      updateTotal();
    };

    attrSelect?.addEventListener("change", updatePool);
    specialtySelect?.addEventListener("change", updatePool);
    moteCostInput?.addEventListener("input", updateTotal);
    firstExcInput?.addEventListener("input", updateTotal);
    secondExcInput?.addEventListener("input", updateTotal);
    thirdExcCheck?.addEventListener("change", updateTotal);

    updateTotal(); // initialise displayed total
  }

  /** Called when the Roll button is clicked via data-action="confirmRoll". */
  static #onConfirmRoll(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new FormDataExtended(form);
    const data = fd.object;

    const firstExcDice  = parseInt(data.firstExcDice)  || 0;
    const secondExcSucc = parseInt(data.secondExcSucc) || 0;
    const useThirdExc   = !!data.useThirdExc;
    const baseMotes     = parseInt(data.moteCost)       || 0;

    this._resolved = true;
    this._resolve({
      pool:         parseInt(data.pool)     || this._data.pool,
      attribute:    data.attribute          || this._data.attribute,
      flavor:       data.flavor             || this._data.flavor,
      stunt:        parseInt(data.stunt)    || 0,
      moteCost:     baseMotes,
      moteType:     data.moteType           || "peripheral",
      specialty:    (() => {
        const idx = parseInt(data.specialty);
        return (!isNaN(idx) && this._data.specialties[idx]) ? this._data.specialties[idx] : null;
      })(),
      firstExcDice,
      secondExcSucc,
      useThirdExc
    });
    this.close();
  }

  _onClose(options) {
    // Only resolve null if the dialog was dismissed without confirming
    if (!this._resolved) this._resolve(null);
  }

  /**
   * Static factory – shows the dialog and returns the configured roll data,
   * or null if the user cancelled.
   */
  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new RollDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
