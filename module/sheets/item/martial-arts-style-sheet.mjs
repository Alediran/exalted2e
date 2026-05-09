import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class MartialArtsStyleSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "martial-arts-style"],
    position: { width: 480, height: 520 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  { editImage: editImageAction }
  };

  get title() {
    return this.document.name;
  }

  static PARTS = {
    form: { template: "systems/exalted2e/templates/item/martial-arts-style-sheet.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    const tierChoices = [
      { value: "terrestrial", label: game.i18n.localize("EX2E.MAStyleTierTerrestrial") },
      { value: "celestial",   label: game.i18n.localize("EX2E.MAStyleTierCelestial") },
      { value: "sidereal",    label: game.i18n.localize("EX2E.MAStyleTierSidereal") }
    ];
    const exaltTypeChoices = [
      { value: "",            label: "—" },
      { value: "solar",       label: "Solar" },
      { value: "lunar",       label: "Lunar" },
      { value: "terrestrial", label: "Dragon-Blooded" },
      { value: "sidereal",    label: "Sidereal" },
      { value: "abyssal",     label: "Abyssal" },
      { value: "infernal",    label: "Infernal" },
      { value: "alchemical",  label: "Alchemical" }
    ];
    return {
      ...context,
      item,
      system:     sys,
      isEditable: this.isEditable,
      tierChoices,
      exaltTypeChoices,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, { secrets: item.isOwner, relativeTo: item }
      )
    };
  }
}
