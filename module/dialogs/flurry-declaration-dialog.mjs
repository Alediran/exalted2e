const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * FlurryDeclarationDialog — lets the active combatant lay out every action
 * they'll take this turn before rolling anything.
 *
 * Canon resolution once the flurry is declared:
 *   • Speed         = max(action.speed)
 *   • Dice penalty  = (N − 1) internal penalty applied to every roll
 *   • DV penalty    = max(action.dvMod) + (N − 1), stamped as an AE
 *
 * On confirm the dialog stamps the DV-penalty AE on the actor and writes a
 * flurry flag onto the combatant; the attack pipeline reads the dice penalty
 * from there, and Finish Turn uses the stored speed for the tick advance.
 */
export class FlurryDeclarationDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-flurry-declaration-dialog",
    tag:      "dialog",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 440, height: "auto" },
    window:   {
      title:     "EX2E.FlurryTitle",
      resizable: false
    },
    actions: {
      addAction:    FlurryDeclarationDialog.#onAddAction,
      removeAction: FlurryDeclarationDialog.#onRemoveAction,
      confirm:      FlurryDeclarationDialog.#onConfirm,
      cancel:       FlurryDeclarationDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/flurry-declaration-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve   = resolve;
    this._resolved  = false;
    this._actorName = options.actorName ?? "";
    // Flurries need at least 2 actions; prime the UI with two blank rows.
    this._actions = [
      { name: "", speed: 5, dvMod: 0 },
      { name: "", speed: 5, dvMod: 0 }
    ];
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const n = this._actions.length;
    return {
      ...context,
      actorName: this._actorName,
      actions:   this._actions,
      canRemove: n > 2,
      // Live preview so the player sees what the flurry will cost before
      // committing to it.
      preview: {
        count:       n,
        dicePenalty: n - 1,
        speed:       this._actions.reduce((m, a) => Math.max(m, a.speed ?? 0), 0),
        dvPenalty:   this._actions.reduce((m, a) => Math.max(m, a.dvMod ?? 0), 0) + (n - 1)
      }
    };
  }

  /** Read every row's current input values back into the in-memory action list. */
  _syncFromForm() {
    const form = this.element.querySelector("form");
    if (!form) return;
    const rows = form.querySelectorAll(".flurry-row");
    const next = [];
    rows.forEach((row, idx) => {
      next.push({
        name:  row.querySelector("[name$='.name']")?.value ?? "",
        speed: parseInt(row.querySelector("[name$='.speed']")?.value) || 0,
        dvMod: parseInt(row.querySelector("[name$='.dvMod']")?.value) || 0
      });
    });
    if (next.length > 0) this._actions = next;
  }

  static #onAddAction(event, target) {
    this._syncFromForm();
    this._actions.push({ name: "", speed: 5, dvMod: 0 });
    this.render();
  }

  static #onRemoveAction(event, target) {
    this._syncFromForm();
    if (this._actions.length <= 2) return;
    const idx = parseInt(target.dataset.index);
    if (Number.isFinite(idx)) this._actions.splice(idx, 1);
    this.render();
  }

  static #onConfirm(event, target) {
    this._syncFromForm();
    if (this._actions.length < 2) {
      ui.notifications.warn(game.i18n.localize("EX2E.FlurryMinTwoActions"));
      return;
    }
    const count       = this._actions.length;
    const dicePenalty = count - 1;
    const speed       = this._actions.reduce((m, a) => Math.max(m, a.speed ?? 0), 0);
    const maxDvMod    = this._actions.reduce((m, a) => Math.max(m, a.dvMod ?? 0), 0);
    const dvPenalty   = maxDvMod + (count - 1);

    this._resolved = true;
    this._resolve({
      actions: this._actions.map(a => ({ ...a })),
      count, dicePenalty, speed, dvPenalty
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

  /** @returns {Promise<null | {actions, count, dicePenalty, speed, dvPenalty}>} */
  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new FlurryDeclarationDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
