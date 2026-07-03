import { mansePowerEligible } from "../helpers/manse-geomancy.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Picker for manse-power catalog items. Resolves { name, cost, isMaterial } or null.
 */
export class MansePowerPickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:      "ex2e-manse-power-picker",
    classes: ["exalted2e", "roll-dialog", "manse-power-picker"],
    position: { width: 460 },
    window:  { title: "EX2E.MansePowerPickerTitle", resizable: true },
    actions: { pickPower: MansePowerPickerDialog.#onPick },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/manse-power-picker-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve   = resolve;
    this._resolved  = false;
    this._rating    = options.rating ?? 0;
    this._aspect    = options.manseAspect ?? "";
    this._existing  = new Set(options.existingNames ?? []);
    this._byName    = new Map(); // name -> { effectiveCost, isMaterial }
  }

  async _prepareContext(_options) {
    const pack     = game.packs.get("exalted2e-compendium.manse-powers");
    const packDocs = pack ? await pack.getDocuments() : [];
    const world    = game.items?.filter(i => i.type === "manse-power") ?? [];
    const byName   = new Map();
    for (const doc of [...packDocs, ...world]) byName.set(doc.name, doc);

    const groups = new Map(); // cost -> rows[]
    this._byName.clear();
    for (const doc of byName.values()) {
      const { eligible, effectiveCost, reasons } =
        mansePowerEligible(doc.system, { rating: this._rating, manseAspect: this._aspect });
      const alreadyAdded = !doc.system.multiPurchase && this._existing.has(doc.name);
      this._byName.set(doc.name, { effectiveCost, isMaterial: !!doc.system.isMaterial });
      const row = {
        name:       doc.name,
        baseCost:   doc.system.cost,
        effectiveCost,
        discounted: effectiveCost < (doc.system.cost ?? 0),
        eligible:   eligible && !alreadyAdded,
        alreadyAdded,
        reasons,
        abilityReq: doc.system.abilityReq,
      };
      const key = doc.system.cost ?? 0;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const grouped = [...groups.entries()].sort((a, b) => a[0] - b[0])
      .map(([cost, rows]) => ({ cost, rows: rows.sort((x, y) => x.name.localeCompare(y.name)) }));

    return { groups: grouped, rating: this._rating, aspect: this._aspect };
  }

  static #onPick(_event, target) {
    const name  = target.dataset.powerName;
    const entry = this._byName.get(name);
    if (!entry) return;
    this._resolved = true;
    this._resolve({ name, cost: entry.effectiveCost, isMaterial: entry.isMaterial });
    this.close();
  }

  _onClose(_options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dlg = new MansePowerPickerDialog(options, resolve);
      dlg.render({ force: true });
    });
  }
}
