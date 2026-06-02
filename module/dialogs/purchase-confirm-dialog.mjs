const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * PurchaseConfirmDialog — reusable Purchase-Mode confirmation.
 *
 * Consumed by:
 *   - Field-level enforcement (ExaltedActor._preUpdate): one instance
 *     per increasing permanent trait.
 *   - Item-level enforcement (createItem hook): one instance per
 *     XP-costing item being added.
 *   - Log-entry edit (CharacterSheet#onEditPurchaseEntry): re-opened
 *     on an existing entry with `isEdit: true`.
 *
 * Returns { xpCost: Number, note: String } on confirm, null on cancel.
 */
export class PurchaseConfirmDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-purchase-confirm",
    tag:      "dialog",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 420, height: "auto" },
    window:   { title: "EX2E.PurchaseConfirmTitle", resizable: false },
    actions:  {
      confirmPurchase: PurchaseConfirmDialog.#onConfirm,
      bypassPurchase:  PurchaseConfirmDialog.#onBypass,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/purchase-confirm-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._actor       = options.actor;
    this._change      = options.change;
    this._initialXp   = Number.isFinite(options.initialXp) ? options.initialXp : 0;
    this._initialNote = options.initialNote ?? "";
    this._isEdit      = !!options.isEdit;
    this._stubHint    = options.showStubHint !== false;
    this._description = options.description ?? "";
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const available = Number(this._actor?.system?.experience?.value ?? 0);
    return {
      ...context,
      traitLabel:   this._change?.traitLabel ?? this._description,
      oldValue:     this._change?.oldValue ?? "—",
      newValue:     this._change?.newValue ?? "—",
      initialXp:    this._initialXp,
      initialNote:  this._initialNote,
      stubHint:     this._stubHint,
      available,
      isEdit:       this._isEdit,
      isGM:         game.user.isGM
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const xpInput   = this.element.querySelector("input[name='xpCost']");
    const warningEl = this.element.querySelector(".purchase-overdraft");
    if (!xpInput || !warningEl) return;
    // Re-read available XP each refresh — the actor's value can change
    // between the dialog opening and the user's last keystroke if a
    // background update lands (concurrent GM edit, another purchase).
    const refresh = () => {
      const available = Number(this._actor?.system?.experience?.value ?? 0);
      const entered   = Number(xpInput.value) || 0;
      warningEl.hidden = entered <= available;
      warningEl.textContent = game.i18n.format("EX2E.PurchaseConfirmOverdraft", { available });
    };
    xpInput.addEventListener("input", refresh);
    refresh();
  }

  static #onBypass(_event, _target) {
    this._resolved = true;
    this._resolve({ xpCost: 0, note: game.i18n.localize("EX2E.PurchaseBypassNote") });
    this.close();
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form).object;
    const xpCost = Math.round(Number(fd.xpCost) || 0);
    const note   = String(fd.note ?? "").trim();
    this._resolved = true;
    this._resolve({ xpCost, note });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new PurchaseConfirmDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
