import { EX2E }          from "../../config.mjs";
import { ExaltedRoll }   from "../../rolls/exalted-roll.mjs";
import { evaluateCharmPrereqs } from "../../helpers/charm-prereqs.mjs";
import { evaluateCharmFormula } from "../../documents/item.mjs";
import { ex2eCan }       from "../../helpers/permissions.mjs";
import { canEquipToSlot } from "../../helpers/equip-slots.mjs";
import { buildXpCostRows } from "../../helpers/xp-cost-table.mjs";
import { computeSpellCastButtonState } from "../../ui/spell-cast-button.mjs";
import { resolveXpCosts }  from "../../helpers/xp-cost-defaults.mjs";
import { priceAlchemicalCharmSlot } from "../../helpers/xp-costs.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { sceneChangeFade } from "../../combat/anima-fade.mjs";
import { AnimaColorDialog } from "../../dialogs/anima-color-dialog.mjs";
import { sanctifyOathBinding } from "../../helpers/oath.mjs";
import { CraftingRollDialog }     from "../../dialogs/crafting-roll-dialog.mjs";
import { ArtifactCraftingDialog } from "../../dialogs/artifact-crafting-dialog.mjs";
import { exceedsCraftCap, artifactSuccessTarget, effectiveArtifactAbilityReqs, meetsArtifactAbilityReqs } from "../../helpers/crafting-helpers.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const _ANIMA_ORDER_SHEET = { none: 0, glowing: 1, burning: 2, bonfire: 3, totemic: 4 };
function _animaLevelSheet(key) { return _ANIMA_ORDER_SHEET[key] ?? 0; }

const _GREATER_SIGN_ICONS = {
  journeys: "fa-route",
  serenity: "fa-venus",
  battles:  "fa-mars",
  secrets:  "fa-eye",
  endings:  "fa-hourglass-end",
};

export function _greaterSignPrereqMet(actor, caste) {
  if ((actor.system.essence?.value ?? 0) < 4) return false;
  const colleges = actor.system.splat?.sidereal?.colleges?.[caste] ?? {};
  return Object.values(colleges).reduce((s, v) => s + (v ?? 0), 0) >= 15;
}

export async function _activateGreaterSign(actor, item) {
  const conflict = actor.items.some(i =>
    i.type === "animapower" &&
    !i.system.isGreaterSign &&
    i.system.caste === item.system.caste &&
    i.system.active
  );
  if (conflict) {
    ui.notifications.warn(game.i18n.localize("EX2E.GreaterSignLesserSignConflict"));
    return false;
  }
  if ((actor.system.motes?.peripheral?.value ?? 0) < 10) {
    ui.notifications.warn(game.i18n.localize("EX2E.GreaterSignInsufficientMotes"));
    return false;
  }
  const result = await actor.spendMotes(10, "peripheral");
  if (!result) return false;

  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: item.name,
    img:  item.img,
    flags: {
      exalted2e: {
        permanentCost: { essence: 1, willpower: 1 },
        sourceItem:    item.id,
        gmOnlyRemoval: true,
      }
    }
  }]);
  await item.update({ "system.active": true });

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/greater-sign-activation-card.hbs",
    { name: item.name, icon: _GREATER_SIGN_ICONS[item.system.caste] ?? "fa-star", reversed: false }
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { exalted2e: { signActivation: { actorId: actor.id, itemId: item.id, reversed: false } } },
  });
  return true;
}

export async function _deactivateGreaterSign(actor, item) {
  const ae = actor.effects.find(e =>
    e.flags?.exalted2e?.permanentCost && e.flags?.exalted2e?.sourceItem === item.id
  );
  if (ae) {
    await ae.delete(); // deleteActiveEffect hook applies cost + sets item.active = false
  } else {
    console.warn(`exalted2e | _deactivateGreaterSign: no pending cost AE found for ${item.name} — deactivating without permanent cost.`);
    await item.update({ "system.active": false });
  }
}

export async function _reverseGreaterSignActivation(actor, item) {
  const ae = actor.effects.find(e =>
    e.flags?.exalted2e?.permanentCost && e.flags?.exalted2e?.sourceItem === item.id
  );
  if (ae) {
    await ae.update({ "flags.exalted2e.reversed": true });
    await ae.delete(); // hook sees reversed: true, skips permanent cost
  }
  await actor.recoverMotes(10, "peripheral");
  if (actor.items.get(item.id)?.system.active) {
    await item.update({ "system.active": false });
  }
}

/**
 * True when the current user meets the configured `purchaseMode`
 * permission. Used to gate the Purchase Mode toggle, the Current / Total
 * XP inputs on the Experience tab, and the purchase-log edit / delete
 * controls. Default threshold is Assistant GM; tune via the Permissions
 * settings menu.
 */
function _canTogglePurchaseMode() {
  return ex2eCan("purchaseMode");
}

/**
 * CharacterSheet – full multi-tab sheet for Exalted PC characters.
 */
