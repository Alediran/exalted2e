const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { eruptionTotal, canIncrementCategory } from "../combat/eruption-math.mjs";

const CATEGORIES = [
  { key: "blight",   labelKey: "EX2E.EruptionBlight"   },
  { key: "branding", labelKey: "EX2E.EruptionBranding" },
  { key: "conduit",  labelKey: "EX2E.EruptionConduit"  },
  { key: "stigmata", labelKey: "EX2E.EruptionStigmata" },
];

const ICONS = {
  blight:               "icons/svg/acid.svg",
  branding:             "icons/svg/eye.svg",
  conduit:              "icons/svg/terror.svg",
  stigmata:             "icons/svg/blood.svg",
  "stigmata-crippling": "icons/svg/degen.svg",
};

export class EruptionAllocationDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, points, options = {}) {
    super(options);
    this.actor       = actor;
    this.points      = points;
    this._allocation = { blight: 0, branding: 0, conduit: 0, stigmata: 0 };
  }

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "eruption-allocation-dialog"],
    position: { width: 380, height: "auto" },
    window:   { resizable: false, title: "EX2E.EruptionAllocation" },
    actions:  {
      confirmAllocation: EruptionAllocationDialog.#onConfirm,
    },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/eruption-allocation.hbs" },
  };

  static open(actor, points) {
    new EruptionAllocationDialog(actor, points).render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      actor:      this.actor,
      points:     this.points,
      categories: CATEGORIES.map(c => ({ ...c, value: this._allocation[c.key] })),
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll(".eruption-step-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat     = btn.dataset.category;
        const input   = this.element.querySelector(`.eruption-cat-input[data-category="${cat}"]`);
        const step    = parseInt(btn.dataset.step);
        const current = Math.max(0, parseInt(input.value) || 0);
        const total = eruptionTotal(
          [...this.element.querySelectorAll(".eruption-cat-input")].map(el => parseInt(el.value))
        );
        if (!canIncrementCategory(current, step, total, this.points)) return;
        input.value = current + step;
        this.#updateTotal();
      });
    });
  }

  #updateTotal() {
    const inputs = [...this.element.querySelectorAll(".eruption-cat-input")];
    const total  = eruptionTotal(inputs.map(el => parseInt(el.value)));
    const display = this.element.querySelector(".eruption-total-display");
    display.textContent = `${total} / ${this.points}`;
    display.classList.toggle("at-target", total === this.points);
    this.element.querySelector(".eruption-confirm-btn").disabled = total !== this.points;
    inputs.forEach(el => {
      this._allocation[el.dataset.category] = Math.max(0, parseInt(el.value) || 0);
    });
  }

  static async #onConfirm(_event, _target) {
    await _applyEruptionScripts(this.actor, this._allocation);
    this.close();
  }
}

export async function _applyEruptionScripts(actor, allocation) {
  const aesToCreate = [];

  for (const { key, labelKey } of CATEGORIES) {
    const tier = allocation[key] ?? 0;
    if (tier < 1) continue;
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    aesToCreate.push({
      name:        `${game.i18n.localize(labelKey)} ${tier}`,
      img:         ICONS[key] ?? "icons/svg/aura.svg",
      description: game.i18n.localize(`EX2E.Eruption${capKey}Effect${tier}`),
      flags:       { exalted2e: { eruptionScript: { type: key, tier } } },
    });
    if (key === "stigmata" && tier >= 4) {
      aesToCreate.push({
        name:  game.i18n.localize("EX2E.EruptionStigmataCrippling"),
        img:   ICONS["stigmata-crippling"],
        flags: { exalted2e: { eruptionScript: { type: "stigmata-crippling", tier } } },
      });
    }
  }

  if (aesToCreate.length) {
    await actor.createEmbeddedDocuments("ActiveEffect", aesToCreate);
  }

  const stigmataTier = allocation.stigmata ?? 0;
  if (stigmataTier >= 2) {
    await actor.applyDamage(stigmataTier, "lethal");
  }

  await actor.update({ "system.limit": 0 });
}
