import { EX2E } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Default action key seeded into new rows when the dialog opens. Resolved
 * lazily so edits to EX2E.actions don't require changing this constant —
 * the first action flagged `isFlurry: true` in config wins.
 */
function defaultFlurryActionKey() {
  const entry = Object.entries(EX2E.actions).find(([, a]) => a.isFlurry);
  return entry?.[0] ?? Object.keys(EX2E.actions)[0];
}

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
    // Flurries need at least 2 actions; prime the UI with two Attack rows.
    this._actions = [this._rowFromAction(defaultFlurryActionKey()),
                     this._rowFromAction(defaultFlurryActionKey())];
  }

  /** Build a row seeded from a config action key. Speed/dvMod are overridable. */
  _rowFromAction(key) {
    const a = EX2E.actions[key] ?? EX2E.actions[defaultFlurryActionKey()] ?? { speed: 5, dvMod: 0 };
    return { actionKey: key, speed: a.speed, dvMod: a.dvMod };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const n = this._actions.length;
    // Localized action options for the per-row dropdown. Canon forbids
    // some actions (Guard, Aim, Inactive…) from appearing in a flurry, so
    // filter them out via the `isFlurry` flag carried on the config entry.
    const actionOptions = EX2E.getActionList().filter(a => a.isFlurry);
    return {
      ...context,
      actorName:     this._actorName,
      actions:       this._actions,
      actionOptions,
      canRemove:     n > 2,
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

  /**
   * Wire the per-row action dropdown so picking a preset repopulates the
   * Speed and DV Mod inputs for that row. Manual edits to either field are
   * preserved until the dropdown is changed again.
   */
  _onRender(context, options) {
    const form = this.element.querySelector("form");
    if (!form) return;
    form.querySelectorAll(".flurry-row[data-index] [name$='.actionKey']").forEach(select => {
      select.addEventListener("change", (ev) => {
        const key = ev.currentTarget.value;
        const cfg = EX2E.actions[key];
        if (!cfg) return;
        const row = ev.currentTarget.closest(".flurry-row");
        const speedInput = row?.querySelector("[name$='.speed']");
        const dvInput    = row?.querySelector("[name$='.dvMod']");
        if (speedInput) speedInput.value = cfg.speed;
        if (dvInput)    dvInput.value    = cfg.dvMod;
      });
    });
  }

  /** Read every row's current input values back into the in-memory action list. */
  _syncFromForm() {
    const form = this.element.querySelector("form");
    if (!form) return;
    const rows = form.querySelectorAll(".flurry-row[data-index]");
    const next = [];
    rows.forEach((row) => {
      next.push({
        actionKey: row.querySelector("[name$='.actionKey']")?.value ?? defaultFlurryActionKey(),
        speed:     parseInt(row.querySelector("[name$='.speed']")?.value) || 0,
        dvMod:     parseInt(row.querySelector("[name$='.dvMod']")?.value) || 0
      });
    });
    if (next.length > 0) this._actions = next;
  }

  static #onAddAction(event, target) {
    this._syncFromForm();
    this._actions.push(this._rowFromAction(defaultFlurryActionKey()));
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
      // Preserve actionKey and resolve a label at declaration time so the
      // flurry flag reads naturally later (e.g. in tooltips / audit logs).
      actions: this._actions.map(a => ({
        actionKey: a.actionKey,
        name:      game.i18n.localize(EX2E.actions[a.actionKey]?.labelKey ?? a.actionKey),
        speed:     a.speed,
        dvMod:     a.dvMod
      })),
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