export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  // Persists which charm-group / spell-circle sub-sections the user has
  // collapsed on the Charms tab across re-renders. Default is "all open"
  // — entries are added when the user clicks a summary to collapse it.
  _collapsedGroups = new Set();

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "actor", "character"],
    position: { width: 860, height: 720 },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit:  false
    },
    actions: {
      rollAttribute:       CharacterSheet.#onRollAttribute,
      rollAbility:         CharacterSheet.#onRollAbility,
      addSpecialty:        CharacterSheet.#onAddSpecialty,
      removeSpecialty:     CharacterSheet.#onRemoveSpecialty,
      applyDamage:         CharacterSheet.#onApplyDamage,
      healDamage:          CharacterSheet.#onHealDamage,
      spendMotes:          CharacterSheet.#onSpendMotes,
      recoverMotes:        CharacterSheet.#onRecoverMotes,
      createItem:          CharacterSheet.#onCreateItem,
      editItem:            CharacterSheet.#onEditItem,
      deleteItem:          CharacterSheet.#onDeleteItem,
      activateCharm:       CharacterSheet.#onActivateCharm,
      activateCombo:       CharacterSheet.#onActivateCombo,
      togglePurchaseMode:  CharacterSheet.#onTogglePurchaseMode,
      editPurchaseEntry:    CharacterSheet.#onEditPurchaseEntry,
      deletePurchaseEntry:  CharacterSheet.#onDeletePurchaseEntry,
      toggleEquip:         CharacterSheet.#onToggleEquip,
      sendItemToChat:      CharacterSheet.#onSendItemToChat,
      rollPool:            CharacterSheet.#onRollPool,
      cycleAbilityFlag:    CharacterSheet.#onCycleAbilityFlag,
      rollAttack:          CharacterSheet.#onRollAttack,
      rollSocialAttack:    CharacterSheet.#onRollSocialAttack,
      pickVirtueFlaw:      CharacterSheet.#onPickVirtueFlaw,
      clearVirtueFlaw:     CharacterSheet.#onClearVirtueFlaw,
      editEffect:          CharacterSheet.#onEditEffect,
      deleteEffect:        CharacterSheet.#onDeleteEffect,
      toggleEffect:        CharacterSheet.#onToggleEffect,
      createEffect:        CharacterSheet.#onCreateEffect,
      dispelSpellEffect:   CharacterSheet.#onDispelSpellEffect,
      abandonMotivationCampaign: CharacterSheet.#onAbandonMotivationCampaign,
      cycleAttributeFlag:  CharacterSheet.#onCycleAttributeFlag,
      createForm:          CharacterSheet.#onCreateForm,
      setActiveForm:       CharacterSheet.#onSetActiveForm,
      editForm:            CharacterSheet.#onEditForm,
      deleteForm:          CharacterSheet.#onDeleteForm,
      endDBT:              CharacterSheet.#onEndDBT,
      nudgeScenePeripheral: CharacterSheet.#onNudgeScenePeripheral,
      endScene:             CharacterSheet.#onEndScene,
      morningRest:          CharacterSheet.#onMorningRest,
      rollVirtue:           CharacterSheet.#onRollVirtue,
      installCharm:        CharacterSheet.#onInstallCharm,
      uninstallCharm:      CharacterSheet.#onUninstallCharm,
      addDedicatedSlot:    CharacterSheet.#onAddDedicatedSlot,
      addGeneralSlot:      CharacterSheet.#onAddGeneralSlot,
      upgradeSlot:         CharacterSheet.#onUpgradeSlot,
      createSubmodule:     CharacterSheet.#onCreateSubmodule,
      onEditImage:         editImageAction,
      configureAnimaColors: CharacterSheet.#onConfigureAnimaColors,
      activateAnimaPower:  CharacterSheet.#onActivateAnimaPower,
      viewAnimaPower:      CharacterSheet.#onViewAnimaPower,
      rollActOfVillainy:   CharacterSheet.#onRollActOfVillainy,
      toggleTellHidden:    CharacterSheet.#onToggleTellHidden,
      sanctifyOath:        CharacterSheet.#onSanctifyOath,
      createDestiny:       CharacterSheet.#onCreateDestiny,
      ventResonance:       CharacterSheet.#onVentResonance,
      activateGreaterSign: CharacterSheet.#onActivateAnimaPower,
      rollHealingCharm:    CharacterSheet.#onRollHealingCharm,
      socketHearthstone:   CharacterSheet.#onSocketHearthstone,
      unsocketHearthstone: CharacterSheet.#onUnsocketHearthstone,
      toggleAblationDot:   CharacterSheet.#onToggleAblationDot,
      addCraftingProject:    CharacterSheet.#onAddCraftingProject,
      rollCraftingProject:   CharacterSheet.#onRollCraftingProject,
      deleteCraftingProject: CharacterSheet.#onDeleteCraftingProject,
      addArtifactProject:        CharacterSheet.#onAddArtifactProject,
      rollArtifactProject:       CharacterSheet.#onRollArtifactProject,
      deleteArtifactProject:     CharacterSheet.#onDeleteArtifactProject,
      toggleArtifactIngredients: CharacterSheet.#onToggleArtifactIngredients,
      openFamiliarActor:     CharacterSheet.#onOpenFamiliarActor,
      openCharmTree:            CharacterSheet.#onOpenCharmTree,
      coverArtifactAttunement:  CharacterSheet.#onCoverArtifactAttunement,
      addCripplingInjury:       CharacterSheet.#onAddCripplingInjury,
      deleteCripplingInjury:    CharacterSheet.#onDeleteCripplingInjury,
      applyActivityFatigue:     CharacterSheet.#onApplyActivityFatigue,
      rollArmorFatigue:         CharacterSheet.#onRollArmorFatigue,
      clinchHold:         CharacterSheet.#onClinchHold,
      clinchCrush:        CharacterSheet.#onClinchCrush,
      clinchThrow:        CharacterSheet.#onClinchThrow,
      clinchRelease:      CharacterSheet.#onClinchRelease,
      performProcedure:   CharacterSheet.#onPerformProcedure,
    }
  };

  get title() {
    return `${game.i18n.localize(this.actor.name)}`;
  }

  static PARTS = {
    header: {
      template: "systems/exalted2e/templates/actor/character/header.hbs"
    },
    tabs: {
      classes: ["tabs-right"],
      template: "systems/exalted2e/templates/actor/character/tabs.hbs"
    },
    tabMain: {
      template: "systems/exalted2e/templates/actor/character/tab-main.hbs",
      scrollable: [""]
    },
    tabCombat: {
      template: "systems/exalted2e/templates/actor/character/tab-combat.hbs",
      scrollable: [""]
    },
    tabCharms: {
      template: "systems/exalted2e/templates/actor/character/tab-charms.hbs",
      scrollable: [""]
    },
    tabMartialArts: {
      template: "systems/exalted2e/templates/actor/character/tab-martial-arts.hbs",
      scrollable: [""]
    },
    tabAstrology: {
      template: "systems/exalted2e/templates/actor/character/_astrology.hbs",
      scrollable: [""]
    },
    tabSplat: {
      template: "systems/exalted2e/templates/actor/character/tab-splat.hbs",
      scrollable: [""]
    },
    tabInventory: {
      template: "systems/exalted2e/templates/actor/character/tab-inventory.hbs",
      scrollable: [""]
    },
    tabBiography: {
      template: "systems/exalted2e/templates/actor/character/tab-biography.hbs",
      scrollable: [""]
    },
    tabExperience: {
      template: "systems/exalted2e/templates/actor/character/tab-experience.hbs",
      scrollable: [""]
    },
    tabEffects: {
      template: "systems/exalted2e/templates/actor/character/tab-effects.hbs",
      scrollable: [""]
    },
    tabCrafting: {
      template: "systems/exalted2e/templates/actor/character/tab-crafting.hbs",
      scrollable: [""]
    },
    tabThaumaturgy: {
      template: "systems/exalted2e/templates/actor/character/tab-thaumaturgy.hbs",
      scrollable: [""]
    },
  };

  /** Current tab group state */
  tabGroups = { sheet: "tabMain" };

  // ── Context Preparation ─────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.document;
    const sys     = actor.system;
    const beh     = EX2E.splatBehaviors[sys.exaltType] ?? EX2E.splatBehaviors.solar;

    // Tab definitions (icons shown in vertical right-side nav)
    const tabs = {
      tabMain:      { id: "tabMain",      group: "sheet", icon: "fa-solid fa-user",           label: game.i18n.localize("EX2E.TabMain"),       cssClass: this.tabGroups.sheet === "tabMain"       ? "active" : "" },
      tabCombat:    { id: "tabCombat",    group: "sheet", icon: "fa-solid fa-shield-halved",  label: game.i18n.localize("EX2E.TabCombat"),     cssClass: this.tabGroups.sheet === "tabCombat"     ? "active" : "" },
      ...(beh.showCharms ? {
        tabCharms:      { id: "tabCharms",      group: "sheet", icon: "fa-solid fa-sun",       label: game.i18n.localize("EX2E.TabCharms"),      cssClass: this.tabGroups.sheet === "tabCharms"      ? "active" : "" },
        tabMartialArts: { id: "tabMartialArts", group: "sheet", icon: "fa-solid fa-hand-fist", label: game.i18n.localize("EX2E.TabMartialArts"), cssClass: this.tabGroups.sheet === "tabMartialArts" ? "active" : "" },
      } : {}),
      ...(beh.showAstrology  ? { tabAstrology: { id: "tabAstrology", group: "sheet", icon: "fa-solid fa-star",    label: game.i18n.localize("EX2E.SiderealAstrology"), cssClass: this.tabGroups.sheet === "tabAstrology" ? "active" : "" } } : {}),
      ...(beh.showSplatTab   ? { tabSplat:     { id: "tabSplat",     group: "sheet", icon: "fa-solid fa-diamond", label: game.i18n.localize("EX2E.TabSplat"),          cssClass: this.tabGroups.sheet === "tabSplat"     ? "active" : "" } } : {}),
      tabInventory: { id: "tabInventory", group: "sheet", icon: "fa-solid fa-suitcase",       label: game.i18n.localize("EX2E.TabInventory"),       cssClass: this.tabGroups.sheet === "tabInventory"  ? "active" : "" },
      tabBiography: { id: "tabBiography", group: "sheet", icon: "fa-solid fa-book",           label: game.i18n.localize("EX2E.TabBiography"),       cssClass: this.tabGroups.sheet === "tabBiography"  ? "active" : "" },
      tabExperience:{ id: "tabExperience",group: "sheet", icon: "fa-solid fa-graduation-cap", label: game.i18n.localize("EX2E.TabExperience"),      cssClass: this.tabGroups.sheet === "tabExperience" ? "active" : "" },
      tabEffects:   { id: "tabEffects",   group: "sheet", icon: "fa-solid fa-wand-sparkles",  label: game.i18n.localize("EX2E.TabEffects"),         cssClass: this.tabGroups.sheet === "tabEffects"    ? "active" : "" },
      ...((sys.abilities?.craft?.value ?? 0) >= 1 ? {
        tabCrafting: { id: "tabCrafting", group: "sheet", icon: "fa-solid fa-hammer", label: game.i18n.localize("EX2E.TabCrafting"), cssClass: this.tabGroups.sheet === "tabCrafting" ? "active" : "" }
      } : {}),
      tabThaumaturgy: { id: "tabThaumaturgy", group: "sheet", icon: "fa-solid fa-flask", label: game.i18n.localize("EX2E.TabThaumaturgy"), cssClass: this.tabGroups.sheet === "tabThaumaturgy" ? "active" : "" },
    };

    // Build available castes for the current exalt type
    const availableCastes = Object.entries(EX2E.castes[sys.exaltType] ?? {})
      .map(([k, v]) => ({ value: k, label: game.i18n.localize(v) }));

    // Prepare abilities grouped by exalt type
    const abilityGroups = this._buildAbilityGroups(sys);

    // Flat sorted list of abilities that have at least one specialty, de-duped across groups
    const _seenKeys = new Set();
    const specialtiesSection = abilityGroups
      .flatMap(g => g.abilities)
      .filter(ab => {
        if (_seenKeys.has(ab.key)) return false;
        _seenKeys.add(ab.key);
        return ab.specialties.length > 0;
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    // Prepare items grouped by type
    const charms     = actor.items.filter(i => i.type === "charm")      .sort((a,b) => a.name.localeCompare(b.name));
    // Per-charm prereq status, keyed by id, so the Charms tab can flag
    // unmet prerequisites without re-evaluating in the template.
    const charmPrereqs = {};
    for (const c of charms) {
      const report  = evaluateCharmPrereqs(c, actor);
      const missing = report.filter(r => !r.satisfied);
      charmPrereqs[c.id] = {
        has:     report.length > 0,
        met:     missing.length === 0,
        missing: missing.map(m => m.label).filter(Boolean).join("; ")
      };
    }

    // Collapse permanent stackable charms with the same name into one display row.
    // stackCounts: { representativeId → count } — only entries where count > 1.
    // stackHidden: set of non-representative ids to suppress from all group lists.
    const stackCounts = {};
    const stackHidden = new Set();
    {
      const seen = new Map(); // name → first id
      for (const c of charms) {
        if (c.system.duration !== "permanent") continue;
        if (!(c.system.keywords ?? []).includes("Stackable")) continue;
        if (seen.has(c.name)) {
          const repId = seen.get(c.name);
          stackCounts[repId] = (stackCounts[repId] ?? 1) + 1;
          stackHidden.add(c.id);
        } else {
          seen.set(c.name, c.id);
        }
      }
    }

    const maStyleItems = actor.items
      .filter(i => i.type === "martialartsstyle")
      .sort((a, b) => a.name.localeCompare(b.name));
    const maStyleNames = new Set(maStyleItems.map(s => s.name));
    const maStyles = maStyleItems.map(style => ({
      item:       style,
      charms:     charms.filter(c => c.system.martialArtsStyleName === style.name && !stackHidden.has(c.id)),
      isMastered: charms.some(c =>
        c.system.martialArtsStyleName === style.name && c.system.grantsMastery
      )
    }));

    // Group charms by their `system.ability` key. Ability-based exalts
    // store an ability (melee/brawl/…); Lunars and Alchemicals store an
    // attribute (strength/wits/…). Both live on the same field, so one
    // grouping pass covers both — labels are resolved against a combined
    // ability + attribute label map.
    const attrLabelByKey = {};
    for (const group of Object.values(EX2E.attributes)) {
      for (const [key, labelKey] of Object.entries(group)) attrLabelByKey[key] = labelKey;
    }
    const labelForCharmAbility = (key) => {
      if (!key) return game.i18n.localize("EX2E.Uncategorized");
      const labelKey = EX2E.abilityLabels[key] ?? attrLabelByKey[key];
      return labelKey ? game.i18n.localize(labelKey) : key;
    };
    let charmGroups;
    if (beh.charmGroupBy === "yozi") {
      const yoziBuckets = new Map();
      for (const c of charms) {
        if (c.system?.isSubmodule) continue;
        if (stackHidden.has(c.id)) continue;
        const k = c.system?.yoziPatron ?? "";
        if (!yoziBuckets.has(k)) yoziBuckets.set(k, []);
        yoziBuckets.get(k).push(c);
      }
      const labelForYozi = (key) => {
        if (!key) return game.i18n.localize("EX2E.YoziUnassigned");
        const labelKey = EX2E.yoziPatrons[key];
        return labelKey ? game.i18n.localize(labelKey) : key;
      };
      charmGroups = [...yoziBuckets.entries()]
        .map(([key, list]) => ({ key, label: labelForYozi(key), charms: list }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      const buckets = new Map();
      for (const c of charms) {
        if (c.system?.isSubmodule) continue;
        if (stackHidden.has(c.id)) continue;
        if (c.system?.ability === "martialarts"
            && c.system?.martialArtsStyleName
            && maStyleNames.has(c.system.martialArtsStyleName)) continue;
        const k = c.system?.ability ?? "";
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(c);
      }
      charmGroups = [...buckets.entries()]
        .map(([key, list]) => ({ key, label: labelForCharmAbility(key), charms: list }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    const submodulesByParent = {};
    for (const item of charms) {
      if (!item.system.isSubmodule) continue;
      const pid = item.system.parentCharmId || "__orphan__";
      (submodulesByParent[pid] ??= []).push(item);
    }

    // Spells — shown as a sub-section under the Charms tab, grouped by
    // tradition (Sorcery / Necromancy) then by circle. Alchemicals flavour
    // their Sorcery as "Procedures"; that's a display-only swap here.
    const spells = actor.items.filter(i => i.type === "spell")
      .sort((a, b) => (a.system?.circle ?? 0) - (b.system?.circle ?? 0) || a.name.localeCompare(b.name));
    const sorceryLabelKey = beh.sorceryLabelKey;
    const SORCERY_CIRCLES = {
      1: game.i18n.localize("EX2E.CircleTerrestrial"),
      2: game.i18n.localize("EX2E.CircleCelestial"),
      3: game.i18n.localize("EX2E.CircleSolar")
    };
    const NECROMANCY_CIRCLES = {
      1: game.i18n.localize("EX2E.CircleShadowlands"),
      2: game.i18n.localize("EX2E.CircleLabyrinth"),
      3: game.i18n.localize("EX2E.CircleVoid")
    };
    const WEAVING_CIRCLES = {
      1: game.i18n.localize("EX2E.CircleManMachine"),
      2: game.i18n.localize("EX2E.CircleGodMachine")
    };
    const isAlchemical = sys.exaltType === "alchemical";
    const spellBuckets = { sorcery: new Map(), necromancy: new Map(), weaving: new Map() };
    for (const s of spells) {
      const trad = s.system?.tradition;
      const key = trad === "necromancy" ? "necromancy" : trad === "weaving" ? "weaving" : "sorcery";
      const circleMax = key === "weaving" ? 2 : 3;
      const circle = Math.max(1, Math.min(circleMax, Number(s.system?.circle) || 1));
      if (!spellBuckets[key].has(circle)) spellBuckets[key].set(circle, []);
      spellBuckets[key].get(circle).push(s);
    }
    const spellGroups = {};
    const buildSpellGroups = (trad, circleLabels) => {
      return [...spellBuckets[trad].entries()]
        .sort(([a], [b]) => a - b)
        .map(([circle, list]) => ({ circle, label: circleLabels[circle], spells: list }));
    };
    spellGroups.sorcery    = buildSpellGroups("sorcery",    SORCERY_CIRCLES);
    spellGroups.necromancy = buildSpellGroups("necromancy", NECROMANCY_CIRCLES);
    spellGroups.weaving    = buildSpellGroups("weaving",    WEAVING_CIRCLES);
    const spellSections = [];
    if (isAlchemical && (sys.weaving?.initiation ?? 0) > 0) {
      spellSections.push({
        tradition:       "weaving",
        label:           game.i18n.localize("EX2E.TraditionWeaving"),
        initiation:      sys.weaving?.initiation ?? 0,
        initiationPath:  "system.weaving.initiation",
        initiationMax:   2,
        initiationLabel: game.i18n.localize("EX2E.WeavingInitiation"),
        groups:          spellGroups.weaving
      });
    }
    if ((sys.sorcery?.initiation ?? 0) > 0) {
      spellSections.push({
        tradition:       "sorcery",
        label:           game.i18n.localize(sorceryLabelKey),
        initiation:      sys.sorcery?.initiation ?? 0,
        initiationPath:  "system.sorcery.initiation",
        initiationMax:   3,
        initiationLabel: game.i18n.localize("EX2E.Initiation"),
        groups:          spellGroups.sorcery
      });
    }
    if ((sys.necromancy?.initiation ?? 0) > 0) {
      spellSections.push({
        tradition:       "necromancy",
        label:           game.i18n.localize("EX2E.TraditionNecromancy"),
        initiation:      sys.necromancy?.initiation ?? 0,
        initiationPath:  "system.necromancy.initiation",
        initiationMax:   3,
        initiationLabel: game.i18n.localize("EX2E.Initiation"),
        groups:          spellGroups.necromancy
      });
    }
    // Per-spell "circle too high for this caster's initiation" flag,
    // used by the template to show a warning indicator next to the
    // spell name. The activate button itself uses the richer
    // spellCastButton state below.
    const spellInitStatus = {};
    for (const s of spells) {
      let ok = false, required = 0, current = 0;
      if (s.system?.tradition === "weaving") {
        required = Math.max(1, Number(s.system?.circle) || 1);
        current  = Number(sys.weaving?.initiation ?? 0);
        ok       = current >= required;
      } else {
        const trad = s.system?.tradition === "necromancy" ? "necromancy" : "sorcery";
        required   = Math.max(1, Number(s.system?.circle) || 1);
        current    = Number(sys[trad]?.initiation ?? 0);
        ok         = current >= required;
      }
      spellInitStatus[s.id] = { ok, required, current };
    }
    // Per-spell activate-button state — shared with the spell-sheet's
    // Cast button via computeSpellCastButtonState. Gates the button
    // for: insufficient initiation, busy with another action, busy
    // shaping a different spell, ready-to-cast (this spell), mid-shape
    // (this spell), insufficient motes, insufficient willpower.
    const spellCastButton = {};
    for (const s of spells) {
      spellCastButton[s.id] = computeSpellCastButtonState(s);
    }

    const knacks     = actor.items.filter(i => i.type === "knack")      .sort((a,b) => a.name.localeCompare(b.name));
    const weapons    = actor.items.filter(i => i.type === "weapon")     .sort((a,b) => a.name.localeCompare(b.name));
    const armors     = actor.items.filter(i => i.type === "armor")      .sort((a,b) => a.name.localeCompare(b.name));
    const backgrounds= actor.items.filter(i => i.type === "background") .sort((a,b) => a.name.localeCompare(b.name));
    const intimacies = actor.items.filter(i => i.type === "intimacy")   .sort((a,b) => a.name.localeCompare(b.name));
    const conviction = actor.system?.virtues?.conviction?.value ?? 1;
    for (const int of intimacies) {
      const dmg = int.system?.ablationDamage ?? 0;
      int.ablationDots = Array.from({ length: conviction }, (_, i) => ({
        index:  i,
        filled: i < dmg
      }));
    }
    const meritflaws = actor.items.filter(i => i.type === "meritflaw")  .sort((a,b) => a.name.localeCompare(b.name));
    const equipments   = actor.items.filter(i => i.type === "equipment") .sort((a,b) => a.name.localeCompare(b.name));
    const hearthstones = actor.items.filter(i => i.type === "hearthstone").sort((a,b) => a.name.localeCompare(b.name));
    const manses       = actor.items.filter(i => i.type === "manse")      .sort((a,b) => a.name.localeCompare(b.name));

    const familiars = actor.items
      .filter(i => i.type === "familiar")
      .map(i => {
        const bg          = actor.items.get(i.system.backgroundId);
        const linkedActor = game.actors?.get(i.system.linkedActorId);
        return {
          id:              i.id,
          img:             i.img,
          name:            i.name,
          system:          i.system,
          bondRating:      bg?.system.value ?? 0,
          linkedActorName: linkedActor?.name ?? "",
          linkedActorId:   i.system.linkedActorId
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const cults = actor.items
      .filter(i => i.type === "cult")
      .map(i => {
        const bg     = actor.items.get(i.system.backgroundId);
        const rating = Math.max(0, Math.min(5, bg?.system.value ?? 0));
        return {
          id:        i.id,
          img:       i.img,
          name:      i.name,
          system:    i.system,
          rating,
          moteRegen: EX2E.cultMoteRegen[rating],
          wpHours:   EX2E.cultWpHours[rating]
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const artifactSlotMap = {};
    const allActorItems = [...actor.items];
    for (const item of allActorItems) {
      const count = item.system?.hearthstoneSlots ?? 0;
      if (!count) continue;
      const ids = item.system?.hearthstones ?? [];
      artifactSlotMap[item.id] = Array.from({ length: count }, (_, i) => {
        const id    = ids[i] ?? "";
        const stone = id ? allActorItems.find(s => s.id === id && s.type === "hearthstone") : null;
        return {
          index:       i,
          artifactId:  item.id,
          filled:      !!stone,
          stoneId:     id,
          stoneName:   stone?.name ?? "",
          stoneRating: stone?.system?.rating ?? 0
        };
      });
    }

    const virtueFlaw = actor.items.find(i => i.type === "virtueflaw") ?? null;
    const urgeItem   = actor.items.find(i => i.type === "urge") ?? null;

    // ── Combos (errata edition) — saved charm packets. ─────────────────
    const combos = actor.items.filter(i => i.type === "combo")
      .sort((a, b) => a.name.localeCompare(b.name));

    const byUid = new Map();
    for (const c of charms) {
      const uid = c.system?.charmUid;
      if (uid) byUid.set(uid, c);
    }
    const comboRows = combos.map(combo => {
      const uids      = combo.system?.charmUids ?? [];
      const resolved  = [];
      let missingCount = 0;
      for (const uid of uids) {
        const charm = byUid.get(uid);
        if (charm) resolved.push(charm);
        else       missingCount++;
      }
      const preview = { motes: 0, willpower: 0, bashing: 0, lethal: 0, aggravated: 0, xp: 0 };
      for (const charm of resolved) {
        const c = charm.system?.cost ?? {};
        preview.motes      += Number(c.motes)            || 0;
        preview.willpower  += Number(c.willpower)        || 0;
        preview.bashing    += Number(c.bashingHealth)    || 0;
        preview.lethal     += Number(c.lethalHealth)     || 0;
        preview.aggravated += Number(c.aggravatedHealth) || 0;
        preview.xp         += Number(c.xp)               || 0;
      }
      const bits = [];
      if (preview.motes)      bits.push(`${preview.motes}m`);
      if (preview.willpower)  bits.push(`${preview.willpower}wp`);
      if (preview.bashing)    bits.push(`${preview.bashing}b`);
      if (preview.lethal)     bits.push(`${preview.lethal}l`);
      if (preview.aggravated) bits.push(`${preview.aggravated}a`);
      if (preview.xp)         bits.push(`${preview.xp}xp`);
      return {
        id:           combo.id,
        name:         combo.name,
        img:          combo.img,
        iconStrip:    resolved.slice(0, 6).map(c => ({ id: c.id, name: c.name, img: c.img })),
        totalCount:   uids.length,
        missingCount,
        costPreview:  bits.join(" "),
        canActivate:  resolved.length > 0
      };
    });

    // Effects — split into temporal (durationed or turn-refreshable) and
    // permanent buckets. The DV-refresh machinery we ship flags its AEs
    // with `exalted2e.dvRefreshable` even though they don't carry a
    // formal duration, so we treat those as temporal here.
    const effects = this._buildEffectsData(actor);

    // ── Purchase log (Experience tab) ─────────────────────────────────
    const rawLog = sys.purchaseLog ?? [];
    const totalEarned = Number(sys.experience?.total ?? 0);
    let runningSum = 0;
    const purchaseLogRows = rawLog.map((e, i) => {
      runningSum += Number(e.xpCost) || 0;
      return {
        index:      i,
        dateText:   new Date(e.timestamp || 0).toLocaleString(),
        traitLabel: e.traitLabel,
        oldValue:   e.oldValue,
        newValue:   e.newValue,
        xpCost:     e.xpCost,
        note:       e.note,
        overdraft:  runningSum > totalEarned
      };
    }).reverse();   // newest-first
    const canEditXp = ex2eCan("purchaseMode");

    // XP cost reference table (Experience tab) — rows built per-exalt from
    // the resolved xpCosts setting.
    const xpCosts    = resolveXpCosts(game.settings.get("exalted2e", "xpCosts") ?? {});
    const xpCostRows = buildXpCostRows(sys.exaltType ?? "solar", xpCosts);

    const limitLabel = game.i18n.localize(beh.limitLabelKey);

    const cripplingInjuryTypes = {
      "arm-left":  game.i18n.localize("EX2E.CripplingTypeArmLeft"),
      "arm-right": game.i18n.localize("EX2E.CripplingTypeArmRight"),
      "leg-left":  game.i18n.localize("EX2E.CripplingTypeLegLeft"),
      "leg-right": game.i18n.localize("EX2E.CripplingTypeLegRight"),
      "eye-left":  game.i18n.localize("EX2E.CripplingTypeEyeLeft"),
      "eye-right": game.i18n.localize("EX2E.CripplingTypeEyeRight"),
      "other":     game.i18n.localize("EX2E.CripplingTypeOther"),
    };

    // Heart's Blood forms (Lunar only)
    const forms = this.actor.itemTypes?.form ?? this.actor.items.filter(i => i.type === "form");
    const heartsBloodForms = forms
      .filter(f => f.system.formType !== "warform")
      .map(f => ({ id: f.id, name: f.name, formType: f.system.formType }));
    const activeFormId = sys.splat?.lunar?.activeFormId ?? "";
    const spiritShapeFormId = sys.splat?.lunar?.spiritShapeFormId ?? "";
    const warformItem = forms.find(f => f.system.formType === "warform");
    const dbtActive = !!warformItem && activeFormId === warformItem.id;

    // 3c-2: Active Motivation Campaigns
    const motivationCampaignsTargetingMe = Object.entries(
      this.actor.flags?.exalted2e?.motivationBreaks ?? {}
    ).map(([attackerId, c]) => ({
      attackerId,
      otherActorName:      c.attackerName ?? game.actors.get(attackerId)?.name ?? "?",
      targetMotivation:    c.targetMotivation ?? "",
      attemptCount:        c.attemptCount      ?? 0,
      defenderPermWpSpent: c.defenderPermWpSpent ?? 0,
      status:              c.status ?? "active",
      attemptsLabel:       game.i18n.format("EX2E.MotivationBreakAttempts", { count: c.attemptCount ?? 0 }),
      permWpLabel:         game.i18n.format("EX2E.MotivationBreakPermWpSpent", { count: c.defenderPermWpSpent ?? 0 })
    }));

    const motivationCampaignsImRunning = [];
    for (const other of game.actors) {
      const c = other.flags?.exalted2e?.motivationBreaks?.[this.actor.id];
      if (!c) continue;
      motivationCampaignsImRunning.push({
        defenderId:          other.id,
        otherActorName:      other.name,
        targetMotivation:    c.targetMotivation ?? "",
        attemptCount:        c.attemptCount      ?? 0,
        defenderPermWpSpent: c.defenderPermWpSpent ?? 0,
        status:              c.status ?? "active",
        attemptsLabel:       game.i18n.format("EX2E.MotivationBreakAttempts", { count: c.attemptCount ?? 0 }),
        permWpLabel:         game.i18n.format("EX2E.MotivationBreakPermWpSpent", { count: c.defenderPermWpSpent ?? 0 })
      });
    }

    const showMotivationCampaigns = motivationCampaignsTargetingMe.length > 0
                                  || motivationCampaignsImRunning.length > 0;

    const animaLabel = (beh.animaLiminalAtDim && sys.anima === "dim")
      ? game.i18n.localize("EX2E.AnimaLiminal")
      : game.i18n.localize(EX2E.anima[sys.anima] ?? "EX2E.AnimaNone");

    const dbFluxTiers = new Set(["burning", "bonfire", "totemic"]);
    const dbFluxInfo  = (beh.showDbFlux && dbFluxTiers.has(sys.anima))
      ? { ...EX2E.DB_FLUX[sys.anima], tier: sys.anima }
      : null;

    const _hexRe = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
    const animaColors = actor.getFlag("exalted2e", "animaColors") ?? [null, null, null];
    const _animaParts = [
      (animaColors[0] && _hexRe.test(animaColors[0])) ? `--anima-color-1:${animaColors[0]}` : "",
      (animaColors[1] && _hexRe.test(animaColors[1])) ? `--anima-color-2:${animaColors[1]}` : "",
      (animaColors[2] && _hexRe.test(animaColors[2])) ? `--anima-color-3:${animaColors[2]}` : ""
    ].filter(Boolean);
    const animaBannerStyle = _animaParts.length ? _animaParts.join(";") + ";" : "";
    const canEditAnimaColors = this.isEditable;

    const animaPower = actor.items.find(i => i.flags?.exalted2e?.animaPower === true) ?? null;

    const greaterSigns = beh.showAstrology
      ? actor.items
          .filter(i => i.type === "animapower" && i.system.isGreaterSign === true)
          .filter(i => _greaterSignPrereqMet(actor, i.system.caste))
          .map(i => ({
            id:     i.id,
            name:   i.name,
            active: i.system.active,
            icon:   _GREATER_SIGN_ICONS[i.system.caste] ?? "fa-star",
          }))
      : [];

    // Astrology tab data (Sidereal only)
    const collegeGroups = [];
    if (beh.showAstrology) {
      const EX = game.exalted2e.EX2E;
      const ownMaiden = sys.caste;
      for (const [maiden, maidenLabelKey] of Object.entries(EX.siderealMaidens)) {
        const cols = Object.entries(EX.siderealColleges)
          .filter(([, v]) => v.maiden === maiden)
          .map(([key, v]) => ({
            key,
            maiden,
            label: game.i18n.localize(v.labelKey),
            value: sys.splat?.sidereal?.colleges?.[maiden]?.[key] ?? 0,
          }));
        collegeGroups.push({
          maiden,
          label: game.i18n.localize(maidenLabelKey),
          isOwnMaiden: maiden === ownMaiden,
          colleges: cols,
        });
      }
    }
    const destinies = actor.items.filter(i => i.type === "destiny")
      .sort((a, b) => a.name.localeCompare(b.name));

    const craftingProjects = (sys.craftingProjects ?? []).map(p => ({
      ...p,
      difficulty:  p.targetResources + (p.isPerfect ? 5 : 0),
      sizeLabel:   game.i18n.localize(p.size === "small" ? "EX2E.CraftingSizeSmall" : "EX2E.CraftingSizeLarge"),
      statusLabel: game.i18n.localize(`EX2E.CraftingStatus${p.status.charAt(0).toUpperCase() + p.status.slice(1)}`),
    }));

    const artifactProjects = (sys.artifactProjects ?? []).map(p => ({
      ...p,
      statusLabel: game.i18n.localize(`EX2E.ArtifactStatus${p.status.charAt(0).toUpperCase() + p.status.slice(1)}`),
    }));

    // ── Clinch state ─────────────────────────────────────────────────────
    const _clinchCombatant = [...(game.combat?.combatants ?? [])]
      .find(c => c.actorId === actor.id) ?? null;
    const _clinchFlag  = _clinchCombatant?.flags?.exalted2e?.clinch ?? null;
    const clinchRole   = _clinchFlag?.role ?? null;
    const clinchPartnerName = (() => {
      if (!_clinchFlag) return null;
      const partnerId = _clinchFlag.heldCombatantId ?? _clinchFlag.controllerCombatantId;
      return game.combat?.combatants.get(partnerId)?.actor?.name ?? null;
    })();

    // ── Thaumaturgy tab ──────────────────────────────────────────────────
    const _artItems = actor.items.filter(i => i.type === "thaum-art")
      .sort((a, b) => a.system.artName.localeCompare(b.system.artName));
    const _procedureItems = actor.items.filter(i => i.type === "procedure");
    const _ownedArtNames  = new Set(_artItems.map(a => a.system.artName));
    const thaumaturgySections = _artItems.map(art => ({
      artItem:    art,
      artName:    art.system.artName,
      degree:     art.system.degree,
      procedures: _procedureItems
        .filter(p => p.system.art === art.system.artName)
        .map(p => ({
          id:        p.id,
          name:      p.name,
          img:       p.img,
          system:    p.system,
          usable:    p.system.minDegree <= art.system.degree,
          isInstant: p.system.castingTime.toLowerCase() === "instant",
        }))
        .sort((a, b) => a.system.minDegree - b.system.minDegree || a.name.localeCompare(b.name))
    }));
    const orphanProcedures = _procedureItems
      .filter(p => !_ownedArtNames.has(p.system.art))
      .map(p => ({ id: p.id, name: p.name, img: p.img, system: p.system }));

    // ── Fatigue display ──────────────────────────────────────────────────
    const fatiguePenaltyTotal = [...actor.effects]
      .filter(e => !e.disabled && e.flags?.exalted2e?.fatigueType)
      .reduce((sum, e) => sum + (e.flags?.exalted2e?.internalPenalty?.value ?? 0), 0);
    const fatigueKnockoutThreshold =
      (sys.attributes?.stamina?.value ?? 0) + (sys.abilities?.resistance?.value ?? 0);
    const canRollArmorFatigue = actor.items.some(
      i => i.type === "armor" && i.system.equipped && Math.abs(i.system.effectiveFatiguePenalty ?? 0) > 0
    );

    return {
      ...context,
      actor,
      system:           sys,
      tabs,
      config:           EX2E,
      yoziPatrons:      Object.entries(EX2E.yoziPatrons).map(([k, v]) => ({ key: k, label: game.i18n.localize(v) })),
      availableCastes,
      abilityGroups,
      specialtiesSection,
      useFourColumnAbilities: beh.fourColumnAbilities,
      useAttributeCasteUI:    beh.attributeCasteUI,
      splatTypeChoices: Object.entries(EX2E.splatTypes).filter(([k]) => k !== "martialarts").map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      charms,
      charmGroups,
      submodulesByParent,
      charmPrereqs,
      stackCounts,
      spells,
      spellSections,
      spellInitStatus,
      spellCastButton,
      knacks,
      combos: comboRows,
      isLunar: beh.isLunar,
      weapons,
      armors,
      backgrounds,
      intimacies,
      meritflaws,
      virtueFlaw,
      urgeItem,
      effects,
      purchaseLogRows,
      canEditXp,
      xpCostRows,
      limitLabel,
      motivationCampaignsTargetingMe,
      motivationCampaignsImRunning,
      showMotivationCampaigns,
      heartsBloodForms,
      activeFormId,
      spiritShapeFormId,
      dbtActive,
      isGM: game.user.isGM,
      isEditable: this.isEditable,
      useIntimacyIntensity: game.settings.get("exalted2e", "useIntimacyIntensity"),
      animaLabel,
      dbFluxInfo,
      animaBannerStyle,
      canEditAnimaColors,
      animaPower,
      greaterSigns,
      collegeGroups,
      destinies,
      equipments,
      hearthstones,
      manses, familiars, cults,
      artifactSlotMap,
      maStyles,
      craftingProjects,
      artifactProjects,
      hasAttunementMotes: (actor.system.attunementMotes ?? 0) > 0,
      cripplingInjuryTypes,
      clinchRole,
      clinchPartnerName,
      fatiguePenaltyTotal,
      fatigueKnockoutThreshold,
      canRollArmorFatigue,
      thaumaturgySections,
      orphanProcedures,
    };
  }

  /**
   * Build the Effects-tab payload. Splits the actor's ActiveEffects into
   * `temporal` (any with a duration OR flagged dvRefreshable) and
   * `permanent` (everything else).
   */
  _buildEffectsData(actor) {
    const temporal = [];
    const permanent = [];
    const stackGroups = new Map(); // name → { entry, count }
    for (const eff of actor.effects) {
      const refreshable      = !!eff.flags?.exalted2e?.dvRefreshable;
      const charmDuration    = eff.flags?.exalted2e?.charmDuration;
      const charmStackable   = !!eff.flags?.exalted2e?.charmStackable;
      const durationLabelKey = charmDuration ? (EX2E.durations[charmDuration] ?? null) : null;
      const isTemporal = refreshable || eff.isTemporary
        || (charmDuration && charmDuration !== "permanent");

      if (!isTemporal && charmStackable) {
        if (stackGroups.has(eff.name)) {
          stackGroups.get(eff.name).count++;
          continue;
        }
        const entry = { id: eff.id, name: eff.name, img: eff.img || "icons/svg/aura.svg", disabled: eff.disabled, durationLabel: "", isSpellEffect: !!(eff.flags?.exalted2e?.spellEffect) };
        stackGroups.set(eff.name, { entry, count: 1 });
        permanent.push(entry);
        continue;
      }

      const entry = {
        id:           eff.id,
        name:         eff.name,
        img:          eff.img || "icons/svg/aura.svg",
        disabled:     eff.disabled,
        durationLabel: refreshable
          ? game.i18n.localize("EX2E.EffectUntilNextTurn")
          : (durationLabelKey ? game.i18n.localize(durationLabelKey) : (eff.duration?.label ?? "")),
        isSpellEffect: !!(eff.flags?.exalted2e?.spellEffect),
      };
      (isTemporal ? temporal : permanent).push(entry);
    }
    for (const { entry, count } of stackGroups.values()) {
      if (count > 1) entry.name = `${entry.name} x${count}`;
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    temporal.sort(byName);
    permanent.sort(byName);
    return { temporal, permanent };
  }

  /**
   * Build the ability groups array for the current exalt type.
   * Each group: { key, label, abilities[], isCurrentCaste }
   */
  _buildAbilityGroups(sys) {
    const mapAbilities = keys => keys.map(key => {
      const ab = sys.abilities[key] ?? { value: 0, caste: false, favored: false, specialties: [] };
      return {
        key,
        label:       game.i18n.localize(EX2E.abilityLabels[key] ?? key),
        value:       ab.value,
        caste:       ab.caste,
        favored:     ab.favored,
        specialties: ab.specialties ?? [],
        fieldBase:   `system.abilities.${key}`
      };
    });

    // ── Use predefined group definitions for all exalt types ───────────
    // EX2E.abilityGroups.lunar (war/life/wisdom) and .alchemical
    // (warfare/labor/learning) are DISPLAY column groupings for the four-
    // column ability layout, NOT caste-keyed sets. The actual castes for
    // attribute-based exalts live in EX2E.attributeGroups; ability-caste
    // auto-assign skips Lunar/Alchemical entirely (in ExaltedActor._preUpdate).
    const groupDefs = EX2E.abilityGroups[sys.exaltType] ?? EX2E.abilityGroups.mortal;
    const groupedKeys = new Set(groupDefs.flatMap(g => g.abilities));
    const ungrouped   = EX2E.abilities.filter(k => !groupedKeys.has(k));

    const groups = groupDefs.map(g => ({
      key:           g.key,
      label:         game.i18n.localize(g.label),
      abilities:     mapAbilities(g.abilities),
      isCurrentCaste: sys.caste === g.key
    }));

    if (ungrouped.length) {
      groups.push({
        key:           "other",
        label:         game.i18n.localize("EX2E.AbilityGroupOther"),
        abilities:     mapAbilities(ungrouped),
        isCurrentCaste: false
      });
    }

    return groups;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.partId = partId;
    if (partId.startsWith("tab")) {
      context.cssClass = this.tabGroups.sheet === partId ? "active" : "";
    }

    // Enrich HTML fields for the biography tab
    if (partId === "tabBiography") {
      const enrichOpts = {
        secrets: this.document.isOwner,
        rollData: this.document.getRollData?.() ?? {},
        relativeTo: this.document
      };
      context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.document.system.biography, enrichOpts);
      context.enrichedNotes     = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.document.system.notes, enrichOpts);
    }

    return context;
  }

  // ── Post-render ─────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender(context, options);

    // Stamp exalt-type and caste as data attributes for CSS theming
    const sys = this.document.system;
    this.element.dataset.exaltType = sys.exaltType ?? "solar";
    this.element.dataset.caste     = sys.caste     ?? "";

    // Activate dot-rating and box-rating click listeners
    this.element.querySelectorAll(".dot-rating .dot").forEach(dot => {
      dot.addEventListener("click", this.#onDotClick.bind(this));
    });
    this.element.querySelectorAll(".box-rating .box").forEach(box => {
      box.addEventListener("click", this.#onBoxClick.bind(this));
    });

    // Willpower pip clicks
    this.element.querySelectorAll(".willpower-track .wp-pip").forEach(pip => {
      pip.addEventListener("click", this.#onWillpowerClick.bind(this));
    });

    // Limit pip clicks
    this.element.querySelectorAll(".limit-track .limit-pip").forEach(pip => {
      pip.addEventListener("click", this.#onLimitClick.bind(this));
    });

    // Mote current value inline edits
    this.element.querySelectorAll(".mote-value-input").forEach(inp => {
      inp.addEventListener("change", this.#onMoteInputChange.bind(this));
    });

    // Make item rows draggable so they can be dropped onto the combo builder
    // or other drag-accepting targets (weapons onto attack dialogs, etc.).
    // The combo sheet's _onDrop already filters to type === "charm".
    this.element.querySelectorAll(".item-row[data-item-id]").forEach(row => {
      row.draggable = true;
      row.addEventListener("dragstart", event => {
        const item = this.document.items.get(row.dataset.itemId);
        if (!item) return;
        event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
      });
    });

    // Restore per-group collapsed state on the Charms tab and wire the
    // toggle listener so clicks update the remembered set in place.
    this.element.querySelectorAll("details.charm-group").forEach(details => {
      const key = details.dataset.groupKey;
      if (!key) return;
      if (this._collapsedGroups.has(key)) details.removeAttribute("open");
      else                                details.setAttribute("open", "");
      details.addEventListener("toggle", () => {
        if (details.open) this._collapsedGroups.delete(key);
        else              this._collapsedGroups.add(key);
      });
    });

    // Purchase Mode header button — injected into the window chrome to
    // the left of the built-in Controls dropdown. Visible to GM +
    // Assistant GM only. ApplicationV2 re-renders preserve the window
    // chrome, so the button persists across re-renders — we upsert its
    // visual state on every render instead of bailing out when it
    // already exists, or the icon/tooltip would go stale after toggling.
    if (_canTogglePurchaseMode()) {
      const header = this.element.querySelector(".window-header");
      const controls = header?.querySelector(".header-control");
      if (header && controls) {
        const locked = !!this.document.system.purchaseLocked;
        let btn = header.querySelector(".ex2e-purchase-toggle");
        if (!btn) {
          btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.action = "togglePurchaseMode";
          controls.before(btn);
        }
        btn.className = "header-control ex2e-purchase-toggle" + (locked ? " active" : "");
        btn.title = game.i18n.localize(locked ? "EX2E.PurchaseModeOn" : "EX2E.PurchaseModeOff");
        btn.innerHTML = `<i class="fa-solid ${locked ? "fa-lock" : "fa-lock-open"}"></i>`;
      }
    }
  }

  // ── Dot / Box Click ─────────────────────────────────────────────────────
  #onDotClick(event) {
    this.#onTrackClick(event, ".dot-rating");
  }

  #onBoxClick(event) {
    this.#onTrackClick(event, ".box-rating");
  }

  async #onTrackClick(event, selector) {
    if (!this.isEditable) return;
    const pip      = event.currentTarget;
    const track    = pip.closest(selector);
    const name     = track?.dataset.name;
    const newValue = parseInt(pip.dataset.value);
    const min      = parseInt(track?.dataset.min ?? 0);
    const current  = parseInt(track?.dataset.current ?? 0);
    // Only the first pip toggles to minimum; any other pip sets its own value,
    // clamped to the track's declared minimum.
    const val      = (newValue === 1 && current === 1)
      ? min
      : Math.max(min, newValue);
    if (!name) return;

    // Dot/box ratings inside an item row belong to the embedded item, not the actor
    const itemRow = pip.closest(".item-row[data-item-id]");
    if (itemRow) {
      const item = this.document.items.get(itemRow.dataset.itemId);
      if (item) await item.update({ [name]: val });
      return;
    }

    // ArrayField elements can't be updated by index path — null-then-set to force replace
    const specMatch = name.match(/^system\.abilities\.(\w+)\.specialties\.(\d+)\.value$/);
    if (specMatch) {
      const abilKey = specMatch[1];
      const idx     = parseInt(specMatch[2]);
      const specialties = foundry.utils.deepClone(
        this.document.system.abilities[abilKey]?.specialties ?? []
      );
      if (specialties[idx]) {
        specialties[idx].value = val;
        const path = `system.abilities.${abilKey}.specialties`;
        await this.document.update({ [path]: null });
        await this.document.update({ [path]: specialties });
      }
      return;
    }

    this.document.update({ [name]: val });
  }

  #onWillpowerClick(event) {
    if (!this.isEditable) return;
    const pip = event.currentTarget;
    const val = parseInt(pip.dataset.value);
    this.document.update({ "system.willpower.value": val });
  }

  #onLimitClick(event) {
    if (!this.isEditable) return;
    const pip     = event.currentTarget;
    const track   = pip.closest(".limit-track");
    const current = parseInt(track?.dataset.current ?? 0);
    const clicked = parseInt(pip.dataset.value);
    const val     = (clicked === current) ? 0 : clicked;
    this.document.update({ "system.limit": val });
  }

  #onMoteInputChange(event) {
    if (!this.isEditable) return;
    const input = event.currentTarget;
    const pool  = input.dataset.pool; // "personal" or "peripheral"
    const field = input.dataset.field; // "value"
    const val   = parseInt(input.value) || 0;
    this.document.update({ [`system.motes.${pool}.${field}`]: val });
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  static async #onRollAttribute(event, target) {
    const attrKey = target.dataset.attribute;
    if (!attrKey) return;
    // Delegates to ExaltedRoll.rollAttribute so wound / internal /
    // external penalties apply; category is auto-detected from the
    // attribute's group in EX2E.attributes.
    await ExaltedRoll.rollAttribute(this.document, attrKey);
  }

  static async #onRollAbility(event, target) {
    const abilKey = target.dataset.ability;
    const attrKey = target.dataset.attribute ?? null;
    if (!abilKey) return;
    const actor   = this.document;
    const sys     = actor.system;

    // Resolve attribute: dataset override → stored defaultAttribute → "dexterity"
    const defaultAttr = attrKey || sys.abilities[abilKey]?.defaultAttribute || "dexterity";

    await ExaltedRoll.rollAttributeAbility(actor, defaultAttr, abilKey, {
      flavor: `${game.i18n.localize(EX2E.abilityLabels[abilKey] ?? abilKey)}`
    });
  }

  static async #onRollPool(event, target) {
    const pool     = parseInt(target.dataset.pool) || 0;
    const flavor   = target.dataset.flavor   ?? "";
    // Buttons can opt into a specific penalty category via
    // data-category="physical|social|mental|all"; default "all" matches
    // only universal penalties (wound + any "all"-typed effects).
    const category = target.dataset.category ?? "all";
    await ExaltedRoll.rollPool(this.document, { pool, flavor, category });
  }

  static async #onRollAttack(event, target) {
    const row = target.closest("[data-weapon-id]");
    const weaponId  = row?.dataset.weaponId;
    const modeIndex = parseInt(row?.dataset.modeIndex) || 0;
    if (!weaponId) return;
    await ExaltedRoll.rollAttack(this.document, weaponId, { modeIndex });
  }

  static async #onRollSocialAttack(event, target) {
    const { SocialAttackDialog } = await import("../../dialogs/social-attack-dialog.mjs");
    const { ExaltedRoll }        = await import("../../rolls/exalted-roll.mjs");

    let picked = game.user.targets.first()?.actor ?? null;
    if (!picked) {
      const { pickTargetActor } = await import("../../helpers/targeting.mjs");
      picked = await pickTargetActor();
      if (!picked) return;
    }

    const options = await SocialAttackDialog.prompt({ attacker: this.actor, target: picked });
    if (!options) return;

    await ExaltedRoll.rollSocialAttack(this.actor, options);
  }

  static async #onAddSpecialty(event, target) {
    const { AddSpecialtyDialog } = await import("../../dialogs/add-specialty-dialog.mjs");

    const abilities = EX2E.abilities.map(k => ({
      value: k,
      label: game.i18n.localize(EX2E.abilityLabels[k] ?? k)
    }));

    const result = await AddSpecialtyDialog.prompt({ abilities });
    if (!result) return;

    const specialties = foundry.utils.deepClone(
      this.document.system.abilities[result.ability]?.specialties ?? []
    );
    specialties.push({ name: result.name, value: 1 });
    await this.document.update({ [`system.abilities.${result.ability}.specialties`]: specialties });
  }

  static async #onRemoveSpecialty(event, target) {
    const abilKey = target.dataset.ability;
    const index   = parseInt(target.dataset.index);
    if (!abilKey || isNaN(index)) return;
    const specialties = foundry.utils.deepClone(
      this.document.system.abilities[abilKey]?.specialties ?? []
    );
    specialties.splice(index, 1);
    // Null-then-set forces Foundry to replace the array instead of merging
    await this.document.update({
      [`system.abilities.${abilKey}.specialties`]: null
    });
    await this.document.update({
      [`system.abilities.${abilKey}.specialties`]: specialties
    });
  }

  static async #onApplyDamage(event, target) {
    const type   = target.dataset.damageType ?? "bashing";
    const amount = parseInt(target.dataset.amount ?? 1);
    await this.document.applyDamage(amount, type);
  }

  static async #onHealDamage(event, target) {
    const amount = parseInt(target.dataset.amount ?? 1);
    await this.document.healDamage(amount);
  }

  static async #onSpendMotes(event, target) {
    const pool   = target.dataset.pool ?? "peripheral";
    const amount = parseInt(target.dataset.amount ?? 1);
    await this.document.spendMotes(amount, pool);
  }

  static async #onRecoverMotes(event, target) {
    const pool   = target.dataset.pool ?? "peripheral";
    const amount = parseInt(target.dataset.amount ?? 1);
    await this.document.recoverMotes(amount, pool);
  }

  static async #onCreateItem(event, target) {
    const type    = target.dataset.type ?? "charm";
    const name    = game.i18n.localize(`EX2E.New${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const data    = { name, type };
    if (type === "spell" && target.dataset.tradition) {
      data.system = { tradition: target.dataset.tradition };
    } else if (type === "charm" && target.dataset.exaltType) {
      data.system = { exaltType: target.dataset.exaltType };
      if (target.dataset.yoziPatron !== undefined) {
        data.system.yoziPatron = target.dataset.yoziPatron;
      }
    }
    await Item.create(data, { parent: this.document });
  }

  static async #onEditItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    item?.sheet?.render({ force: true });
  }

  static async #onToggleAblationDot(event, target) {
    const itemId   = target.dataset.itemId;
    const dotIndex = parseInt(target.dataset.dotIndex, 10);
    const item     = this.document.items.get(itemId);
    if (!item) return;
    const current  = item.system?.ablationDamage ?? 0;
    const newValue = dotIndex < current ? dotIndex : dotIndex + 1;
    await item.update({ "system.ablationDamage": newValue });
  }

  static async #onDeleteItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("EX2E.DeleteItemConfirm").replace("{name}", item.name) },
      yes: { label: game.i18n.localize("Yes"), icon: "fa-solid fa-trash" },
      no:  { label: game.i18n.localize("No"),  icon: "fa-solid fa-times" }
    });
    if (confirmed) await item.delete();
  }

  static async #onActivateCharm(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item?.type === "charm") {
      await item.activateCharm();
    } else if (item?.type === "spell") {
      // Route through the shared sorcery cast flow — opens the confirm
      // dialog, handles shape→shape→cast chain, mote/WP commitment with
      // refund-on-interrupt. Same code path as the spell item sheet's
      // Cast button.
      const { castSpellFlow } = await import("../../ui/cast-spell-flow.mjs");
      await castSpellFlow(item);
    }
  }

  static async #onRollHealingCharm(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (!item) return;
    const hr       = item.system.healingRoll;
    const rollData = this.document.getRollData();
    const pool     = evaluateCharmFormula(hr.pool, rollData, 0)
                   + evaluateCharmFormula(hr.bonus, rollData, 0);
    if (pool <= 0) return;
    const roll = new ExaltedRoll({ pool, flavor: `${item.name} — ${game.i18n.localize("EX2E.RollHeal")}` });
    await roll.evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.document }) });
    const healAmount = roll.successes;
    if (healAmount > 0) {
      await this.document.healDamage(healAmount);
    }
  }

  static async #onActivateCombo(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item?.type === "combo") await item.activateCombo();
  }

  static async #onTogglePurchaseMode(event, target) {
    if (!_canTogglePurchaseMode()) return;
    const cur = this.document.system.purchaseLocked ?? false;
    await this.document.update({ "system.purchaseLocked": !cur });
  }

  static async #onEditPurchaseEntry(event, target) {
    if (!ex2eCan("purchaseMode")) return;
    const idx = parseInt(target.dataset.index, 10);
    if (!Number.isFinite(idx)) return;
    const log = foundry.utils.deepClone(this.document.system.purchaseLog ?? []);
    const entry = log[idx];
    if (!entry) return;

    const { PurchaseConfirmDialog } = await import("../../dialogs/purchase-confirm-dialog.mjs");
    const result = await PurchaseConfirmDialog.prompt({
      actor:        this.document,
      change:       {
        traitLabel: entry.traitLabel,
        oldValue:   entry.oldValue,
        newValue:   entry.newValue
      },
      initialXp:    entry.xpCost,
      initialNote:  entry.note,
      showStubHint: false,
      isEdit:       true
    });
    if (result === null) return;

    const xpDelta = result.xpCost - (Number(entry.xpCost) || 0);
    entry.xpCost = result.xpCost;
    entry.note   = result.note;
    log[idx] = entry;

    await this.document.update({
      "system.purchaseLog":      log,
      "system.experience.value": (this.document.system.experience.value ?? 0) - xpDelta
    });
  }

  static async #onDeletePurchaseEntry(event, target) {
    if (!ex2eCan("purchaseMode")) return;
    const idx = parseInt(target.dataset.index, 10);
    if (!Number.isFinite(idx)) return;
    const log = foundry.utils.deepClone(this.document.system.purchaseLog ?? []);
    const entry = log[idx];
    if (!entry) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize("EX2E.Delete") },
      content: `<p>${game.i18n.format("EX2E.PurchaseLogDeleteConfirm", {
        xp: entry.xpCost
      })}</p>`,
      yes: { label: game.i18n.localize("EX2E.Delete"), icon: "fa-solid fa-trash" },
      no:  { label: game.i18n.localize("Cancel"),     icon: "fa-solid fa-xmark"  }
    });
    if (!confirmed) return;

    log.splice(idx, 1);
    await this.document.update({
      "system.purchaseLog":      log,
      "system.experience.value": (this.document.system.experience.value ?? 0) + (Number(entry.xpCost) || 0)
    });
  }

  static async #onPickVirtueFlaw(event, target) {
    const { VirtueFlawPickerDialog } = await import("../../dialogs/virtueflaw-picker-dialog.mjs");
    const choice = await VirtueFlawPickerDialog.prompt({ exaltType: this.document.system.exaltType });
    if (!choice?.uuid) return;

    const source = await fromUuid(choice.uuid);
    if (!source) return;

    // Remove any existing virtue flaw (single-slot)
    const existing = this.document.items.filter(i => i.type === "virtueflaw");
    if (existing.length) await this.document.deleteEmbeddedDocuments("Item", existing.map(i => i.id));

    await this.document.createEmbeddedDocuments("Item", [source.toObject()]);
  }

  static async #onClearVirtueFlaw(event, target) {
    const existing = this.document.items.filter(i => i.type === "virtueflaw");
    if (!existing.length) return;
    await this.document.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
  }

  static async #onToggleEquip(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (!item) return;

    if (!item.system.equipped) {
      if (!canEquipToSlot(this.document, item, itemId)) {
        const slot      = item.system.slot;
        const slotLabel = game.i18n.localize(`EX2E.Slot${slot.charAt(0).toUpperCase()}${slot.slice(1)}`);
        ui.notifications.warn(game.i18n.format("EX2E.SlotFull", { slot: slotLabel }));
        return;
      }
    }

    await item.update({ "system.equipped": !item.system.equipped });
  }

  // ── Active Effects tab handlers ──────────────────────────────────────────

  static async #onCreateEffect(event, target) {
    const created = await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("EX2E.NewEffect"),
      img:  "icons/svg/aura.svg",
      disabled: true   // opens disabled so the GM/player finishes editing before it applies
    }]);
    created[0]?.sheet?.render({ force: true });
  }

  static async #onEditEffect(event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    effect?.sheet?.render({ force: true });
  }

  static async #onDeleteEffect(event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    if (!effect) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("EX2E.DeleteEffectConfirm").replace("{name}", effect.name) },
      yes: { label: game.i18n.localize("Yes"), icon: "fa-solid fa-trash" },
      no:  { label: game.i18n.localize("No"),  icon: "fa-solid fa-times" }
    });
    if (confirmed) await effect.delete();
  }

  static async #onToggleEffect(event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    if (!effect) return;
    await effect.update({ disabled: !effect.disabled });
  }

  static async #onDispelSpellEffect(event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const ae = this.actor.effects.get(effectId);
    if (!ae) return;
    const { CountermagicDialog } = await import("../../dialogs/countermagic-dialog.mjs");
    await CountermagicDialog.open({ type: "effect-self", ae }, this.actor);
  }

  // ── Active Motivation Campaigns ────────────────────────────────────────
  static async #onAbandonMotivationCampaign(event, target) {
    const defenderId = target.dataset.defenderId;
    if (!defenderId) return;
    const defender = game.actors.get(defenderId);
    if (!defender) return;
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotGM"));
      return;
    }
    await defender.update({
      [`flags.exalted2e.motivationBreaks.${this.actor.id}.status`]: "abandoned"
    });
  }

  static async #onSendItemToChat(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item) await item.sendToChat();
  }

  /**
   * Cycle an ability's flag through: none → favored → caste → none.
   * Keeps data model as two booleans; UI collapses them into one button.
   */
  static async #onCycleAbilityFlag(event, target) {
    const abilKey = target.dataset.ability;
    if (!abilKey || !this.isEditable) return;
    const ab = this.document.system.abilities[abilKey];
    if (!ab) return;
    if (ab.caste) return;

    // none → favored → none. Caste is set by the system, never user-toggleable.
    const newFavored = !ab.favored;

    await this.document.update({
      [`system.abilities.${abilKey}.favored`]: newFavored,
    });
  }

  /**
   * Cycle an attribute's user-facing flag through: none → favored → none.
   * The `caste` flag is auto-managed by ExaltedActor._preUpdate based on the
   * current caste — never user-toggleable. Only `favored` cycles via this
   * handler.
   */
  static async #onCycleAttributeFlag(event, target) {
    const attrKey = target.dataset.attr;
    if (!attrKey) return;
    const attr = this.actor.system.attributes?.[attrKey] ?? { caste: false, favored: false };
    if (attr.caste) return;
    // none → favored → none. Caste is preserved as-is (auto-managed).
    const newFavored = !attr.favored;
    await this.actor.update({
      [`system.attributes.${attrKey}.favored`]: newFavored
    });
  }

  // ── Heart's Blood Forms (Lunar) ──────────────────────────────────────────

  static async #onCreateForm(event, target) {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{
      name: game.i18n.localize("EX2E.HeartsBloodForm"),
      type: "form"
    }]);
    if (item) item.sheet.render(true);
  }

  static async #onSetActiveForm(event, target) {
    const formId = target.value ?? target.dataset.formId ?? "";
    await this.actor.update({ "system.splat.lunar.activeFormId": formId });
  }

  static async #onEditForm(event, target) {
    const formId = target.dataset.formId;
    const form = this.actor.items.get(formId);
    if (form) form.sheet.render(true);
  }

  static async #onDeleteForm(event, target) {
    const formId = target.dataset.formId;
    const form = this.actor.items.get(formId);
    if (form) await form.delete();
  }

  static async #onEndDBT(event, target) {
    const actor = this.actor;
    const activeGifts = actor.items.filter(
      i => i.type === "charm"
        && (i.system?.keywords ?? []).includes("Gift")
        && i.system?.active
    );
    for (const charm of activeGifts) {
      await charm.update({ "system.active": false });
    }
    await actor.update({ "system.splat.lunar.activeFormId": "" });
  }

  static async #onInstallCharm(event, target) {
    const charmId = target.dataset.charmId;
    if (!charmId) return;
    await this.actor.installCharm(charmId);
  }

  static async #onUninstallCharm(event, target) {
    const charmId = target.dataset.charmId;
    if (!charmId) return;
    await this.actor.uninstallCharm(charmId);
  }

  static async #onAddDedicatedSlot(event, target) {
    const sys    = this.actor.system.splat?.alchemical;
    if (!sys) return;
    const locked = !!this.actor.system.purchaseLocked;
    if (locked) {
      const cost = priceAlchemicalCharmSlot("dedicated").xp;
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("EX2E.SlotAddDedicated") },
        content: game.i18n.format("EX2E.SlotAddDedicatedConfirm", { cost }),
      });
      if (!confirmed) return;
      await this.actor.update({
        "system.splat.alchemical.dedicatedSlots": sys.dedicatedSlots + 1,
        "system.experience.value": (this.actor.system.experience?.value ?? 0) - cost
      }, { bypassPurchaseLock: true });
    } else {
      await this.actor.update({ "system.splat.alchemical.dedicatedSlots": sys.dedicatedSlots + 1 });
    }
  }

  static async #onAddGeneralSlot(event, target) {
    const sys    = this.actor.system.splat?.alchemical;
    if (!sys) return;
    const locked = !!this.actor.system.purchaseLocked;
    if (locked) {
      const cost = priceAlchemicalCharmSlot("general").xp;
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("EX2E.SlotAddGeneral") },
        content: game.i18n.format("EX2E.SlotAddGeneralConfirm", { cost }),
      });
      if (!confirmed) return;
      await this.actor.update({
        "system.splat.alchemical.generalSlots": sys.generalSlots + 1,
        "system.experience.value": (this.actor.system.experience?.value ?? 0) - cost
      }, { bypassPurchaseLock: true });
    } else {
      await this.actor.update({ "system.splat.alchemical.generalSlots": sys.generalSlots + 1 });
    }
  }

  static async #onUpgradeSlot(event, target) {
    const sys    = this.actor.system.splat?.alchemical;
    if (!sys || (sys.dedicatedSlots ?? 0) <= 0) return;
    const locked = !!this.actor.system.purchaseLocked;
    if (locked) {
      const cost = priceAlchemicalCharmSlot("upgrade").xp;
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("EX2E.SlotUpgrade") },
        content: game.i18n.format("EX2E.SlotUpgradeConfirm", { cost }),
      });
      if (!confirmed) return;
      await this.actor.update({
        "system.splat.alchemical.dedicatedSlots": sys.dedicatedSlots - 1,
        "system.splat.alchemical.generalSlots":   sys.generalSlots   + 1,
        "system.experience.value": (this.actor.system.experience?.value ?? 0) - cost
      }, { bypassPurchaseLock: true });
    } else {
      await this.actor.update({
        "system.splat.alchemical.dedicatedSlots": sys.dedicatedSlots - 1,
        "system.splat.alchemical.generalSlots":   sys.generalSlots   + 1,
      });
    }
  }

  static async #onCreateSubmodule(event, target) {
    const charmId = target.dataset.charmId;
    const charm   = this.actor.items.get(charmId);
    if (!charm) return;
    await Item.create({
      name:   game.i18n.localize("EX2E.NewSubmodule"),
      type:   "charm",
      system: { isSubmodule: true, parentCharmId: charmId, exaltType: "alchemical" }
    }, { parent: this.actor });
  }

  static async #onNudgeScenePeripheral(event, target) {
    const delta  = parseInt(target.dataset.delta ?? 1);
    const oldVal = this.document.system.scenePeripheral ?? 0;
    const newVal = Math.max(0, oldVal + delta);
    await this.document.update(
      { "system.scenePeripheral": newVal },
      { scenePeripheralBefore: oldVal }
    );
  }

  static async #onEndScene(_event, _target) {
    const oldSp = this.document.system.scenePeripheral ?? 0;
    const newSp = sceneChangeFade(oldSp);
    await this.document.update(
      { "system.scenePeripheral": newSp },
      { scenePeripheralBefore: oldSp }
    );
    const { clearActorForms }       = await import("../../combat/form-charms.mjs");
    await clearActorForms(this.document);
    const { clearSceneCharms }      = await import("../../helpers/charm-deactivation.mjs");
    await clearSceneCharms(this.document);
    const { clearIntimacyAblation } = await import("../../ui/social-scene.mjs");
    await clearIntimacyAblation(this.document);
    const { stepDownAnima }         = await import("../../combat/anima-math.mjs");
    await stepDownAnima(this.document);
  }

  static async #onMorningRest(_event, _target) {
    await this.document.rollMorningRest();
  }

  static async #onRollVirtue(_event, target) {
    const virtue = target.dataset.virtue;
    if (!virtue) return;
    await this.document.rollVirtueCheck(virtue);
  }

  static #onConfigureAnimaColors() {
    AnimaColorDialog.open(this.actor);
  }

  static async #onActivateAnimaPower(event, target) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const sys   = item.system;
    const actor = this.actor;

    if (sys.isGreaterSign) {
      if (sys.active) {
        await _deactivateGreaterSign(actor, item);
      } else {
        await _activateGreaterSign(actor, item);
      }
      return;
    }

    if (sys.active) {
      await item.update({ "system.active": false });
      const msg = game.i18n.format("EX2E.AnimaPowerDeactivated", { name: actor.name, power: item.name });
      ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor }) });
      return;
    }

    const anima = actor.system.anima;
    let moteCost = sys.activationCost.motes;
    let wpCost   = sys.activationCost.willpower;

    if (sys.autoThreshold && _animaLevelSheet(anima) >= _animaLevelSheet(sys.autoThreshold)) {
      moteCost = 0;
      wpCost   = 0;
    } else if (sys.totemicOverride.enabled && anima === "totemic") {
      moteCost = sys.totemicOverride.motes;
      wpCost   = 0;
    } else if (sys.bonfireOverride.enabled && _animaLevelSheet(anima) >= _animaLevelSheet("bonfire")) {
      moteCost = sys.bonfireOverride.motes;
      wpCost   = 0;
    }

    const wpCurrent = actor.system.willpower?.value ?? 0;
    if (wpCost > 0 && wpCurrent < wpCost) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughWillpower"));
      return;
    }

    if (moteCost > 0) {
      const result = await actor.spendMotes(moteCost, "peripheral");
      if (!result) return;
    }

    if (wpCost > 0) {
      await actor.update({ "system.willpower.value": wpCurrent - wpCost });
    }

    await item.update({ "system.active": true });
    const msg = game.i18n.format("EX2E.AnimaPowerActivated", { name: actor.name, power: item.name });
    ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor }) });
  }

  static async #onViewAnimaPower(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description, { secrets: item.isOwner, relativeTo: item }
    );
    await foundry.applications.api.DialogV2.prompt({
      window: { title: item.name },
      content,
      ok: { label: game.i18n.localize("Close") }
    });
  }

  static async #onRollActOfVillainy(_event, _target) {
    const actor = this.actor;
    if (!game.user.isGM) return;

    const virtues = ["compassion", "conviction", "temperance", "valor"].map(k => ({
      key:   k,
      label: EX2E.virtues[k],
      value: actor.system.virtues?.[k]?.value ?? 0
    }));

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/dialog/act-of-villainy-dialog.hbs",
      { virtues }
    );

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.RollActOfVillainy") },
      content,
      ok: {
        label: game.i18n.localize("EX2E.Confirm"),
        callback: (_event, button) => {
          const form = button.form;
          const checkedKeys = ["compassion", "conviction", "temperance", "valor"]
            .filter(k => form.elements[`virtue-${k}`]?.checked);
          if (checkedKeys.length === 0) return null;
          const stunt = parseInt(form.elements["stunt"]?.value) || 0;
          const pool  = checkedKeys.reduce((s, k) => s + (actor.system.virtues?.[k]?.value ?? 0), 0);
          const selectedVirtues = checkedKeys.map(k => ({
            key:   k,
            label: EX2E.virtues[k],
            value: actor.system.virtues?.[k]?.value ?? 0
          }));
          return { pool, stunt, selectedVirtues };
        }
      }
    });

    if (!result) return;
    const { pool, stunt, selectedVirtues } = result;

    const cardContent = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/act-of-villainy-card.hbs",
      {
        actorName: actor.name,
        selectedVirtues,
        stunt,
        pool,
        rolled: false
      }
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: cardContent,
      flags: {
        exalted2e: {
          actOfVillainy: {
            actorId:         actor.id,
            actorName:       actor.name,
            pool,
            stunt,
            selectedVirtues,
            rolled:          false
          }
        }
      }
    });
  }

  static async #onToggleTellHidden(_event, _target) {
    const current = this.actor.system.splat.lunar.tellHidden;
    await this.actor.update({ "system.splat.lunar.tellHidden": !current });
  }

  static async #onCreateDestiny(_event, _target) {
    const { DestinyCreationDialog } = await import("../../dialogs/destiny-creation-dialog.mjs");
    await DestinyCreationDialog.open(this.document);
  }

  static async #onVentResonance(_event, _target) {
    const actor  = this.actor;
    const pool   = actor.system.essence?.value ?? 1;
    const roll   = new ExaltedRoll({
      pool,
      flavor:    game.i18n.localize("EX2E.ResonanceVentRoll"),
      actorName: actor.name,
    });
    const result = await roll.evaluate();
    await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });

    if (result.successes < 1) return;

    const { EruptionAllocationDialog } = await import(
      "../../dialogs/eruption-allocation-dialog.mjs"
    );
    EruptionAllocationDialog.open(actor, result.successes);
  }

  static async #onSanctifyOath(_event, _target) {
    const actor   = this.actor;
    const targets = Array.from(game.user.targets).map(t => t.actor).filter(Boolean);

    if (!targets.length) {
      ui.notifications.warn(game.i18n.localize("EX2E.OathNoTargets"));
      return;
    }

    const description = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.SanctifyOath") },
      content: `<div style="margin-bottom:4px"><label>${game.i18n.localize("EX2E.OathDescription")}</label></div>
                <input name="description" type="text"
                       placeholder="${game.i18n.localize("EX2E.OathDescriptionPlaceholder")}"
                       style="width:100%">`,
      ok: {
        label:    game.i18n.localize("EX2E.SanctifyOath"),
        callback: (_e, btn) => btn.form.elements["description"]?.value?.trim() ?? ""
      }
    });

    if (description === null) return;
    await sanctifyOathBinding(actor, targets, description);
  }

  static async #onSocketHearthstone(_event, target) {
    const artifactId = target.dataset.artifactId;
    const slotIndex  = parseInt(target.dataset.slotIndex);
    const artifact   = this.document.items.get(artifactId);
    if (!artifact) return;

    const socketedIds = new Set();
    for (const item of this.document.items) {
      const stones = item.system?.hearthstones;
      if (Array.isArray(stones)) {
        for (const id of stones) { if (id) socketedIds.add(id); }
      }
    }

    const available = this.document.items.filter(
      i => i.type === "hearthstone" && !socketedIds.has(i.id)
    );
    if (!available.length) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoHearthstonesAvailable"));
      return;
    }

    const chosenId = await foundry.applications.api.DialogV2.prompt({
      window:      { title: game.i18n.localize("EX2E.SelectHearthstone") },
      content:     `<div style="padding:8px"><select name="stoneId" style="width:100%">
        ${available.map(s => `<option value="${s.id}">${s.name} (★${s.system.rating})</option>`).join("")}
      </select></div>`,
      ok:          {
        label:    game.i18n.localize("EX2E.SocketHearthstone"),
        callback: (_ev, btn) => btn.form.elements.stoneId.value
      },
      rejectClose: false
    });
    if (!chosenId) return;

    const stones = foundry.utils.deepClone(artifact.system.hearthstones ?? []);
    stones[slotIndex] = chosenId;
    await artifact.update({ "system.hearthstones": stones });
  }

  static async #onUnsocketHearthstone(_event, target) {
    const artifactId = target.dataset.artifactId;
    const slotIndex  = parseInt(target.dataset.slotIndex);
    const artifact   = this.document.items.get(artifactId);
    if (!artifact) return;

    const stones = foundry.utils.deepClone(artifact.system.hearthstones ?? []);
    stones[slotIndex] = "";
    await artifact.update({ "system.hearthstones": stones });
  }

  static async #onAddCraftingProject(_event, _target) {
    const actor  = this.document;
    const sys    = actor.system;
    const craft  = sys.abilities.craft.value ?? 0;
    const bestSpec = Math.max(0, ...(sys.abilities.craft.specialties ?? []).map(s => s.value));

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.CraftingProjectName")}</label>
        <input type="text" name="name" required placeholder="${game.i18n.localize("EX2E.CraftingProjectNamePlaceholder")}">
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.CraftingProjectSize")}</label>
        <select name="size">
          <option value="small">${game.i18n.localize("EX2E.CraftingSizeSmall")}</option>
          <option value="large">${game.i18n.localize("EX2E.CraftingSizeLarge")}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.CraftingTargetResources")}</label>
        <input type="number" name="targetResources" min="1" max="5" value="1">
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.CraftingIsPerfect")}</label>
        <input type="checkbox" name="isPerfect">
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window:  { title: game.i18n.localize("EX2E.CraftingNewProject") },
      content,
      ok: {
        label:    game.i18n.localize("EX2E.CraftingAddProject"),
        callback: (_ev, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      }
    });
    if (!result) return;

    const targetResources = Math.min(5, Math.max(1, parseInt(result.targetResources, 10) || 1));
    if (exceedsCraftCap(actor, targetResources)) {
      ui.notifications.warn(game.i18n.format("EX2E.CraftingCapWarning", { cap: craft + bestSpec }));
    }

    const projects = foundry.utils.deepClone(sys.craftingProjects ?? []);
    projects.push({
      id:              foundry.utils.randomID(),
      name:            String(result.name || game.i18n.localize("EX2E.CraftingUnnamedProject")),
      size:            result.size === "large" ? "large" : "small",
      targetResources,
      isPerfect:       !!result.isPerfect,
      bonusDice:       0,
      status:          "active"
    });
    await actor.update({ "system.craftingProjects": projects });
  }

  static async #onRollCraftingProject(_event, target) {
    const actor     = this.document;
    const projectId = target.dataset.projectId;
    const project   = (actor.system.craftingProjects ?? []).find(p => p.id === projectId);
    if (!project || project.status !== "active") return;
    await CraftingRollDialog.open(project, actor);
  }

  static async #onDeleteCraftingProject(_event, target) {
    const actor     = this.document;
    const projectId = target.dataset.projectId;
    const projects  = foundry.utils.deepClone(actor.system.craftingProjects ?? []);
    const idx       = projects.findIndex(p => p.id === projectId);
    if (idx < 0) return;
    projects.splice(idx, 1);
    await actor.update({ "system.craftingProjects": projects });
  }

  static async #onAddArtifactProject(_event, _target) {
    const actor = this.document;

    // Determine the highest rating this actor can create; default the pip there.
    let defaultRating = 1;
    for (let i = 5; i >= 1; i--) {
      if (meetsArtifactAbilityReqs(actor, i)) { defaultRating = i; break; }
    }

    const ratingPips = [5,4,3,2,1].map(i => {
      const canMake = meetsArtifactAbilityReqs(actor, i);
      const tooltip = canMake
        ? String(i)
        : (() => {
            const reqs = effectiveArtifactAbilityReqs(actor, i);
            return game.i18n.format("EX2E.ArtifactRatingBlockedTooltip", {
              craft: reqs.craft, lore: reqs.lore, occult: reqs.occult
            });
          })();
      return `<input type="radio" name="rating" id="dlg-rating-${i}" value="${i}"` +
             (i === defaultRating ? " checked" : "") +
             (canMake ? "" : " disabled") +
             `><label for="dlg-rating-${i}" title="${tooltip}"><span class="pip"></span></label>`;
    }).join("");

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.ArtifactProjectName")}</label>
        <input type="text" name="name" required placeholder="${game.i18n.localize("EX2E.ArtifactProjectNamePlaceholder")}">
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.ArtifactRating")}</label>
        <div class="artifact-pip-rating">${ratingPips}</div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("EX2E.ArtifactMaterial")}</label>
        <input type="text" name="material" placeholder="${game.i18n.localize("EX2E.ArtifactMaterialPlaceholder")}">
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window:  { title: game.i18n.localize("EX2E.ArtifactNewProject") },
      content,
      ok: {
        label:    game.i18n.localize("EX2E.ArtifactAddProject"),
        callback: (_ev, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      }
    });
    if (!result) return;

    const rating = Math.min(5, Math.max(1, parseInt(result.rating, 10) || 1));
    const projects = foundry.utils.deepClone(actor.system.artifactProjects ?? []);
    projects.push({
      id:               foundry.utils.randomID(),
      name:             String(result.name || game.i18n.localize("EX2E.ArtifactUnnamedProject")),
      rating,
      material:         String(result.material || ""),
      hasIngredients:   false,
      targetSuccesses:  artifactSuccessTarget(rating),
      currentSuccesses: 0,
      seasonsElapsed:   0,
      status:           "active"
    });
    await actor.update({ "system.artifactProjects": projects });
  }

  static async #onRollArtifactProject(_event, target) {
    const actor     = this.document;
    const projectId = target.dataset.projectId;
    const project   = (actor.system.artifactProjects ?? []).find(p => p.id === projectId);
    if (!project || project.status !== "active") return;
    await ArtifactCraftingDialog.open(project, actor);
  }

  static async #onDeleteArtifactProject(_event, target) {
    const actor     = this.document;
    const projectId = target.dataset.projectId;
    const projects  = foundry.utils.deepClone(actor.system.artifactProjects ?? []);
    const idx       = projects.findIndex(p => p.id === projectId);
    if (idx < 0) return;
    projects.splice(idx, 1);
    await actor.update({ "system.artifactProjects": projects });
  }

  static async #onToggleArtifactIngredients(_event, target) {
    const actor     = this.document;
    const projectId = target.dataset.projectId;
    const projects  = foundry.utils.deepClone(actor.system.artifactProjects ?? []);
    const idx       = projects.findIndex(p => p.id === projectId);
    if (idx < 0) return;
    projects[idx].hasIngredients = !projects[idx].hasIngredients;
    await actor.update({ "system.artifactProjects": projects });
  }

  static #onOpenFamiliarActor(_event, target) {
    const actorId = target.dataset.actorId;
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    actor?.sheet.render(true);
  }

  static #onOpenCharmTree(event, target) {
    const groupKey  = target.dataset.groupKey;
    const actor     = this.actor;
    // Map actor exaltType to dialog exaltType keys
    const rawType   = actor.system.exaltType;
    const exaltType = rawType === 'dragonBlooded' ? 'terrestrial' : rawType;
    const { CharmTreeDialog } = game.exalted2e;
    CharmTreeDialog.open({ actor, exaltType, groupKey });
  }

  static async #onCoverArtifactAttunement(_event, target) {
    const actor  = this.document;
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    await actor.applyAttunementMotes(itemId);
  }

  static async #onPerformProcedure(_event, target) {
    const { rollProcedure } = await import("../../rolls/thaumaturgy.mjs");
    const itemId = target.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (!item) return;
    await rollProcedure(this.document, item);
  }

  static async #onClinchHold(_event, _target) {
    const { applyClinchSubAction } = await import("../rolls/clinch.mjs");
    const actor   = this.document;
    const combat  = game.combat;
    const current = combat?.combatants.find(c => c.actorId === actor.id);
    if (!current) return;
    await applyClinchSubAction(combat, current, "hold");
  }

  static async #onClinchCrush(_event, _target) {
    const { applyClinchSubAction } = await import("../rolls/clinch.mjs");
    const actor   = this.document;
    const combat  = game.combat;
    const current = combat?.combatants.find(c => c.actorId === actor.id);
    if (!current) return;
    await applyClinchSubAction(combat, current, "crush");
  }

  static async #onClinchThrow(_event, _target) {
    const { applyClinchSubAction } = await import("../rolls/clinch.mjs");
    const actor   = this.document;
    const combat  = game.combat;
    const current = combat?.combatants.find(c => c.actorId === actor.id);
    if (!current) return;
    await applyClinchSubAction(combat, current, "throw");
  }

  static async #onClinchRelease(_event, _target) {
    const { applyClinchSubAction } = await import("../rolls/clinch.mjs");
    const actor   = this.document;
    const combat  = game.combat;
    const current = combat?.combatants.find(c => c.actorId === actor.id);
    if (!current) return;
    await applyClinchSubAction(combat, current, "release");
  }

  static async #onApplyActivityFatigue(_event, _target) {
    const actor = this.document;
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.localize("EX2E.ActivityFatigue"),
      img:      "icons/svg/sleep.svg",
      disabled: false,
      transfer: false,
      flags: {
        exalted2e: {
          internalPenalty: { type: "all", value: 1 },
          fatigueType: "activity"
        }
      }
    }]);
  }

  static async #onRollArmorFatigue(_event, _target) {
    const actor = this.document;
    const equippedArmor = [...actor.items]
      .filter(i => i.type === "armor" && i.system.equipped)
      .reduce((best, a) => {
        const v  = Math.abs(a.system.effectiveFatiguePenalty ?? 0);
        const bv = Math.abs(best?.system?.effectiveFatiguePenalty ?? 0);
        return v > bv ? a : best;
      }, null);
    const difficulty = equippedArmor
      ? Math.abs(equippedArmor.system.effectiveFatiguePenalty ?? 0)
      : 0;
    if (!difficulty) return;

    const specialtyDice = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.FatigueRollTitle") },
      content: `<form>
        <div class="form-group">
          <label>${game.i18n.localize("EX2E.FatigueSpecialtyDice")}</label>
          <input type="number" name="specialty" value="0" min="0" max="5" style="width:60px">
        </div>
        <p><em>${game.i18n.format("EX2E.FatigueArmorDifficulty", { difficulty })}</em></p>
      </form>`,
      ok: {
        label: game.i18n.localize("EX2E.Roll"),
        callback: (_ev, button) => Number(button.form?.elements?.specialty?.value ?? 0)
      }
    });
    if (specialtyDice == null) return;

    const staVal = actor.system.attributes?.stamina?.value ?? 0;
    const resVal = actor.system.abilities?.resistance?.value ?? 0;
    const result = await ExaltedRoll.rollPool(actor, {
      pool:     staVal + resVal + specialtyDice,
      flavor:   game.i18n.localize("EX2E.FatigueRollTitle"),
      category: "physical"
    });

    if (result.successes < difficulty) {
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:     game.i18n.localize("EX2E.ArmorFatigue"),
        img:      "icons/equipment/chest/breastplate-layered-steel-grey.webp",
        disabled: false,
        transfer: false,
        flags: {
          exalted2e: {
            internalPenalty: { type: "all", value: 1 },
            fatigueType: "armor"
          }
        }
      }]);
      ui.notifications.warn(
        game.i18n.format("EX2E.FatigueArmorApplied", { difficulty, successes: result.successes })
      );
    } else {
      ui.notifications.info(
        game.i18n.format("EX2E.FatigueArmorResisted", { difficulty, successes: result.successes })
      );
    }
  }

  static async #onAddCripplingInjury() {
    const { DialogV2 } = foundry.applications.api;
    const typeOptions = [
      ["arm-left",  "EX2E.CripplingTypeArmLeft"],
      ["arm-right", "EX2E.CripplingTypeArmRight"],
      ["leg-left",  "EX2E.CripplingTypeLegLeft"],
      ["leg-right", "EX2E.CripplingTypeLegRight"],
      ["eye-left",  "EX2E.CripplingTypeEyeLeft"],
      ["eye-right", "EX2E.CripplingTypeEyeRight"],
      ["other",     "EX2E.CripplingTypeOther"],
    ].map(([v, k]) => `<option value="${v}">${game.i18n.localize(k)}</option>`).join("");

    const content = `<div style="display:flex;flex-direction:column;gap:6px;padding:4px">
      <div class="field-group">
        <label>${game.i18n.localize("EX2E.CripplingInjuryType")}</label>
        <select name="type">${typeOptions}</select>
      </div>
      <div class="field-group">
        <label>${game.i18n.localize("EX2E.CripplingInjuryDesc")}</label>
        <input type="text" name="description" style="width:100%" placeholder="${game.i18n.localize("EX2E.CripplingInjuryDescPlaceholder")}">
      </div>
      <div class="field-group">
        <label>${game.i18n.localize("EX2E.CripplingInjuryPenalty")}</label>
        <input type="number" name="penalty" value="2" min="0" max="10" style="width:60px">
      </div>
    </div>`;

    const result = await DialogV2.prompt({
      window:  { title: game.i18n.localize("EX2E.CripplingInjuryAdd") },
      content,
      ok: { label: game.i18n.localize("EX2E.CripplingInjuryAdd"), icon: "fa-solid fa-plus",
        callback: (_event, btn) => {
          const form = btn.form ?? btn.closest("form") ?? btn.closest(".application").querySelector("form");
          return form ? {
            type:        form.querySelector("[name=type]")?.value ?? "other",
            description: form.querySelector("[name=description]")?.value ?? "",
            penalty:     parseInt(form.querySelector("[name=penalty]")?.value ?? "2", 10)
          } : null;
        }
      }
    });
    if (!result) return;

    const current = this.actor.system.cripplingInjuries ?? [];
    await this.actor.update({ "system.cripplingInjuries": [...current, result] });
  }

  static async #onDeleteCripplingInjury(_event, target) {
    const idx = parseInt(target.dataset.index ?? "-1", 10);
    if (isNaN(idx) || idx < 0) return;
    const current = this.actor.system.cripplingInjuries ?? [];
    const updated = current.filter((_, i) => i !== idx);
    await this.actor.update({ "system.cripplingInjuries": updated });
  }

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop(event);

    const item = await Item.fromDropData(data);
    if (!item) return;

    const sourceActor = item.parent instanceof Actor ? item.parent : null;

    // No source actor (compendium / world item) or same actor: Foundry default
    if (!sourceActor || sourceActor.uuid === this.actor.uuid) return super._onDrop(event);

    const TRANSFERABLE = new Set(["weapon", "armor", "background", "meritflaw"]);
    if (!TRANSFERABLE.has(item.type)) {
      ui.notifications.warn(game.i18n.localize("EX2E.ItemNotTransferable"));
      return false;
    }

    if (!sourceActor.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("EX2E.ItemTransferNoPermission"));
      return false;
    }

    const itemData = item.toObject();
    delete itemData._id;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!created) return false;

    await item.delete();
    return created;
  }
}
