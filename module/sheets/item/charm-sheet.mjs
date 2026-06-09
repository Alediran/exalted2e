import { EX2E } from "../../config.mjs";
import { describeAllPrereqs } from "../../helpers/charm-prereqs.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { parseCostFormula } from "../../rolls/activation-ledger.mjs";
import { evaluateCharmFormula } from "../../documents/item.mjs";
import { buildCharmCostPreview, buildCharmOptions, buildTraitOptions, buildStatBoostPaths } from "../../helpers/charm-sheet-helpers.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

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
      clearMirrorCharm: CharmSheet.#onClearMirrorCharm,
      removeMergedCharm:CharmSheet.#onRemoveMergedCharm,
      addHealthGrantOption:      CharmSheet.#onAddHealthGrantOption,
      removeHealthGrantOption:   CharmSheet.#onRemoveHealthGrantOption,
      addStatBoostChange:        CharmSheet.#onAddStatBoostChange,
      removeStatBoostChange:     CharmSheet.#onRemoveStatBoostChange,
      addDVIgnorePenaltyType:    CharmSheet.#onAddDVIgnorePenaltyType,
      removeDVIgnorePenaltyType: CharmSheet.#onRemoveDVIgnorePenaltyType,
      addTargetEffectChange:    CharmSheet.#onAddTargetEffectChange,
      removeTargetEffectChange: CharmSheet.#onRemoveTargetEffectChange,
      dispelOther:              CharmSheet.#onDispelOther,
      clearEnhancesCharm:       CharmSheet.#onClearEnhancesCharm,
      incrementPurchaseLevel:   CharmSheet.#onIncrementPurchaseLevel,
      addUpgradeTier:      CharmSheet.#onAddUpgradeTier,
      removeUpgradeTier:   CharmSheet.#onRemoveUpgradeTier,
      moveUpgradeTierUp:   CharmSheet.#onMoveUpgradeTierUp,
      moveUpgradeTierDown: CharmSheet.#onMoveUpgradeTierDown,
      addTierStatBoostChange:        CharmSheet.#onAddTierStatBoostChange,
      removeTierStatBoostChange:     CharmSheet.#onRemoveTierStatBoostChange,
      addTierHealthGrantOption:      CharmSheet.#onAddTierHealthGrantOption,
      removeTierHealthGrantOption:   CharmSheet.#onRemoveTierHealthGrantOption,
      addTierDVIgnorePenaltyType:    CharmSheet.#onAddTierDVIgnorePenaltyType,
      removeTierDVIgnorePenaltyType: CharmSheet.#onRemoveTierDVIgnorePenaltyType,
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
    const { attributeOptions, abilityOptions } = buildTraitOptions(EX2E, k => game.i18n.localize(k));

    // Deduplicated charm list spanning actor items, world items, and all
    // compendium pack indices — so datalist autocomplete and display names
    // work even when the charm is opened directly from a compendium.
    const packEntries = [];
    for (const pack of (game.packs ?? [])) {
      if (pack.documentName !== "Item") continue;
      for (const entry of pack.index) packEntries.push(entry);
    }
    const allCharmOptions = buildCharmOptions(item.actor?.items, game.items, packEntries, item.id);
    const charmByUid = new Map(allCharmOptions.map(o => [o.uid, o.name]));

    // Formula parse preview for the charm sheet cost field
    const _formulaParsed = parseCostFormula(sys.cost?.formula ?? "");
    let costFormulaPreview = "", costFormulaError = "";
    if (sys.cost?.formula) {
      if (_formulaParsed === null) costFormulaError = game.i18n.localize("EX2E.CostFormulaError");
      else costFormulaPreview = buildCharmCostPreview(_formulaParsed);
    }

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
      hgHasChoice: (sys.healthGrant?.options?.length ?? 0) > 1,
      // `abilities` is the charm-key dropdown — its contents swap between
      // ability and attribute lists based on `usesAttribute`.
      abilities:    usesAttribute ? attributeOptions : abilityOptions,
      abilityFieldLabel:    game.i18n.localize(usesAttribute ? "EX2E.Attribute"    : "EX2E.Ability"),
      minAbilityFieldLabel: game.i18n.localize(usesAttribute ? "EX2E.MinAttribute" : "EX2E.MinAbility"),
      excellencies: [
        { value: "",                label: game.i18n.localize("EX2E.ExcellencyNone") },
        { value: "first",           label: game.i18n.localize("EX2E.FirstExcellency") },
        { value: "second",          label: game.i18n.localize("EX2E.SecondExcellency") },
        { value: "third",           label: game.i18n.localize("EX2E.ThirdExcellency") },
        { value: "infiniteMastery", label: game.i18n.localize("EX2E.InfiniteMastery") },
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
      mirrorCharmDisplayName: charmByUid.get(sys.mirrorId ?? "") ?? "",
      enhancesCharmDisplayName: charmByUid.get(sys.enhancesCharmUid ?? "") ?? "",
      mergedCharms: (sys.mergedIds ?? []).map((uid, index) => ({
        uid, index, name: charmByUid.get(uid) ?? "",
      })),
      isEditable:   this.isEditable,
      costFormulaPreview,
      costFormulaError,
      yoziPatronOptions: Object.entries(EX2E.yoziPatrons).map(([k, v]) => ({
        key: k, label: game.i18n.localize(v)
      })),
      maidenAffiliationOptions: [
        { value: "", label: "—" },
        ...Object.entries(EX2E.siderealMaidens).map(([k, v]) => ({
          value: k, label: game.i18n.localize(v)
        }))
      ],
      martialArtsElementOptions: [
        { value: "", label: "—" },
        ...Object.entries(EX2E.castes.terrestrial ?? {}).map(([k, v]) => ({
          value: k, label: game.i18n.localize(v)
        }))
      ],
      virtueKeyOptions: Object.entries(EX2E.virtues).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      resolvedMaxPurchases: Math.max(1, evaluateCharmFormula(sys.maxPurchases ?? "1", item.actor?.getRollData?.() ?? {}, 1)),
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(this.document), {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      perfectDefenseOptions: [
        { value: "",      label: game.i18n.localize("EX2E.PerfectDefenseNone")  },
        { value: "parry", label: game.i18n.localize("EX2E.PerfectDefenseParry") },
        { value: "dodge", label: game.i18n.localize("EX2E.PerfectDefenseDodge") },
        { value: "soak",  label: game.i18n.localize("EX2E.PerfectDefenseSoak")  }
      ],
      moteRecoveryEvents: [
        { value: "onDamageReceived", label: game.i18n.localize("EX2E.MREventOnDamage")       },
        { value: "onAttackSuccess",  label: game.i18n.localize("EX2E.MREventOnHit")           },
        { value: "onAllyAttacked",   label: game.i18n.localize("EX2E.MREventOnAllyHit")       },
        { value: "onDamageDealt",    label: game.i18n.localize("EX2E.MREventOnDamageDealt")   },
      ],
      moteRecoverySources: [
        { value: "self",       label: game.i18n.localize("EX2E.MRSourceSelf")       },
        { value: "fromTarget", label: game.i18n.localize("EX2E.MRSourceFromTarget") }
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
        { value: "all",      label: game.i18n.localize("EX2E.TPScopeAll")    },
        { value: "physical", label: game.i18n.localize("EX2E.TPScopeCombat") },
        { value: "social",   label: game.i18n.localize("EX2E.TPScopeSocial") }
      ],
      motePoolChoices: [
        { value: "personal",   label: game.i18n.localize("EX2E.MPBPersonal")   },
        { value: "peripheral", label: game.i18n.localize("EX2E.MPBPeripheral") }
      ],
      initiationTraditionChoices: [
        { value: "sorcery",    label: game.i18n.localize("EX2E.GITraditionSorcery")    },
        { value: "necromancy", label: game.i18n.localize("EX2E.GITraditionNecromancy") },
        { value: "weaving",    label: game.i18n.localize("EX2E.GITraditionWeaving")    }
      ],
      initiationLevelChoices: [
        { value: 1, label: game.i18n.localize("EX2E.GILevel1") },
        { value: 2, label: game.i18n.localize("EX2E.GILevel2") },
        { value: 3, label: game.i18n.localize("EX2E.GILevel3") }
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
      willpowerRecoveryEventChoices: [
        { value: "onDamageReceived", label: game.i18n.localize("EX2E.WillpowerEventOnDamage") },
        { value: "onAttackSuccess",  label: game.i18n.localize("EX2E.WillpowerEventOnHit")    },
        { value: "onKill",           label: game.i18n.localize("EX2E.WillpowerEventOnKill")   }
      ],
      statBoostPaths: buildStatBoostPaths(EX2E, k => game.i18n.localize(k))
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

  static async #onClearMirrorCharm() {
    await this.document.update({ "system.mirrorId": "" });
  }

  static async #onClearEnhancesCharm() {
    await this.document.update({ "system.enhancesCharmUid": "" });
  }

  static async #onRemoveMergedCharm(_event, target) {
    const idx = parseInt(target.dataset.index);
    const ids = foundry.utils.deepClone(this.document.system.mergedIds ?? []);
    ids.splice(idx, 1);
    await this.document.update({ "system.mergedIds": ids });
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

  static async #onAddTargetEffectChange(event, target) {
    const changes = foundry.utils.deepClone(
      this.document.system.targetEffect?.changes ?? []
    );
    changes.push({ key: "", type: "add", value: "0" });
    await this.document.update({ "system.targetEffect.changes": changes });
  }

  static async #onRemoveTargetEffectChange(event, target) {
    const idx     = parseInt(target.dataset.index);
    const changes = foundry.utils.deepClone(
      this.document.system.targetEffect?.changes ?? []
    );
    changes.splice(idx, 1);
    await this.document.update({ "system.targetEffect.changes": changes });
  }

  static async #onDispelOther(_event, _target) {
    const item  = this.item;
    const actor = item.actor;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoActor"));
      return;
    }
    const { pickTargetActor } = await import("../../helpers/targeting.mjs");
    const targetActor = await pickTargetActor();
    if (!targetActor) return;

    const spellEffectAes = (targetActor.effects?.contents ?? []).filter(
      ae => ae.flags?.exalted2e?.spellEffect
    );
    if (!spellEffectAes.length) {
      ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoSpellEffects"));
      return;
    }

    const ae = spellEffectAes[0];
    const { CountermagicDialog } = await import("../../dialogs/countermagic-dialog.mjs");
    await CountermagicDialog.open({ type: "effect-other", targetActor, ae }, actor);
  }

  static async #onAddUpgradeTier(event, target) {
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    tiers.push({
      label: "", autoApply: false, passive: true, gateRequiresAll: true,
      essenceRequired: 0, purchaseLevelRequired: 2,
      abilityGate: { min: 0 }, attributeGate: { min: 0 },
      cost: { formula: "" }
    });
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onRemoveUpgradeTier(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(idx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    tiers.splice(idx, 1);
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onMoveUpgradeTierUp(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(idx) || idx <= 0) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    [tiers[idx - 1], tiers[idx]] = [tiers[idx], tiers[idx - 1]];
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onMoveUpgradeTierDown(event, target) {
    const idx = parseInt(target.dataset.index);
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    if (!Number.isFinite(idx) || idx >= tiers.length - 1) return;
    [tiers[idx], tiers[idx + 1]] = [tiers[idx + 1], tiers[idx]];
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onAddTierStatBoostChange(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    if (!Number.isFinite(tierIdx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.statBoost ??= {};
    tier.statBoost.changes = [...(tier.statBoost.changes ?? []), { path: "", value: "1" }];
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onRemoveTierStatBoostChange(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(tierIdx) || !Number.isFinite(idx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.statBoost.changes.splice(idx, 1);
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onAddTierHealthGrantOption(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    if (!Number.isFinite(tierIdx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.healthGrant ??= {};
    tier.healthGrant.options = [...(tier.healthGrant.options ?? []), { label: "", zero: 0, one: 0, two: 0, dying: 0 }];
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onRemoveTierHealthGrantOption(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(tierIdx) || !Number.isFinite(idx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.healthGrant.options.splice(idx, 1);
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onAddTierDVIgnorePenaltyType(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    if (!Number.isFinite(tierIdx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.dvBonus ??= {};
    tier.dvBonus.ignorePenaltyTypes = [...(tier.dvBonus.ignorePenaltyTypes ?? []), "onslaught"];
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onRemoveTierDVIgnorePenaltyType(event, target) {
    const tierIdx = parseInt(target.dataset.tierIndex);
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(tierIdx) || !Number.isFinite(idx)) return;
    const tiers = foundry.utils.deepClone(this.document.system.upgradeTiers ?? []);
    const tier = tiers[tierIdx];
    if (!tier) return;
    tier.dvBonus.ignorePenaltyTypes.splice(idx, 1);
    await this.document.update({ "system.upgradeTiers": tiers });
  }

  static async #onIncrementPurchaseLevel(event, _target) {
    const charm      = this.document;
    const sys        = charm.system;
    const rollData   = charm.parent?.getRollData?.() ?? {};
    const resolvedMax = Math.max(1, evaluateCharmFormula(sys.maxPurchases ?? "1", rollData, 1));
    if (sys.purchaseLevel >= resolvedMax) {
      ui.notifications.warn(game.i18n.localize("EX2E.PurchaseMaxReached"));
      return;
    }
    const gateEss = sys.essenceGates?.[sys.purchaseLevel - 1];
    if (gateEss !== undefined) {
      const actorEss = charm.parent?.system?.essence?.value ?? 0;
      if (actorEss < gateEss) {
        ui.notifications.warn(game.i18n.format("EX2E.PurchaseEssenceGate", { required: gateEss }));
        return;
      }
    }
    await charm.update({ "system.purchaseLevel": sys.purchaseLevel + 1 });
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

    if (this.isEditable) {
      this.element.querySelectorAll(".charm-drop-zone").forEach(zone => {
        zone.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          zone.classList.add("drag-over");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", async (ev) => {
          ev.preventDefault();
          zone.classList.remove("drag-over");
          let data;
          try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); }
          catch { return; }
          if (data.type !== "Item") return;
          const dropped = await fromUuid(data.uuid);
          if (dropped?.type !== "charm") return;
          const uid = dropped.system?.charmUid ?? dropped.id;
          if (!uid) return;
          if (zone.dataset.dropType === "enhancesCharm") {
            await this.document.update({ "system.enhancesCharmUid": uid });
          } else if (zone.dataset.dropType === "mirror") {
            await this.document.update({ "system.mirrorId": uid });
          } else if (zone.dataset.dropType === "merged") {
            const ids = foundry.utils.deepClone(this.document.system.mergedIds ?? []);
            if (!ids.includes(uid)) {
              ids.push(uid);
              await this.document.update({ "system.mergedIds": ids });
            }
          } else if (zone.dataset.dropType === "prereq") {
            const gi = parseInt(zone.dataset.groupIndex);
            const ai = parseInt(zone.dataset.altIndex);
            if (!Number.isFinite(gi) || !Number.isFinite(ai)) return;
            const groups = foundry.utils.deepClone(this.document.system.prereqGroups ?? []);
            if (!groups[gi]?.alternatives?.[ai]) return;
            groups[gi].alternatives[ai].charmUid  = uid;
            groups[gi].alternatives[ai].charmName = dropped.name;
            await this.document.update({ "system.prereqGroups": groups });
          }
        });
      });
    }
  }

}
