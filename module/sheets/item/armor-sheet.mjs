import { EX2E } from "../../config.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class ArmorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "armor"],
    position: { width: 440, height: 460 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addTag:    ArmorSheet.#onAddTag,
      removeTag: ArmorSheet.#onRemoveTag
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/armor/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/armor/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item:   this.document,
      system: this.document.system,
      config: EX2E,
      allTags: EX2E.armorTags,
      magicalMaterials: Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
        value: k,
        label: game.i18n.localize(v)
      })),
      isEditable: this.isEditable,
      enrichedDescription: await TextEditor.enrichHTML(this.document.system.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  static async #onAddTag(event, target) {
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.push(EX2E.armorTags[0] ?? "");
    await this.document.update({ "system.tags": tags });
  }

  static async #onRemoveTag(event, target) {
    const idx  = parseInt(target.dataset.index);
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.splice(idx, 1);
    await this.document.update({ "system.tags": tags });
  }
}
