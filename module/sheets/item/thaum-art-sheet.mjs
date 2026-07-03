import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class ThaummArtSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "thaum-art"],
    position: { width: 440, height: 400 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  { editImage: editImageAction },
  };

  get title() { return this.document.name; }

  static PARTS = {
    body: { template: "systems/exalted2e/templates/item/thaum-art-sheet.hbs", scrollable: [".sheet-body"] },
  };

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;
    this.element.querySelectorAll(".dot-rating .dot").forEach(dot => {
      dot.addEventListener("click", ev => {
        const track = ev.currentTarget.closest(".dot-rating");
        const name  = track?.dataset.name;
        const val   = parseInt(ev.currentTarget.dataset.value);
        if (name) this.document.update({ [name]: val });
      });
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    return {
      ...context,
      item,
      system:     sys,
      isEditable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        itemDescription(item), { secrets: item.isOwner, relativeTo: item }
      ),
    };
  }
}
