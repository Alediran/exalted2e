import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

const ATTRIBUTES = [
  "strength", "dexterity", "stamina",
  "charisma", "manipulation", "appearance",
  "perception", "intelligence", "wits",
];

export class ProcedureSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "procedure"],
    position: { width: 480, height: 520 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  { editImage: editImageAction },
  };

  get title() { return this.document.name; }

  static PARTS = {
    body: { template: "systems/exalted2e/templates/item/procedure-sheet.hbs", scrollable: [".sheet-body"] },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    return {
      ...context,
      item,
      system:     sys,
      isEditable: this.isEditable,
      attributeOptions: ATTRIBUTES.map(k => ({
        key:   k,
        label: game.i18n.localize(`EX2E.Attr${k.charAt(0).toUpperCase() + k.slice(1)}`),
      })),
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        itemDescription(item), { secrets: item.isOwner, relativeTo: item }
      ),
    };
  }
}
