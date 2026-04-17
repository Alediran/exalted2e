const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Step2DefenseDialog — lets the defender pick which of their Reflexive
 * Step-2 Charms to activate before committing a Dodge or Parry DV.
 *
 * Resolves to `{ charmIds: string[] }` on confirm, or `null` if cancelled.
 */
export class Step2DefenseDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-step2-defense-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 380, height: "auto" },
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
      charms:       options.charms       ?? [],
      defenseType:  options.defenseType  ?? "dodge",
      dv:           options.dv           ?? 0,
      targetName:   options.targetName   ?? null
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const labelKey = this._data.defenseType === "parry" ? "EX2E.ParryDV" : "EX2E.DodgeDV";
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
        return {
          id:        c.id,
          name:      c.name,
          costLabel: parts.join(" · ")
        };
      })
    };
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new FormDataExtended(form);
    const data = fd.object;

    const charmIds = Object.keys(data)
      .filter(k => k.startsWith("charm-") && data[k])
      .map(k => k.slice("charm-".length));

    this._resolved = true;
    this._resolve({ charmIds });
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
