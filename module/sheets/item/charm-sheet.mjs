import { EX2E } from "../../config.mjs";
import { describeAllPrereqs } from "../../helpers/charm-prereqs.mjs";

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
      addKeyword:       CharmSheet.#onAddKeyword,
      removeKeyword:    CharmSheet.#onRemoveKeyword,
      toggleStep:       CharmSheet.#onToggleStep,
      addAttackTag:     CharmSheet.#onAddAttackTag,
      removeAttackTag:  CharmSheet.#onRemoveAttackTag,
      openFormula:      CharmSheet.#onOpenFormula,
      addPrereqGroup:   CharmSheet.#onAddPrereqGroup,
      removePrereqGroup:CharmSheet.#onRemovePrereqGroup,
      addPrereqAlt:     CharmSheet.#onAddPrereqAlt,
      removePrereqAlt:  CharmSheet.#onRemovePrereqAlt
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
      prereqSummary: describeAllPrereqs(item),
      prereqAltTypes: [
        { value: "charm",         label: game.i18n.localize("EX2E.PrereqTypeCharm") },
        { value: "anyExcellency", label: game.i18n.localize("EX2E.PrereqTypeAnyExcellency") }
      ],
      // Owned-charm list powers the prereq name-input's datalist — picking
      // a suggestion auto-fills the paired charmUid so renames stay safe.
      // Empty in compendium/unowned context; the input degrades to plain
      // name-entry and matching falls back to name.
      ownedCharmOptions: (item.actor?.items ?? [])
        .filter(i => i.type === "charm" && i.id !== item.id)
        .map(i => ({ uid: i.system?.charmUid ?? "", name: i.name }))
        .filter(o => o.uid)
        .sort((a, b) => a.name.localeCompare(b.name)),
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

  // ── Prerequisite editing ────────────────────────────────────────────────
  // Foundry's ArrayField updates don't reliably patch a
  // specific index, so every mutation clones the full list and writes the
  // whole path.

  static async #onAddPrereqGroup(event, target) {
    const groups = foundry.utils.deepClone(this.document.system.prereqGroups ?? []);
    groups.push({ alternatives: [{ type: "charm", charmUid: "", charmName: "" }] });
    await this.document.update({ "system.prereqGroups": groups });
  }

  static async #onRemovePrereqGroup(event, target) {
    const gi = parseInt(target.dataset.groupIndex);
    if (!Number.isFinite(gi)) return;
    const groups = foundry.utils.deepClone(this.document.system.prereqGroups ?? []);
    groups.splice(gi, 1);
    await this.document.update({ "system.prereqGroups": groups });
  }

  static async #onAddPrereqAlt(event, target) {
    const gi = parseInt(target.dataset.groupIndex);
    if (!Number.isFinite(gi)) return;
    const groups = foundry.utils.deepClone(this.document.system.prereqGroups ?? []);
    if (!groups[gi]) return;
    (groups[gi].alternatives ??= []).push({ type: "charm", charmUid: "", charmName: "" });
    await this.document.update({ "system.prereqGroups": groups });
  }

  static async #onRemovePrereqAlt(event, target) {
    const gi = parseInt(target.dataset.groupIndex);
    const ai = parseInt(target.dataset.altIndex);
    if (!Number.isFinite(gi) || !Number.isFinite(ai)) return;
    const groups = foundry.utils.deepClone(this.document.system.prereqGroups ?? []);
    if (!groups[gi]?.alternatives) return;
    groups[gi].alternatives.splice(ai, 1);
    // If the group has no alternatives left, drop the empty group so the UI
    // stays tidy; otherwise a stray "One of:" with nothing inside is ugly.
    if (groups[gi].alternatives.length === 0) groups.splice(gi, 1);
    await this.document.update({ "system.prereqGroups": groups });
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

    // Keep the Attack-Steps <details> open across re-renders.
    const details = this.element.querySelector("details.steps-dropdown");
    if (details) {
      if (this._stepsOpen) details.setAttribute("open", "");
      details.addEventListener("toggle", () => { this._stepsOpen = details.open; });
    }

    // Prereq charm-name inputs are paired with a hidden charmUid input.
    // When the user picks a suggestion from the datalist (or types a name
    // that matches an owned charm exactly), resolve the uid and write it
    // into the hidden input BEFORE the form-wide submit fires. Capture
    // phase puts us ahead of ApplicationV2's form listeners.
    const byName = new Map(
      (context.ownedCharmOptions ?? []).map(o =>
        [String(o.name ?? "").trim().toLowerCase(), o.uid]
      )
    );
    this.element.querySelectorAll(".prereq-charm-name").forEach(input => {
      input.addEventListener("change", (ev) => {
        const uidField = ev.currentTarget.parentElement?.querySelector(".prereq-charm-uid");
        if (!uidField) return;
        const typed = String(ev.currentTarget.value ?? "").trim().toLowerCase();
        uidField.value = byName.get(typed) ?? "";
      }, true); // capture phase — run before the form-submit handler
    });
  }
}
