const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * SorceryCastDialog — confirms motes/WP cost before declaring the
 * first shape action. Mirrors the charm-activation confirm pattern.
 *
 * Resolves a Promise to {ok: true} on confirm, {ok: false} on cancel
 * or close.
 *
 * Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
 * miscomputes `left` when it writes through a native modal <dialog>
 * element that also has `height: "auto"`, leaving the window stuck
 * off-axis. Use the standard Foundry window frame instead.
 */
export class SorceryCastDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-sorcery-cast-dialog",
    classes: ["exalted2e", "sorcery-cast-dialog"],
    position: { width: 420, height: "auto" },
    window: {
      title:     "EX2E.SpellCastConfirmTitle",
      resizable: false
    },
    actions: {
      confirm: SorceryCastDialog.#onConfirm,
      cancel:  SorceryCastDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/sorcery-cast-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._data = {
      spell:  options.spell,
      actor:  options.actor,
      circle: options.circle ?? 1
    };
  }

  get title() {
    return game.i18n.format("EX2E.SpellCastConfirmTitle", {
      spell: this._data.spell?.name ?? ""
    });
  }

  async _prepareContext(_options) {
    const a = this._data.actor;
    const s = this._data.spell;
    const totalShapeActions = this._data.circle;
    const dvMod = { 1: 2, 2: 3, 3: 4 }[totalShapeActions] ?? 2;
    const tradition = s?.system?.tradition ?? "sorcery";
    const traditionKey = tradition === "necromancy"
      ? "EX2E.TraditionNecromancy"
      : "EX2E.TraditionSorcery";
    const circleKeyMap = {
      sorcery:    { 1: "EX2E.CircleTerrestrial", 2: "EX2E.CircleCelestial", 3: "EX2E.CircleSolar" },
      necromancy: { 1: "EX2E.CircleShadowlands", 2: "EX2E.CircleLabyrinth", 3: "EX2E.CircleVoid" }
    };
    return {
      spellName: s?.name ?? "",
      traditionLabel: game.i18n.localize(traditionKey),
      circleLabel:    game.i18n.localize(circleKeyMap[tradition]?.[totalShapeActions] ?? "EX2E.CircleTerrestrial"),
      motesCost:      s?.system?.cost?.motes ?? 0,
      wpCost:         s?.system?.cost?.willpower ?? 0,
      peripheralVal:  a?.system?.motes?.peripheral?.value ?? 0,
      peripheralMax:  a?.system?.motes?.peripheral?.max ?? 0,
      personalVal:    a?.system?.motes?.personal?.value ?? 0,
      personalMax:    a?.system?.motes?.personal?.max ?? 0,
      wpVal:          a?.system?.willpower?.value ?? 0,
      wpMax:          a?.system?.willpower?.max ?? 0,
      hint: game.i18n.format("EX2E.SpellCastConfirmHint", {
        speed: 5,
        dvMod,
        total: totalShapeActions
      })
    };
  }

  static #onConfirm(_event, _target) {
    this._resolved = true;
    this._resolve({ ok: true });
    this.close();
  }

  static #onCancel(_event, _target) {
    this._resolved = true;
    this._resolve({ ok: false });
    this.close();
  }

  _onClose(_options) {
    if (!this._resolved) this._resolve({ ok: false });
  }

  /**
   * Static helper. Returns {ok: true} on confirm, {ok: false} on cancel.
   *
   * @param {object} args
   * @param {object} args.spell — Foundry Item
   * @param {object} args.actor — Foundry Actor
   * @param {number} args.circle — 1 | 2 | 3
   * @returns {Promise<{ok: boolean}>}
   */
  static async prompt({ spell, actor, circle }) {
    return new Promise(resolve => {
      const dialog = new SorceryCastDialog({ spell, actor, circle }, resolve);
      dialog.render({ force: true });
    });
  }
}
