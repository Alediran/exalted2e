import { EX2E } from "../../config.mjs";
import { describeAllPrereqs } from "../../helpers/charm-prereqs.mjs";
import { editImageAction } from "../_edit-image.mjs";

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
      editImage:        editImageAction,
      addKeyword:       CharmSheet.#onAddKeyword,
      removeKeyword:    CharmSheet.#onRemoveKeyword,
      toggleStep:       CharmSheet.#onToggleStep,
      addAttackTag:     CharmSheet.#onAddAttackTag,
      removeAttackTag:  CharmSheet.#onRemoveAttackTag,
      openFormula:      CharmSheet.#onOpenFormula,
      addPrereqGroup:   CharmSheet.#onAddPrereqGroup,
      removePrereqGroup:CharmSheet.#onRemovePrereqGroup,
      addPrereqAlt:     CharmSheet.#onAddPrereqAlt,
      removePrereqAlt:  CharmSheet.#onRemovePrereqAlt,
      addHealthGrantOption:      CharmSheet.#onAddHealthGrantOption,
      removeHealthGrantOption:   CharmSheet.#onRemoveHealthGrantOption,
      addStatBoostChange:        CharmSheet.#onAddStatBoostChange,
      removeStatBoostChange:     CharmSheet.#onRemoveStatBoostChange,
      addDVIgnorePenaltyType:    CharmSheet.#onAddDVIgnorePenaltyType,
      removeDVIgnorePenaltyType: CharmSheet.#onRemoveDVIgnorePenaltyType
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
    tabEffects: { template: "systems/exalted2e/templates/item/charm/tab-effects.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    const tabs = {
      tabGeneral: { id: "tabGeneral", group: "sheet", icon: "fa-solid fa-scroll",      label: game.i18n.localize("EX2E.TabGeneral"), cssClass: this.tabGroups.sheet === "tabGeneral" ? "active" : "" },
      tabEffects: { id: "tabEffects", group: "sheet", icon: "fa-solid fa-sparkles",    label: game.i18n.localize("EX2E.TabEffects"), cssClass: this.tabGroups.sheet === "tabEffects" ? "active" : "" }
    };

    // Lunars and Alchemicals key their charms to Attributes; every other
    // exalt type keys to Abilities. Both use the same `system.ability`
    // field — only the dropdown contents and the field label change.
    const usesAttribute = ["lunar", "alchemical"].includes(sys.exaltType);
    const attributeOptions = [];
    for (const group of Object.values(EX2E.attributes)) {
      for (const [key, labelKey] of Object.entries(group)) {
        attributeOptions.push({ value: key, label: game.i18n.localize(labelKey) });
      }
    }
    const abilityOptions = EX2E.abilities.map(k => ({
      value: k, label: game.i18n.localize(EX2E.abilityLabels[k] ?? k)
    }));

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      tabs,
      charmTypes:   Object.entries(EX2E.charmTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      durations:    Object.entries(EX2E.durations).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      splatTypes:   Object.entries(EX2E.splatTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      usesAttribute,
      // `abilities` is the charm-key dropdown — its contents swap between
      // ability and attribute lists based on `usesAttribute`.
      abilities:    usesAttribute ? attributeOptions : abilityOptions,
      abilityFieldLabel:    game.i18n.localize(usesAttribute ? "EX2E.Attribute"    : "EX2E.Ability"),
      minAbilityFieldLabel: game.i18n.localize(usesAttribute ? "EX2E.MinAttribute" : "EX2E.MinAbility"),
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
        { value: "anyExcellency", label: game.i18n.localize("EX2E.PrereqTypeAnyExcellency") },
        { value: "virtue",        label: game.i18n.localize("EX2E.PrereqTypeVirtue") }
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
      yoziPatronOptions: Object.entries(EX2E.yoziPatrons).map(([k, v]) => ({
        key: k, label: game.i18n.localize(v)
      })),
      maidenAffiliationOptions: [
        { value: "", label: "—" },
        ...Object.entries(EX2E.siderealMaidens).map(([k, v]) => ({
          value: k, label: game.i18n.localize(v)
        }))
      ],
      virtueKeyOptions: Object.entries(EX2E.virtues).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      perfectDefenseOptions: [
        { value: "",      label: game.i18n.localize("EX2E.PerfectDefenseNone")  },
        { value: "parry", label: game.i18n.localize("EX2E.PerfectDefenseParry") },
        { value: "dodge", label: game.i18n.localize("EX2E.PerfectDefenseDodge") },
        { value: "soak",  label: game.i18n.localize("EX2E.PerfectDefenseSoak")  }
      ],
      moteRecoveryEvents: [
        { value: "onDamageReceived", label: game.i18n.localize("EX2E.MREventOnDamage")  },
        { value: "onAttackHit",      label: game.i18n.localize("EX2E.MREventOnHit")     },
        { value: "onAllyAttacked",   label: game.i18n.localize("EX2E.MREventOnAllyHit") }
      ],
      moteRecoveryActions: [
        { value: "recoverPeripheral", label: game.i18n.localize("EX2E.MRActionRecoverPeripheral") },
        { value: "recoverPersonal",   label: game.i18n.localize("EX2E.MRActionRecoverPersonal")   },
        { value: "gainOverdrive",     label: game.i18n.localize("EX2E.MRActionGainOverdrive")     }
      ],
      healingTargets: [
        { value: "self",    label: game.i18n.localize("EX2E.HRTargetSelf")    },
        { value: "touched", label: game.i18n.localize("EX2E.HRTargetTouched") },
        { value: "actor",   label: game.i18n.localize("EX2E.HRTargetActor")   }
      ],
      healingDamageTypes: [
        { value: "bashing",          label: game.i18n.localize("EX2E.DamageBashing")      },
        { value: "lethal",           label: game.i18n.localize("EX2E.DamageLethal")       },
        { value: "bashingAndLethal", label: game.i18n.localize("EX2E.HRBashingAndLethal") },
        { value: "any",              label: game.i18n.localize("EX2E.HRDamageTypeAny")    }
      ],
      targetPenaltyScopes: [
        { value: "all",         label: game.i18n.localize("EX2E.TPScopeAll")         },
        { value: "dvOnly",      label: game.i18n.localize("EX2E.TPScopeDVOnly")      },
        { value: "attacksOnly", label: game.i18n.localize("EX2E.TPScopeAttacksOnly") }
      ],
      motePoolChoices: [
        { value: "personal",   label: game.i18n.localize("EX2E.MPBPersonal")   },
        { value: "peripheral", label: game.i18n.localize("EX2E.MPBPeripheral") }
      ],
      dvPenaltyTypeChoices: [
        { value: "onslaught", label: game.i18n.localize("EX2E.DVBTypeOnslaught") },
        { value: "action",    label: game.i18n.localize("EX2E.DVBTypeAction")    },
        { value: "wound",     label: game.i18n.localize("EX2E.DVBTypeWound")     }
      ],
      statusOnFailChoices: [
        { value: "applyCrippling", label: game.i18n.localize("EX2E.SAOnFailCrippling") },
        { value: "applyKnockback", label: game.i18n.localize("EX2E.SAOnFailKnockback") },
        { value: "applySickness",  label: game.i18n.localize("EX2E.SAOnFailSickness")  },
        { value: "applyPoison",    label: game.i18n.localize("EX2E.SAOnFailPoison")    }
      ],
      statBoostPaths: (() => {
        const paths = [];
        for (const group of Object.values(EX2E.attributes)) {
          for (const [k, labelKey] of Object.entries(group)) {
            paths.push({ value: `system.attributes.${k}.value`, label: game.i18n.localize(labelKey) });
          }
        }
        for (const k of EX2E.abilities) {
          paths.push({ value: `system.abilities.${k}.value`, label: game.i18n.localize(EX2E.abilityLabels[k] ?? k) });
        }
        return paths;
      })()
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

  static async #onAddHealthGrantOption(event, target) {
    const opts = foundry.utils.deepClone(this.document.system.healthGrant?.options ?? []);
    opts.push({ label: "", zero: 0, one: 0, two: 0, dying: 0 });
    await this.document.update({ "system.healthGrant.options": opts });
  }

  static async #onRemoveHealthGrantOption(event, target) {
    const idx  = parseInt(target.dataset.index);
    const opts = foundry.utils.deepClone(this.document.system.healthGrant?.options ?? []);
    opts.splice(idx, 1);
    await this.document.update({ "system.healthGrant.options": opts });
  }

  static async #onAddStatBoostChange(event, target) {
    const changes = foundry.utils.deepClone(this.document.system.statBoost?.changes ?? []);
    changes.push({ path: "", value: "1" });
    await this.document.update({ "system.statBoost.changes": changes });
  }

  static async #onRemoveStatBoostChange(event, target) {
    const idx     = parseInt(target.dataset.index);
    const changes = foundry.utils.deepClone(this.document.system.statBoost?.changes ?? []);
    changes.splice(idx, 1);
    await this.document.update({ "system.statBoost.changes": changes });
  }

  static async #onAddDVIgnorePenaltyType(event, target) {
    const types = foundry.utils.deepClone(this.document.system.dvBonus?.ignorePenaltyTypes ?? []);
    types.push("onslaught");
    await this.document.update({ "system.dvBonus.ignorePenaltyTypes": types });
  }

  static async #onRemoveDVIgnorePenaltyType(event, target) {
    const idx   = parseInt(target.dataset.index);
    const types = foundry.utils.deepClone(this.document.system.dvBonus?.ignorePenaltyTypes ?? []);
    types.splice(idx, 1);
    await this.document.update({ "system.dvBonus.ignorePenaltyTypes": types });
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

    // Stamp exalt-type as data attribute for CSS palette theming.
    this.element.dataset.exaltType = this.document.system.exaltType ?? "solar";

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
