import { EX2E } from "../../config.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class WeaponSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "weapon"],
    position: { width: 480, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addTag:    WeaponSheet.#onAddTag,
      removeTag: WeaponSheet.#onRemoveTag
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/weapon/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/weapon/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    return {
      ...context,
      item,
      system:      sys,
      config:      EX2E,
      damageTypes: [
        { value: "bashing",    label: game.i18n.localize("EX2E.DmgBashing") },
        { value: "lethal",     label: game.i18n.localize("EX2E.DmgLethal") },
        { value: "aggravated", label: game.i18n.localize("EX2E.DmgAggravated") }
      ],
      allTags:          EX2E.weaponTags,
      magicalMaterials: Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
        value: k,
        label: game.i18n.localize(v)
      })),
      isEditable: this.isEditable,
      enrichedDescription: await TextEditor.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  static async #onAddTag(event, target) {
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.push(EX2E.weaponTags[0] ?? "");
    await this.document.update({ "system.tags": tags });
  }

  static async #onRemoveTag(event, target) {
    const idx  = parseInt(target.dataset.index);
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.splice(idx, 1);
    await this.document.update({ "system.tags": tags });
  }
}
