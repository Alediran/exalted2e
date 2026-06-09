import { EX2E } from "../../config.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class VirtueFlawSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "virtueflaw"],
    position: { width: 480, height: 420 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:    editImageAction,
      addChange:    VirtueFlawSheet.#onAddChange,
      removeChange: VirtueFlawSheet.#onRemoveChange,
    }
  };

  get title() {
    return this.document.name;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/virtueflaw/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/virtueflaw/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    return {
      ...context,
      item,
      system:     sys,
      config:     EX2E,
      splatTypes: Object.entries(EX2E.splatTypes).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      virtues:    Object.entries(EX2E.virtues).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      isEditable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(this.document), {
        secrets: this.document.isOwner, relativeTo: this.document
      })
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
    // ArrayField removal: null-then-set forces a full replacement (index-wise
    // update is unreliable).
    await this.document.update({ "system.changes": null });
    await this.document.update({ "system.changes": changes });
  }
}
