const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * CounterattackDialog — Step 9. The defender picks which Counterattack-
 * keyword Charm to activate and which weapon/mode to use for the reflexive
 * attack back at the original attacker.
 *
 * Resolves to `{ charmId, weaponId, modeIndex }` on confirm, or `null` if
 * cancelled.
 */
export class CounterattackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-counterattack-dialog",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog"],
    position: { width: 400, height: "auto" },
    window: {
      title:     "EX2E.CounterattackDialogTitle",
      resizable: false
    },
    actions: {
      confirm: CounterattackDialog.#onConfirm,
      cancel:  CounterattackDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/counterattack-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data = {
      charms:       options.charms       ?? [],
      weaponModes:  options.weaponModes  ?? [],
      targetName:   options.targetName   ?? null
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      targetName: this._data.targetName,
      charms: this._data.charms.map(c => {
        const cost = c.system.cost ?? {};
        const parts = [];
        if (cost.motes)        parts.push(`${cost.motes}m`);
        if (cost.willpower)    parts.push(`${cost.willpower}wp`);
        if (cost.healthLevels) parts.push(`${cost.healthLevels}hl`);
        return { id: c.id, name: c.name, costLabel: parts.join(" · ") };
      }),
      weaponModes: this._data.weaponModes
    };
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    const charmId = data.charmId;
    const weaponMode = data.weaponMode;  // encoded as "<weaponId>::<modeIndex>"
    if (!charmId || !weaponMode) {
      ui.notifications.warn(game.i18n.localize("EX2E.CounterattackPickRequired"));
      return;
    }
    const [weaponId, modeIdxStr] = weaponMode.split("::");
    this._resolved = true;
    this._resolve({
      charmId,
      weaponId,
      modeIndex: parseInt(modeIdxStr) || 0
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
      const dialog = new CounterattackDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
