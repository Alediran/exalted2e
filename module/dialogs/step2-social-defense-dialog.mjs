import { moteCostString } from "../rolls/activation-ledger.mjs";
import { computeExcellencyBudget } from "../rolls/excellency-math.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Step2SocialDefenseDialog — opens when the defender clicks Defend (Step-2)
 * on a social-attack chat card. Mirrors the physical Step-2 dialog: lists
 * Reflexive Step-2 social-defense charms and exposes First/Second Excellency
 * inputs that bump MDV. Mote cost cap enforcement is identical to the
 * physical dialog.
 *
 * Resolves to:
 *   { charmIds: string[],
 *     firstExcDice: number,
 *     secondExcSucc: number,
 *     moteType: "personal" | "peripheral" }
 * or `null` if cancelled.
 */
export class Step2SocialDefenseDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-step2-social-defense-dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 420, height: "auto" },
    window: {
      title:     "EX2E.Step2SocialDefenseDialogTitle",
      resizable: false
    },
    actions: {
      confirm: Step2SocialDefenseDialog.#onConfirm,
      cancel:  Step2SocialDefenseDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/step2-social-defense-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data = {
      charms:            options.charms            ?? [],
      intent:            options.intent            ?? "build",
      defenderMDV:       options.defenderMDV       ?? 0,
      attackerSuccesses: options.attackerSuccesses ?? 0,
      targetName:        options.targetName        ?? null,
      excellency:        options.excellency        ?? { first: false, second: false },
      firstExcMax:       options.firstExcMax       ?? 0,
      secondExcMax:      options.secondExcMax      ?? 0,
      firstExcLabel:     options.firstExcLabel     ?? game.i18n.localize("EX2E.FirstExcellency"),
      secondExcLabel:    options.secondExcLabel    ?? game.i18n.localize("EX2E.SecondExcellency")
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const intentLabelKey = {
      build:  "EX2E.IntentBuild",
      erode:  "EX2E.IntentErode",
      compel: "EX2E.IntentCompel"
    }[this._data.intent] ?? "EX2E.SocialAttack";
    const exc = this._data.excellency;
    return {
      ...context,
      intentLabelKey,
      defenderMDV:       this._data.defenderMDV,
      attackerSuccesses: this._data.attackerSuccesses,
      targetName:        this._data.targetName,
      charms:            this._data.charms.map(c => {
        const cost = c.system.cost ?? {};
        const parts = [];
        const mStr = moteCostString(cost); if (mStr) parts.push(mStr);
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
      const secondVal = parseInt(secondExcInput?.value) || 0;
      const { firstAllowed, secondAllowed } =
        computeExcellencyBudget(firstExcMax, secondExcMax, firstVal, secondVal);
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
    const fd   = new foundry.applications.ux.FormDataExtended(form);
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
      const dialog = new Step2SocialDefenseDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
