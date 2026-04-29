import { computeShapeshiftCost } from "../combat/shapeshift-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * ShapeshiftDialog — small modal opened by the Shapeshift action handler.
 * Lists Human Guise / Spirit Shape (if set) / each Heart's Blood form,
 * each labelled with its mote cost. User picks one; on confirm returns
 * `{ targetFormId, cost }`. On cancel/close returns `null` (action aborts).
 */
export class ShapeshiftDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-shapeshift",
    classes:  ["exalted2e", "shapeshift-dialog"],
    position: { width: 360, height: "auto" },
    window:   { title: "EX2E.ShapeshiftDialogTitle", resizable: false },
    actions:  {
      confirmShapeshift: ShapeshiftDialog.#onConfirm
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/shapeshift-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._actor    = options.actor;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this._actor;
    const sys = actor.system;
    const spiritId = sys.splat?.lunar?.spiritShapeFormId ?? "";
    const forms = actor.itemTypes?.form ?? actor.items.filter(i => i.type === "form");

    const formOptions = [
      { id: "", name: game.i18n.localize("EX2E.HumanShape"), cost: 1 }
    ];
    if (spiritId) {
      const spirit = forms.find(f => f.id === spiritId);
      if (spirit) {
        formOptions.push({
          id: spiritId,
          name: `${game.i18n.localize("EX2E.SpiritShape")}: ${spirit.name}`,
          cost: computeShapeshiftCost({ targetFormId: spiritId, spiritShapeFormId: spiritId })
        });
      }
    }
    for (const f of forms) {
      if (f.id === spiritId) continue;
      formOptions.push({
        id:   f.id,
        name: f.name,
        cost: computeShapeshiftCost({ targetFormId: f.id, spiritShapeFormId: spiritId })
      });
    }

    return { ...context, formOptions };
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form).object;
    const targetFormId = String(fd.targetFormId ?? "");
    // Recompute the cost server-side for safety (don't trust the form value).
    const spiritId = this._actor.system.splat?.lunar?.spiritShapeFormId ?? "";
    const cost = computeShapeshiftCost({ targetFormId, spiritShapeFormId: spiritId });
    this._resolved = true;
    this._resolve({ targetFormId, cost });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new ShapeshiftDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
