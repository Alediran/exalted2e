import { EX2E } from "../../config.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class CharmSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "charm"],
    position: { width: 540, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addKeyword:    CharmSheet.#onAddKeyword,
      removeKeyword: CharmSheet.#onRemoveKeyword
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/charm/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/charm/body.hbs", scrollable: [".sheet-body"] }
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
      charmTypes:   Object.entries(EX2E.charmTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      durations:    Object.entries(EX2E.durations).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      exaltTypes:   Object.entries(EX2E.exaltTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      abilities:    EX2E.abilities.map(k => ({ value: k, label: game.i18n.localize(EX2E.abilityLabels[k] ?? k) })),
      excellencies: [
        { value: "",       label: game.i18n.localize("EX2E.ExcellencyNone") },
        { value: "first",  label: game.i18n.localize("EX2E.FirstExcellency") },
        { value: "second", label: game.i18n.localize("EX2E.SecondExcellency") },
        { value: "third",  label: game.i18n.localize("EX2E.ThirdExcellency") }
      ],
      allKeywords:  EX2E.charmKeywords,
      isEditable:   this.isEditable,
      enrichedDescription: await TextEditor.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  static async #onAddKeyword(event, target) {
    const keywords = foundry.utils.deepClone(this.document.system.keywords ?? []);
    keywords.push(EX2E.charmKeywords[0] ?? "");
    await this.document.update({ "system.keywords": keywords });
  }

  static async #onRemoveKeyword(event, target) {
    const idx      = parseInt(target.dataset.index);
    const keywords = foundry.utils.deepClone(this.document.system.keywords ?? []);
    keywords.splice(idx, 1);
    await this.document.update({ "system.keywords": keywords });
  }
}
