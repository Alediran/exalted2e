import { EX2E } from "../../config.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class KnackSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "knack"],
    position: { width: 480, height: 440 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:     editImageAction,
      addKeyword:    KnackSheet.#onAddKeyword,
      removeKeyword: KnackSheet.#onRemoveKeyword
    }
  };

  get title() {
    return this.document.name;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/knack/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/knack/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      isEditable:   this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(item), {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  static async #onAddKeyword(event, target) {
    const keywords = foundry.utils.deepClone(this.document.system.keywords ?? []);
    keywords.push(EX2E.knackKeywords[0] ?? "");
    await this.document.update({ "system.keywords": keywords });
  }

  static async #onRemoveKeyword(event, target) {
    const idx      = parseInt(target.dataset.index);
    const keywords = foundry.utils.deepClone(this.document.system.keywords ?? []);
    keywords.splice(idx, 1);
    await this.document.update({ "system.keywords": keywords });
  }
}
