import { EX2E } from "../../config.mjs";
import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class ResplendencySheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "resplendency"],
    position: { width: 480, height: 480 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      editImage:    editImageAction,
      addChange:    ResplendencySheet.#onAddChange,
      removeChange: ResplendencySheet.#onRemoveChange,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/resplendency/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/resplendency/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const sys  = item.system;
    return {
      ...context,
      item, system: sys, isEditable: this.isEditable,
      collegeChoices: Object.entries(EX2E.siderealColleges ?? {}).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v.labelKey)
      })),
      keywordChoices: ["", "Compulsion", "Illusion", "Servitude", "Training", "Crippling"],
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, { secrets: item.isOwner, relativeTo: item }
      ),
    };
  }

  static async #onAddChange(_event, _target) {
    const changes = foundry.utils.deepClone(this.document.system.changes ?? []);
    changes.push({ key: "", mode: 2, value: "" });
    await this.document.update({ "system.changes": changes });
  }

  static async #onRemoveChange(_event, target) {
    const idx = parseInt(target.dataset.index);
    const changes = foundry.utils.deepClone(this.document.system.changes ?? []);
    changes.splice(idx, 1);
    await this.document.update({ "system.changes": null });
    await this.document.update({ "system.changes": changes });
  }
}
