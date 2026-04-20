import { EX2E } from "../../config.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class CharmSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  // Persists the Attack-Steps dropdown's open state across re-renders
  // (each step toggle triggers a document update and re-render).
  _stepsOpen = false;

  /** Current tab group state. Defaults to the General tab. */
  tabGroups = { sheet: "tabGeneral" };

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "charm"],
    position: { width: 540, height: 600 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addKeyword:      CharmSheet.#onAddKeyword,
      removeKeyword:   CharmSheet.#onRemoveKeyword,
      toggleStep:      CharmSheet.#onToggleStep,
      addAttackTag:    CharmSheet.#onAddAttackTag,
      removeAttackTag: CharmSheet.#onRemoveAttackTag,
      openFormula:     CharmSheet.#onOpenFormula
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header:     { template: "systems/exalted2e/templates/item/charm/header.hbs" },
    tabs: {
      classes: ["tabs-right"],
      template: "systems/exalted2e/templates/item/charm/tabs.hbs"
    },
    tabGeneral: { template: "systems/exalted2e/templates/item/charm/tab-general.hbs", scrollable: [""] },
    tabAttack:  { template: "systems/exalted2e/templates/item/charm/tab-attack.hbs",  scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    const tabs = {
      tabGeneral: { id: "tabGeneral", group: "sheet", icon: "fa-solid fa-scroll",      label: game.i18n.localize("EX2E.TabGeneral"), cssClass: this.tabGroups.sheet === "tabGeneral" ? "active" : "" },
      tabAttack:  { id: "tabAttack",  group: "sheet", icon: "fa-solid fa-crosshairs",  label: game.i18n.localize("EX2E.TabAttack"),  cssClass: this.tabGroups.sheet === "tabAttack"  ? "active" : "" }
    };

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      tabs,
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
      damageTypes: [
        { value: "bashing",    label: game.i18n.localize("EX2E.DamageBashing") },
        { value: "lethal",     label: game.i18n.localize("EX2E.DamageLethal") },
        { value: "aggravated", label: game.i18n.localize("EX2E.DamageAggravated") }
      ],
      weaponTags:   EX2E.weaponTags,
      allKeywords:  EX2E.charmKeywords,
      isEditable:   this.isEditable,
      enrichedDescription: await TextEditor.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.partId = partId;
    if (partId.startsWith("tab")) {
      context.cssClass = this.tabGroups.sheet === partId ? "active" : "";
    }
    return context;
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

  static async #onToggleStep(event, target) {
    const step  = parseInt(target.dataset.step);
    const steps = foundry.utils.deepClone(this.document.system.steps ?? []);
    const idx   = steps.indexOf(step);
    if (idx >= 0) steps.splice(idx, 1);
    else {
      steps.push(step);
      steps.sort((a, b) => a - b);
    }
    await this.document.update({ "system.steps": steps });
  }

  static async #onAddAttackTag(event, target) {
    const tags = foundry.utils.deepClone(this.document.system.attack?.tags ?? []);
    tags.push(EX2E.weaponTags[0] ?? "");
    await this.document.update({ "system.attack.tags": tags });
  }

  static async #onRemoveAttackTag(event, target) {
    const idx  = parseInt(target.dataset.index);
    const tags = foundry.utils.deepClone(this.document.system.attack?.tags ?? []);
    tags.splice(idx, 1);
    await this.document.update({ "system.attack.tags": tags });
  }

  /**
   * Open the Formula Builder dialog for a specific attack-stat input.
   * `data-path` on the button tells us which field to target; the
   * dialog resolves with the edited formula (or null on cancel), which
   * we persist via the normal document update path.
   */
  static async #onOpenFormula(event, target) {
    const path  = target.dataset.path;
    const label = target.dataset.label ?? "";
    if (!path) return;
    const current = foundry.utils.getProperty(this.document, path) ?? "";
    const { FormulaBuilderDialog } = await import("../../dialogs/formula-builder-dialog.mjs");
    const result = await FormulaBuilderDialog.prompt({
      formula:   String(current),
      fieldName: label,
      actor:     this.document.actor ?? null
    });
    if (result === null) return;
    await this.document.update({ [path]: result });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const details = this.element.querySelector("details.steps-dropdown");
    if (!details) return;
    if (this._stepsOpen) details.setAttribute("open", "");
    details.addEventListener("toggle", () => { this._stepsOpen = details.open; });
  }
}
