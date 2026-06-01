import { EX2E } from "../../config.mjs";
import { computeSpellCastButtonState } from "../../ui/spell-cast-button.mjs";
import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class SpellSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** Current tab group state. Defaults to the General (body) tab. */
  tabGroups = { sheet: "tabBody" };

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "spell"],
    position: { width: 520, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:    editImageAction,
      castSpell:    SpellSheet.#onCastSpell,
      createEffect: SpellSheet.#onCreateEffect,
      editEffect:   SpellSheet.#onEditEffect,
      deleteEffect: SpellSheet.#onDeleteEffect,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header:     { template: "systems/exalted2e/templates/item/spell/header.hbs" },
    tabs:       { classes: ["tabs-right"], template: "systems/exalted2e/templates/item/spell/tabs.hbs" },
    tabBody:    { template: "systems/exalted2e/templates/item/spell/body.hbs", scrollable: [".sheet-body"] },
    tabEffects: { template: "systems/exalted2e/templates/item/spell/tab-effects.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    const tabs = {
      tabBody:    { id: "tabBody",    group: "sheet", icon: "fa-solid fa-scroll",   label: game.i18n.localize("EX2E.TabGeneral"),  cssClass: this.tabGroups.sheet === "tabBody"    ? "active" : "" },
      tabEffects: { id: "tabEffects", group: "sheet", icon: "fa-solid fa-sparkles", label: game.i18n.localize("EX2E.TabEffects"),  cssClass: this.tabGroups.sheet === "tabEffects" ? "active" : "" }
    };

    const castButton = this._computeCastButtonState();

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      tabs,
      traditionChoices: [
        { value: "sorcery",    label: game.i18n.localize("EX2E.TraditionSorcery") },
        { value: "necromancy", label: game.i18n.localize("EX2E.TraditionNecromancy") },
        { value: "weaving",    label: game.i18n.localize("EX2E.TraditionWeaving") }
      ],
      circleChoices: this._circleChoicesFor(sys.tradition),
      durations: Object.entries(EX2E.durations).map(([k,v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      subtypeChoices: [
        { value: "",                label: game.i18n.localize("EX2E.SpellSubtypeNone") },
        { value: "ghost-summoning", label: game.i18n.localize("EX2E.SpellSubtypeGhostSummoning") },
        { value: "demon-summoning", label: game.i18n.localize("EX2E.SpellSubtypeDemonSummoning") },
      ],
      effects: item.effects.contents.map(e => ({
        id:           e.id,
        name:         e.name,
        icon:         e.icon ?? "icons/svg/aura.svg",
        changesCount: (e.changes ?? []).length,
      })),
      isEditable:  this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      castButton
    };
  }

  _computeCastButtonState() {
    return computeSpellCastButtonState(this.document);
  }

  static async #onCastSpell(_event, _target) {
    const { castSpellFlow } = await import("../../ui/cast-spell-flow.mjs");
    await castSpellFlow(this.document);
  }

  static async #onCreateEffect(_event, _target) {
    await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("EX2E.NewEffect"),
      icon: "icons/svg/aura.svg",
    }]);
  }

  static async #onEditEffect(_event, target) {
    const ae = this.document.effects.get(target.dataset.effectId);
    ae?.sheet?.render(true);
  }

  static async #onDeleteEffect(_event, target) {
    const ae = this.document.effects.get(target.dataset.effectId);
    await ae?.delete();
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.partId = partId;
    if (partId.startsWith("tab")) {
      context.cssClass = this.tabGroups.sheet === partId ? "active" : "";
    }
    return context;
  }

  _circleChoicesFor(tradition) {
    const keys = tradition === "necromancy"
      ? ["CircleShadowlands", "CircleLabyrinth", "CircleVoid"]
      : tradition === "weaving"
        ? ["CircleManMachine", "CircleGodMachine"]
        : ["CircleTerrestrial", "CircleCelestial", "CircleSolar"];
    return keys.map((k, i) => ({
      value: i + 1,
      label: game.i18n.localize(`EX2E.${k}`)
    }));
  }

}
