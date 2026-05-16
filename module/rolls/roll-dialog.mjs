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
      advancesMotivation:  options.advancesMotivation  ?? false,
      rewardKind:          options.rewardKind          ?? "motes",
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
      secondExcMaxPerAttr: options.secondExcMaxPerAttr ?? null,
      // Optional per-attribute dice-pool modifier, applied on top of the
      // attribute + ability + specialty math. External penalties (Prone,
      // future status effects) land here so the displayed pool tracks
      // whichever attribute the user picks in the dialog.
      poolPenaltyByAttr:   options.poolPenaltyByAttr   ?? null,
      clarityInfo:         options.clarityInfo         ?? null,
      virtues:             options.virtues             ?? null,
      firstExcCostPerDie:   options.firstExcCostPerDie   ?? 1,
      secondExcCostPerSucc: options.secondExcCostPerSucc ?? 2,
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
      },
      virtueChoices: this._data.virtues
        ? Object.entries(this._data.virtues)
            .map(([key, v]) => ({
              key,
              label:   game.i18n.localize(`EX2E.Virtue${key.charAt(0).toUpperCase() + key.slice(1)}`),
              current: v.current ?? 0,
              rating:  v.value   ?? 0
            }))
            .filter(v => v.rating > 0)
        : []
    };
  }

  _onRender(context, options) {
    const el = this.element;

    const attrSelect      = el.querySelector("[name='attribute']");
    const poolHidden      = el.querySelector("[name='pool']");
    const specialtySelect = el.querySelector("[name='specialty']");
    const moteCostInput   = el.querySelector("[name='moteCost']");
    const stuntSelect     = el.querySelector("[name='stunt']");
    const firstHidden     = el.querySelector("[name='firstExcDice']");
    const secondHidden    = el.querySelector("[name='secondExcSucc']");
    const thirdExcCheck   = el.querySelector("[name='useThirdExc']");
    const totalCostEl     = el.querySelector(".exc-total-cost");
    const firstPipTrack   = el.querySelector(".exc-pip-track[data-exc='first']");
    const secondPipTrack  = el.querySelector(".exc-pip-track[data-exc='second']");
    const motivationRow   = el.querySelector(".stunt-motivation-row");
    const rewardPrefRow   = el.querySelector(".stunt-reward-pref-row");

    let currentFirstExcMax  = this._data.firstExcMax;
    let currentSecondExcMax = this._data.secondExcMax;

    // ── Pip helpers ──────────────────────────────────────────────────────
    const buildPipTrack = (track, hidden, count, onPipClick) => {
      if (!track || count <= 0) return;
      for (let i = 1; i <= count; i++) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "exc-pip";
        pip.dataset.value = i;
        track.insertBefore(pip, hidden);
        pip.addEventListener("click", () => onPipClick(i));
      }
    };

    const refreshPips = (track, hidden, allowedMax, enabled = true) => {
      if (!track) return;
      const current = parseInt(hidden?.value) || 0;
      track.querySelectorAll(".exc-pip").forEach(pip => {
        const v = parseInt(pip.dataset.value);
        pip.classList.toggle("is-filled", enabled && v <= current);
        pip.disabled = !enabled || v > allowedMax;
      });
    };

    // ── Stunt sub-fields ─────────────────────────────────────────────────
    const updateStuntFields = () => {
      const v = parseInt(stuntSelect?.value) || 0;
      if (motivationRow) motivationRow.style.display = v >= 1 ? "" : "none";
      if (rewardPrefRow) rewardPrefRow.style.display = v >= 2 ? "" : "none";
    };
    stuntSelect?.addEventListener("change", updateStuntFields);
    updateStuntFields();

    // ── Excellency enforcement ───────────────────────────────────────────
    const enforceExcMutualExclusion = () => {
      if (!thirdExcCheck) return;
      if (thirdExcCheck.checked && firstHidden) firstHidden.value = "0";
      const firstDice = parseInt(firstHidden?.value) || 0;
      thirdExcCheck.disabled = firstDice > 0;
    };

    const enforceExcCap = () => {
      const firstVal  = parseInt(firstHidden?.value)  || 0;
      const secondVal = (parseInt(secondHidden?.value) || 0) * 2;
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax,  currentFirstExcMax - secondVal);
      const firstEnabled  = !thirdExcCheck?.checked;
      refreshPips(firstPipTrack,  firstHidden,  Math.max(0, firstAllowed),  firstEnabled);
      refreshPips(secondPipTrack, secondHidden, Math.max(0, secondAllowed));
      // Clamp hidden values if they now exceed the allowed max
      if (firstVal  > firstAllowed  && firstHidden)  firstHidden.value  = Math.max(0, firstAllowed);
      if ((parseInt(secondHidden?.value) || 0) > secondAllowed && secondHidden)
        secondHidden.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcMutualExclusion();
      enforceExcCap();
      if (!totalCostEl) return;
      const base       = parseInt(moteCostInput?.value)  || 0;
      const firstDice  = parseInt(firstHidden?.value)    || 0;
      const secondSucc = parseInt(secondHidden?.value)   || 0;
      const firstCost  = firstDice  * (this._data.firstExcCostPerDie   ?? 1);
      const secondCost = secondSucc * (this._data.secondExcCostPerSucc ?? 2);
      const thirdCost  = thirdExcCheck?.checked ? 4 : 0;
      totalCostEl.textContent = base + firstCost + secondCost + thirdCost + ' m';
    };

    // ── Pip click handlers for excellencies ──────────────────────────────
    buildPipTrack(firstPipTrack, firstHidden, this._data.firstExcMax, (v) => {
      const current = parseInt(firstHidden?.value) || 0;
      firstHidden.value = current === v ? 0 : v;
      updateTotal();
    });
    buildPipTrack(secondPipTrack, secondHidden, this._data.secondExcMax, (v) => {
      const current = parseInt(secondHidden?.value) || 0;
      secondHidden.value = current === v ? 0 : v;
      updateTotal();
    });

    // ── Pool / attribute updates ─────────────────────────────────────────
    const updatePool = () => {
      if (!attrSelect) return;
      const attrVal    = this._data.attributeValues?.[attrSelect.value] ?? 0;
      const specIdx    = parseInt(specialtySelect?.value);
      const specBonus  = (!isNaN(specIdx) && this._data.specialties[specIdx])
        ? (this._data.specialties[specIdx].value ?? 1) : 0;
      const extPenalty = this._data.poolPenaltyByAttr?.[attrSelect.value] ?? 0;
      const newPool    = Math.max(0, attrVal + this._data.abilityValue + specBonus + extPenalty);
      if (poolHidden) poolHidden.value = newPool;

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
        if (firstHidden)  firstHidden.value  = 0;
        if (secondHidden) secondHidden.value = 0;
      }
      updateTotal();
    };

    attrSelect?.addEventListener("change", updatePool);
    specialtySelect?.addEventListener("change", updatePool);
    moteCostInput?.addEventListener("input", updateTotal);
    thirdExcCheck?.addEventListener("change", updateTotal);
    updateTotal();

    // ── Virtue channel ───────────────────────────────────────────────────
    const virtueSelectRow = el.querySelector(".virtue-select-row");
    const updateVirtueMode = () => {
      const checked = el.querySelector("[name='virtueChannelMode']:checked")?.value ?? "none";
      if (virtueSelectRow) virtueSelectRow.style.display = checked === "dice" ? "" : "none";
    };
    el.querySelectorAll("[name='virtueChannelMode']").forEach(r => r.addEventListener("change", updateVirtueMode));
    updateVirtueMode();
  }

  /** Called when the Roll button is clicked via data-action="confirmRoll". */
  static #onConfirmRoll(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    const firstExcDice  = parseInt(data.firstExcDice)  || 0;
    const secondExcSucc = parseInt(data.secondExcSucc) || 0;
    const useThirdExc   = !!data.useThirdExc;
    const baseMotes     = parseInt(data.moteCost)       || 0;

    this._resolved = true;
    this._resolve({
      pool:               parseInt(data.pool)     || this._data.pool,
      attribute:          data.attribute          || this._data.attribute,
      flavor:             data.flavor             || this._data.flavor,
      stunt:              parseInt(data.stunt)    || 0,
      advancesMotivation: !!data.stuntAdvancesMotivation,
      rewardKind:         data.stuntRewardKind === "willpower" ? "willpower" : "motes",
      moteCost:           baseMotes,
      moteType:           data.moteType           || "peripheral",
      specialty:          (() => {
        const idx = parseInt(data.specialty);
        return (!isNaN(idx) && this._data.specialties[idx]) ? this._data.specialties[idx] : null;
      })(),
      firstExcDice,
      secondExcSucc,
      useThirdExc,
      virtueChannelMode: data.virtueChannelMode || "none",
      virtueChannel:     data.virtueChannelMode === "dice" ? (data.virtueChannel || null) : null
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
