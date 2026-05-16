import { moteCostString, charmVariableCostCtx, extractCharmActivations } from "./activation-ledger.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * AttackDialog – Collects attack configuration: target DV, stunt, excellencies.
 * Used by ExaltedRoll.rollAttack().
 */
export class AttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-attack-dialog",
    // Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
    // miscomputes `left` when it writes through a native modal <dialog>
    // element that also has `height: "auto"`, leaving the window stuck
    // off-axis. Using the standard Foundry window frame gives us
    // predictable, draggable positioning. (Same fix as SocialAttackDialog.)
    classes: ["exalted2e", "roll-dialog", "attack-dialog"],
    position: { width: 450, height: "auto" },
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
      pool:                options.pool                ?? 1,
      stunt:               options.stunt               ?? 0,
      advancesMotivation:  options.advancesMotivation  ?? false,
      rewardKind:          options.rewardKind          ?? "motes",
      moteType:            options.moteType            ?? "peripheral",
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
      charms:              options.charms              ?? [],
      virtues:             options.virtues             ?? null,
      actor:               options.actor               ?? null,
      firstExcCostPerDie:  options.firstExcCostPerDie  ?? 1,
      secondExcCostPerSucc: options.secondExcCostPerSucc ?? 2
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Project each charm down to the fields the template needs — name, cost
    // label, and the keywords array so the UI can flag Unblockable /
    // Undodgeable picks.
    const rollData = this._data.actor?.getRollData?.() ?? {};
    const charms = this._data.charms.map(c => {
      const cost = c.system?.cost ?? {};
      const parts = [];
      const mStr = moteCostString(cost); if (mStr) parts.push(mStr);
      const keywords = c.system?.keywords ?? [];
      return {
        id:          c.id,
        name:        c.name,
        costLabel:   parts.join(" · "),
        keywords,
        tagLabel:    keywords.filter(k => k === "Unblockable" || k === "Undodgeable").join(", "),
        ...charmVariableCostCtx(c, rollData),
      };
    });
    this._charms = charms;
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

    const stuntSelect    = el.querySelector("[name='stunt']");
    const firstHidden    = el.querySelector("[name='firstExcDice']");
    const secondHidden   = el.querySelector("[name='secondExcSucc']");
    const totalCostEl    = el.querySelector(".exc-total-cost");
    const firstPipTrack  = el.querySelector(".exc-pip-track[data-exc='first']");
    const secondPipTrack = el.querySelector(".exc-pip-track[data-exc='second']");
    const motivationRow  = el.querySelector(".stunt-motivation-row");
    const rewardPrefRow  = el.querySelector(".stunt-reward-pref-row");

    const currentFirstExcMax  = this._data.firstExcMax;
    const currentSecondExcMax = this._data.secondExcMax;

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

    const refreshPips = (track, hidden, allowedMax) => {
      if (!track) return;
      const current = parseInt(hidden?.value) || 0;
      track.querySelectorAll(".exc-pip").forEach(pip => {
        const v = parseInt(pip.dataset.value);
        pip.classList.toggle("is-filled", v <= current);
        pip.disabled = v > allowedMax;
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

    // ── Excellency cap enforcement ───────────────────────────────────────
    const enforceExcCap = () => {
      const firstVal  = parseInt(firstHidden?.value)  || 0;
      const secondVal = (parseInt(secondHidden?.value) || 0) * 2;
      const secondAllowed = Math.min(currentSecondExcMax, Math.floor((currentFirstExcMax - firstVal) / 2));
      const firstAllowed  = Math.min(currentFirstExcMax,  currentFirstExcMax - secondVal);
      refreshPips(firstPipTrack,  firstHidden,  Math.max(0, firstAllowed));
      refreshPips(secondPipTrack, secondHidden, Math.max(0, secondAllowed));
      if (firstVal > firstAllowed && firstHidden)
        firstHidden.value = Math.max(0, firstAllowed);
      if ((parseInt(secondHidden?.value) || 0) > secondAllowed && secondHidden)
        secondHidden.value = Math.max(0, secondAllowed);
    };

    const updateTotal = () => {
      enforceExcCap();
      if (!totalCostEl) return;
      const firstDice  = parseInt(firstHidden?.value)  || 0;
      const secondSucc = parseInt(secondHidden?.value) || 0;
      const firstCost  = firstDice  * (this._data.firstExcCostPerDie   ?? 1);
      const secondCost = secondSucc * (this._data.secondExcCostPerSucc ?? 2);
      totalCostEl.textContent = firstCost + secondCost;
    };

    // ── Pip click handlers for excellencies ──────────────────────────────
    buildPipTrack(firstPipTrack, firstHidden, currentFirstExcMax, (v) => {
      const current = parseInt(firstHidden?.value) || 0;
      firstHidden.value = current === v ? 0 : v;
      updateTotal();
    });
    buildPipTrack(secondPipTrack, secondHidden, currentSecondExcMax, (v) => {
      const current = parseInt(secondHidden?.value) || 0;
      secondHidden.value = current === v ? 0 : v;
      updateTotal();
    });

    updateTotal();

    // ── Virtue channel ───────────────────────────────────────────────────
    const virtueSelectRow = el.querySelector(".virtue-select-row");
    const updateVirtueMode = () => {
      const checked = el.querySelector("[name='virtueChannelMode']:checked")?.value ?? "none";
      if (virtueSelectRow) virtueSelectRow.style.display = checked === "dice" ? "" : "none";
    };
    el.querySelectorAll("[name='virtueChannelMode']").forEach(r => r.addEventListener("change", updateVirtueMode));
    updateVirtueMode();

    // ── Per-unit charm inputs: pips (bounded) or number (open-ended) ────
    el.querySelectorAll("input[data-charm-id]").forEach(checkbox => {
      const charmId  = checkbox.dataset.charmId;
      const pipTrack = el.querySelector(`.charm-units-pips[data-charm-id="${charmId}"]`);

      if (pipTrack) {
        // Bounded cost → pip track
        const unitsHidden = pipTrack.querySelector(`input[name="charm-units-${charmId}"]`);
        const maxPips = parseInt(pipTrack.dataset.max) || 0;
        const minPips = parseInt(pipTrack.dataset.min) || 0;

        const refreshCharmPips = () => {
          const current = parseInt(unitsHidden?.value) || 0;
          pipTrack.querySelectorAll(".exc-pip").forEach(pip => {
            const v = parseInt(pip.dataset.value);
            pip.classList.toggle("is-filled", v <= current);
            pip.disabled = !checkbox.checked;
          });
        };

        for (let i = 1; i <= maxPips; i++) {
          const pip = document.createElement("button");
          pip.type = "button";
          pip.className = "exc-pip";
          pip.dataset.value = i;
          pipTrack.insertBefore(pip, unitsHidden);
          pip.addEventListener("click", () => {
            if (!checkbox.checked) return;
            const current = parseInt(unitsHidden?.value) || 0;
            unitsHidden.value = current === i ? minPips : i;
            refreshCharmPips();
          });
        }

        checkbox.addEventListener("change", () => {
          if (!checkbox.checked && unitsHidden) unitsHidden.value = minPips;
          refreshCharmPips();
        });
        refreshCharmPips();

      } else {
        // Open-ended cost → plain number input
        const unitsInput = el.querySelector(`input[name="charm-units-${charmId}"]`);
        if (!unitsInput) return;
        const syncUnits = () => {
          unitsInput.disabled = !checkbox.checked;
          if (!checkbox.checked) unitsInput.value = unitsInput.min || 0;
        };
        checkbox.addEventListener("change", syncUnits);
        syncUnits();
        unitsInput.addEventListener("input", () => {
          const min = parseInt(unitsInput.min) || 0;
          const max = unitsInput.max !== "" ? parseInt(unitsInput.max) : Infinity;
          let val = parseInt(unitsInput.value);
          if (isNaN(val)) val = min;
          unitsInput.value = Math.max(min, Math.min(max, val));
        });
      }
    });
  }

  static #onConfirmAttack(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    // Collect ticked charm checkboxes + their variable-cost picker selections.
    const charmActivations = extractCharmActivations(data, this._charms ?? []);
    const charmIds = charmActivations.map(a => a.id);

    this._resolved = true;
    this._resolve({
      pool:               parseInt(data.pool)     || this._data.pool,
      stunt:              parseInt(data.stunt)    || 0,
      advancesMotivation: !!data.stuntAdvancesMotivation,
      rewardKind:         data.stuntRewardKind === "willpower" ? "willpower" : "motes",
      moteType:           data.moteType           || "peripheral",
      firstExcDice:       parseInt(data.firstExcDice)  || 0,
      secondExcSucc:      parseInt(data.secondExcSucc) || 0,
      charmIds,
      charmActivations,
      virtueChannelMode: data.virtueChannelMode || "none",
      virtueChannel:     data.virtueChannelMode === "dice" ? (data.virtueChannel || null) : null
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
