import { editImageAction } from "../_edit-image.mjs";
import { ex2eCan } from "../../helpers/permissions.mjs";
import { canEquipToSlot } from "../../helpers/equip-slots.mjs";
import { GRACE_CASTE_ABILITIES, GRACE_VIRTUE_MAP } from "../../data/actor/fairfolk-data.mjs";
import { dedupStackableCharms, buildPurchaseLogRows, buildEffectsData } from "../../helpers/character-sheet-helpers.mjs";
import { buildXpCostRows } from "../../helpers/xp-cost-table.mjs";
import { resolveXpCosts } from "../../helpers/xp-cost-defaults.mjs";
import { evaluateCharmPrereqs } from "../../helpers/charm-prereqs.mjs";
import { evalMaxPurchases } from "../../helpers/charm-tree-builder.mjs";
import { buildComboPreviewRows } from "../../helpers/combo-display.mjs";

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ActorSheetV2: sheets.ActorSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

const GRACE_ORDER = ["cup", "ring", "staff", "sword", "heart"];

// Ability groupings by Grace caste, in display order
const GRACE_CASTES = [
  { key: "cup",   labelKey: "EX2E.GraceCasteDiplomat",    abilities: GRACE_CASTE_ABILITIES.cup   },
  { key: "ring",  labelKey: "EX2E.GraceCasteEntertainer", abilities: GRACE_CASTE_ABILITIES.ring  },
  { key: "sword", labelKey: "EX2E.GraceCasteWarrior",     abilities: GRACE_CASTE_ABILITIES.sword },
  { key: "staff", labelKey: "EX2E.GraceCasteWorker",      abilities: GRACE_CASTE_ABILITIES.staff },
  { key: "heart", labelKey: "EX2E.GraceCasteCasteless",   abilities: GRACE_CASTE_ABILITIES.heart }
];

export class FairFolkSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "actor", "fairfolk"],
    position: { width: 780, height: 760 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions: {
      onEditImage:        editImageAction,
      applyDamage:        FairFolkSheet.#onApplyDamage,
      healDamage:         FairFolkSheet.#onHealDamage,
      createItem:         FairFolkSheet.#onCreateItem,
      editItem:           FairFolkSheet.#onEditItem,
      deleteItem:         FairFolkSheet.#onDeleteItem,
      activateCharm:      FairFolkSheet.#onActivateCharm,
      addSpecialty:       FairFolkSheet.#onAddSpecialty,
      deleteSpecialty:    FairFolkSheet.#onDeleteSpecialty,
      removeSpecialty:    FairFolkSheet.#onDeleteSpecialty,
      cycleAbilityFlag:   FairFolkSheet.#onCycleAbilityFlag,
      togglePurchaseMode: FairFolkSheet.#onTogglePurchaseMode,
      editPurchaseEntry:    FairFolkSheet.#onEditPurchaseEntry,
      deletePurchaseEntry:  FairFolkSheet.#onDeletePurchaseEntry,
      completeTraining:     FairFolkSheet.#onCompleteTraining,
      openCharmTree:            FairFolkSheet.#onOpenCharmTree,
      sendItemToChat:           FairFolkSheet.#onSendItemToChat,
      toggleMultiPurchaseGroup: FairFolkSheet.#onToggleMultiPurchaseGroup,
      activateCombo:        FairFolkSheet.#onActivateCombo,
      startTraining:        FairFolkSheet.#onStartTraining,
      toggleEquip:          FairFolkSheet.#onToggleEquip,
      toggleAblationDot:    FairFolkSheet.#onToggleAblationDot,
      createEffect:         FairFolkSheet.#onCreateEffect,
      editEffect:           FairFolkSheet.#onEditEffect,
      deleteEffect:         FairFolkSheet.#onDeleteEffect,
      toggleEffect:         FairFolkSheet.#onToggleEffect,
      dispelSpellEffect:    FairFolkSheet.#onDispelSpellEffect
    }
  };

  tabGroups = { sheet: "tabMain" };

  #expandedGroups = new Set();

  get title() { return this.actor.name; }

  static PARTS = {
    header:     { template: "systems/exalted2e/templates/actor/fairfolk/header.hbs" },
    tabs:       { classes: ["tabs-right"], template: "systems/exalted2e/templates/actor/fairfolk/tabs.hbs" },
    tabMain:        { template: "systems/exalted2e/templates/actor/fairfolk/tab-main.hbs",       scrollable: [""] },
    tabCombat:      { template: "systems/exalted2e/templates/actor/fairfolk/tab-combat.hbs",     scrollable: [""] },
    tabCharms:      { template: "systems/exalted2e/templates/actor/fairfolk/tab-charms.hbs",     scrollable: [""] },
    tabInventory:   { template: "systems/exalted2e/templates/actor/fairfolk/tab-inventory.hbs",   scrollable: [""] },
    tabEffects:     { template: "systems/exalted2e/templates/actor/character/tab-effects.hbs",    scrollable: [""] },
    tabExperience:  { template: "systems/exalted2e/templates/actor/character/tab-experience.hbs", scrollable: [""] },
    tabBiography:   { template: "systems/exalted2e/templates/actor/fairfolk/tab-biography.hbs",   scrollable: [""] }
  };

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.partId = partId;
    if (partId.startsWith("tab")) {
      context.cssClass = this.tabGroups.sheet === partId ? "active" : "";
    }
    return context;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.document;
    const sys     = actor.system;

    const fairFolkRankChoices = [
      { value: "",               label: "—" },
      { value: "noble",          label: game.i18n.localize("EX2E.FairFolkRankNoble") },
      { value: "heroicCommoner", label: game.i18n.localize("EX2E.FairFolkRankHeroicCommoner") },
      { value: "commoner",       label: game.i18n.localize("EX2E.FairFolkRankCommoner") }
    ];

    const fairFolkCasteChoices = [
      { value: "",      label: "—" },
      { value: "cup",   label: game.i18n.localize("EX2E.GraceCasteDiplomat") },
      { value: "ring",  label: game.i18n.localize("EX2E.GraceCasteEntertainer") },
      { value: "sword", label: game.i18n.localize("EX2E.GraceCasteWarrior") },
      { value: "staff", label: game.i18n.localize("EX2E.GraceCasteWorker") }
    ];

    const rankKeyToLabel     = Object.fromEntries(fairFolkRankChoices.map(r => [r.value, r.label]));
    const casteKeyToLabel    = Object.fromEntries(fairFolkCasteChoices.map(c => [c.value, c.label]));
    const isNoble            = sys.rank === "noble";
    const activeRankLabel    = rankKeyToLabel[sys.rank]           ?? "—";
    const activeCasteLabel   = casteKeyToLabel[sys.caste]         ?? "—";
    const shadowedCasteLabel = casteKeyToLabel[sys.shadowedCaste] ?? "—";

    const tabs = {
      tabMain:       { id: "tabMain",       group: "sheet", icon: "fa-solid fa-user",             label: game.i18n.localize("EX2E.TabMain"),       cssClass: this.tabGroups.sheet === "tabMain"       ? "active" : "" },
      tabCombat:     { id: "tabCombat",     group: "sheet", icon: "fa-solid fa-shield-halved",    label: game.i18n.localize("EX2E.TabCombat"),     cssClass: this.tabGroups.sheet === "tabCombat"     ? "active" : "" },
      tabCharms:     { id: "tabCharms",     group: "sheet", icon: "fa-solid fa-star",             label: game.i18n.localize("EX2E.TabCharms"),     cssClass: this.tabGroups.sheet === "tabCharms"     ? "active" : "" },
      tabInventory:  { id: "tabInventory",  group: "sheet", icon: "fa-solid fa-suitcase",         label: game.i18n.localize("EX2E.TabInventory"),  cssClass: this.tabGroups.sheet === "tabInventory"  ? "active" : "" },
      tabBiography:  { id: "tabBiography",  group: "sheet", icon: "fa-solid fa-book",             label: game.i18n.localize("EX2E.TabBiography"),  cssClass: this.tabGroups.sheet === "tabBiography"  ? "active" : "" },
      tabExperience: { id: "tabExperience", group: "sheet", icon: "fa-solid fa-graduation-cap",   label: game.i18n.localize("EX2E.TabExperience"), cssClass: this.tabGroups.sheet === "tabExperience" ? "active" : "" },
      tabEffects:    { id: "tabEffects",    group: "sheet", icon: "fa-solid fa-wand-sparkles",    label: game.i18n.localize("EX2E.TabEffects"),    cssClass: this.tabGroups.sheet === "tabEffects"    ? "active" : "" }
    };

    // Build abilities rows per grace caste (for tab-main)
    const graceCasteRows = GRACE_CASTES.map(caste => ({
      key:      caste.key,
      label:    game.i18n.localize(caste.labelKey),
      graceKey: `EX2E.Grace${caste.key.charAt(0).toUpperCase() + caste.key.slice(1)}`,
      abilities: caste.abilities.map(abilKey => {
        const ab    = sys.abilities[abilKey] ?? { value: 0, caste: false, specialties: [] };
        const label = game.i18n.localize(`EX2E.Ability${abilKey.charAt(0).toUpperCase() + abilKey.slice(1)}`);
        return { key: abilKey, label, value: ab.value, caste: ab.caste, specialties: ab.specialties ?? [], fieldBase: `system.abilities.${abilKey}` };
      })
    }));

    // Grace + virtue pairs for tab-traits
    const gracesVirtues = ["cup", "ring", "staff", "sword"].map(gk => {
      const vk = GRACE_VIRTUE_MAP[gk];
      return {
        graceKey:   gk,
        virtueKey:  vk,
        grace:      sys.graces[gk],
        virtue:     sys.virtues[vk],
        graceLabel: game.i18n.localize(`EX2E.Grace${gk.charAt(0).toUpperCase() + gk.slice(1)}`),
        virtueLabel: game.i18n.localize(`EX2E.Virtue${vk.charAt(0).toUpperCase() + vk.slice(1)}`)
      };
    });

    // Flat list of abilities that have at least one specialty (for the 6th specialties column)
    const seenKeys = new Set();
    const specialtiesSection = graceCasteRows
      .flatMap(caste => caste.abilities)
      .filter(ab => {
        if (seenKeys.has(ab.key)) return false;
        seenKeys.add(ab.key);
        return (ab.specialties?.length ?? 0) > 0;
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    // Charm context — grouped by grace with full prereq/stack/training metadata
    const charms = actor.items.filter(i => i.type === "charm").sort((a, b) => a.name.localeCompare(b.name));

    const charmPrereqs = {};
    for (const c of charms) {
      const report  = evaluateCharmPrereqs(c, actor);
      const missing = report.filter(r => !r.satisfied);
      charmPrereqs[c.id] = { has: report.length > 0, met: missing.length === 0, missing: missing.map(m => m.label).filter(Boolean).join("; ") };
    }

    const { stackCounts, stackHidden } = dedupStackableCharms(charms);

    const isGroupable = c =>
      (c.system?.soakBonus?.enabled  && (c.system?.soakBonus?.options?.length  ?? 0) > 0) ||
      (c.system?.healthGrant?.enabled && (c.system?.healthGrant?.options?.length ?? 0) > 0);

    const groupableUids = new Set(
      charms.filter(isGroupable).filter(c => c.system?.ability).map(c => c.system?.charmUid).filter(Boolean)
    );

    const multiPurchaseGroupsByAbility = new Map();
    for (const uid of groupableUids) {
      const instances = charms.filter(c => c.system?.charmUid === uid);
      if (!instances.length) continue;
      const first   = instances[0];
      const ability = first.system?.ability ?? "";

      const variantCounts = new Map();
      const instanceData  = instances.map(item => {
        const sb = item.system?.soakBonus;
        const hg = item.system?.healthGrant;
        let variantLabel = "";
        if ((sb?.options?.length ?? 0) > 0) {
          const vi = Math.min(Math.max(0, sb.selectedOption ?? 0), sb.options.length - 1);
          variantLabel = sb.options[vi]?.label ?? "";
        } else if ((hg?.options?.length ?? 0) > 0) {
          const vi = Math.min(Math.max(0, hg.selectedOption ?? 0), hg.options.length - 1);
          variantLabel = hg.options[vi]?.label ?? "";
        }
        if (variantLabel) variantCounts.set(variantLabel, (variantCounts.get(variantLabel) ?? 0) + 1);
        return { item, variantLabel };
      });

      const summary  = [...variantCounts.entries()].map(([label, count]) => count > 1 ? `${label} ×${count}` : label).join(", ");
      const maxN     = evalMaxPurchases(first.system?.maxPurchases ?? '1', actor);
      const pipData  = maxN > 1 ? { current: instances.length, max: maxN } : null;
      const group    = { charmUid: uid, name: first.name, img: first.img, ability, summary, pipData,
        isExpanded: this.#expandedGroups.has(uid), instances: instanceData };

      if (!multiPurchaseGroupsByAbility.has(ability)) multiPurchaseGroupsByAbility.set(ability, []);
      multiPurchaseGroupsByAbility.get(ability).push(group);
    }

    const graceLabels = {
      cup:   game.i18n.localize("EX2E.GraceCup"),
      ring:  game.i18n.localize("EX2E.GraceRing"),
      staff: game.i18n.localize("EX2E.GraceStaff"),
      sword: game.i18n.localize("EX2E.GraceSword"),
      heart: game.i18n.localize("EX2E.GraceHeart")
    };
    const labelForGrace = (key) => graceLabels[key] ?? (key || game.i18n.localize("EX2E.Uncategorized"));

    const buckets = new Map();
    for (const c of charms) {
      if (c.system?.isSubmodule) continue;
      if (stackHidden.has(c.id)) continue;
      if (groupableUids.has(c.system?.charmUid)) continue;
      const k = c.system?.ability ?? "";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(c);
    }
    const charmGroups = [...buckets.entries()]
      .map(([key, list]) => ({ key, label: labelForGrace(key), charms: list, multiPurchaseGroups: multiPurchaseGroupsByAbility.get(key) ?? [] }));
    for (const [ability, mpGroups] of multiPurchaseGroupsByAbility) {
      if (!charmGroups.some(g => g.key === ability)) {
        charmGroups.push({ key: ability, label: labelForGrace(ability), charms: [], multiPurchaseGroups: mpGroups });
      }
    }
    charmGroups.sort((a, b) => {
      const ai = GRACE_ORDER.indexOf(a.key), bi = GRACE_ORDER.indexOf(b.key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.label.localeCompare(b.label);
    });

    const submodulesByParent = {};
    for (const item of charms) {
      if (!item.system.isSubmodule) continue;
      const pid = item.system.parentCharmId || "__orphan__";
      (submodulesByParent[pid] ??= []).push(item);
    }

    const trainingCharmIds = Object.fromEntries(
      (sys.trainingLedger ?? []).map(e => [e.charmId, true])
    );
    const trainableCharmIds = Object.fromEntries(
      actor.items
        .filter(i => i.type === "charm" && (i.system.keywords ?? []).includes("Training") && !trainingCharmIds[i.id])
        .map(i => [i.id, true])
    );

    // ── Biography tab context ────────────────────────────────────────────────
    const intimacies  = actor.items.filter(i => i.type === "intimacy")   .sort((a, b) => a.name.localeCompare(b.name));
    const conviction  = sys.virtues?.conviction?.value ?? 1;
    for (const int of intimacies) {
      const dmg = int.system?.ablationDamage ?? 0;
      int.ablationDots = Array.from({ length: conviction }, (_, i) => ({
        index: i, filled: i < dmg
      }));
    }

    // ── Inventory tab context ────────────────────────────────────────────────
    const weapons     = actor.items.filter(i => i.type === "weapon")     .sort((a, b) => a.name.localeCompare(b.name));
    const armors      = actor.items.filter(i => i.type === "armor")      .sort((a, b) => a.name.localeCompare(b.name));
    const backgrounds = actor.items.filter(i => i.type === "background") .sort((a, b) => a.name.localeCompare(b.name));
    const meritflaws  = actor.items.filter(i => i.type === "meritflaw")  .sort((a, b) => a.name.localeCompare(b.name));
    const equipments  = actor.items.filter(i => i.type === "equipment")  .sort((a, b) => a.name.localeCompare(b.name));
    const hearthstones = actor.items.filter(i => i.type === "hearthstone").sort((a, b) => a.name.localeCompare(b.name));
    const manses      = actor.items.filter(i => i.type === "manse")      .sort((a, b) => a.name.localeCompare(b.name));

    const combosRaw = actor.items.filter(i => i.type === "combo").sort((a, b) => a.name.localeCompare(b.name));
    const byUid = new Map();
    for (const c of charms) { const uid = c.system?.charmUid; if (uid) byUid.set(uid, c); }
    const combos = buildComboPreviewRows(combosRaw, byUid);

    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    const TextEditor = foundry.applications.ux.TextEditor.implementation;

    // ── Experience tab context ───────────────────────────────────────────────
    const rawLog     = sys.purchaseLog ?? [];
    const totalEarned = Number(sys.experience?.total ?? 0);
    const purchaseLogRows = buildPurchaseLogRows(rawLog, totalEarned);
    const canEditXp = ex2eCan("purchaseMode");
    const xpCosts   = resolveXpCosts(game.settings.get("exalted2e", "xpCosts") ?? {});
    const xpCostRows = buildXpCostRows("fairfolk", xpCosts);
    const trainingEntries = (sys.trainingLedger ?? []).map((e, i) => ({
      ...e,
      index:    i,
      dateText: e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"
    }));

    return {
      ...context,
      actor, system: sys,
      tabs,
      graceCasteRows,
      gracesVirtues,
      specialtiesSection,
      graceOrder: GRACE_ORDER,
      charms,
      charmGroups,
      charmPrereqs,
      stackCounts,
      submodulesByParent,
      trainingCharmIds,
      trainableCharmIds,
      combos,
      fairFolkRankChoices,
      fairFolkCasteChoices,
      isNoble,
      activeRankLabel,
      activeCasteLabel,
      shadowedCasteLabel,
      isEditable: this.isEditable,
      canEditXp,
      purchaseLogRows,
      xpCostRows,
      trainingEntries,
      effects: buildEffectsData(actor.effects, game.exalted2e.EX2E.durations, k => game.i18n.localize(k)),
      intimacies,
      useIntimacyIntensity: game.settings.get("exalted2e", "useIntimacyIntensity"),
      weapons, armors, backgrounds, meritflaws, equipments, hearthstones, manses,
      enrichedBiography: await TextEditor.enrichHTML(sys.biography ?? "", enrichOpts),
      enrichedNotes:     await TextEditor.enrichHTML(sys.notes     ?? "", enrichOpts)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (ex2eCan("purchaseMode")) {
      const header   = this.element.querySelector(".window-header");
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

    // Dot-click handler for Grace, Virtue, and Essence ratings
    this.element.querySelectorAll(".dot-rating .dot").forEach(dot => {
      dot.addEventListener("click", ev => {
        if (!this.isEditable) return;
        const track = ev.currentTarget.closest(".dot-rating");
        const name  = track?.dataset.name;
        const val   = parseInt(ev.currentTarget.dataset.value);
        if (name) this.document.update({ [name]: val });
      });
    });
  }

  static async #onApplyDamage(event, target) {
    await this.document.applyDamage(parseInt(target.dataset.amount ?? 1), target.dataset.damageType ?? "lethal");
  }

  static async #onHealDamage(event, target) {
    await this.document.healDamage(parseInt(target.dataset.amount ?? 1));
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type ?? "charm";
    await Item.create({ name: `New ${type}`, type }, { parent: this.document });
  }

  static async #onEditItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet?.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) await item.delete();
  }

  static async #onActivateCharm(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item?.type === "charm") await item.activateCharm();
  }

  static async #onAddSpecialty(event, target) {
    const { AddSpecialtyDialog } = await import("../../dialogs/add-specialty-dialog.mjs");

    const abilities = Object.values(GRACE_CASTE_ABILITIES).flat().map(k => ({
      value: k,
      label: game.i18n.localize(`EX2E.Ability${k.charAt(0).toUpperCase()}${k.slice(1)}`)
    })).sort((a, b) => a.label.localeCompare(b.label));

    const result = await AddSpecialtyDialog.prompt({ abilities });
    if (!result) return;

    const specialties = foundry.utils.deepClone(
      this.document.system.abilities[result.ability]?.specialties ?? []
    );
    specialties.push({ name: result.name, value: 1 });
    await this.document.update({ [`system.abilities.${result.ability}.specialties`]: specialties });
  }

  static async #onDeleteSpecialty(event, target) {
    const abilKey = target.closest("[data-ability]")?.dataset.ability;
    const idx     = parseInt(target.dataset.index);
    if (!abilKey || isNaN(idx)) return;
    const specs = foundry.utils.deepClone(this.document.system.abilities[abilKey]?.specialties ?? []);
    specs.splice(idx, 1);
    await this.document.update({ [`system.abilities.${abilKey}.specialties`]: specs });
  }

  static async #onCycleAbilityFlag(event, target) {
    const abilKey = target.dataset.ability;
    if (!abilKey) return;
    const current = this.document.system.abilities[abilKey]?.caste ?? false;
    await this.document.update({ [`system.abilities.${abilKey}.caste`]: !current });
  }

  static async #onTogglePurchaseMode() {
    if (!ex2eCan("purchaseMode")) return;
    await this.document.update({ "system.purchaseLocked": !this.document.system.purchaseLocked });
  }

  static async #onEditPurchaseEntry(event, target) {
    if (!ex2eCan("purchaseMode")) return;
    const idx = parseInt(target.dataset.index, 10);
    if (!Number.isFinite(idx)) return;
    const log   = foundry.utils.deepClone(this.document.system.purchaseLog ?? []);
    const entry = log[idx];
    if (!entry) return;
    const { PurchaseConfirmDialog } = await import("../../dialogs/purchase-confirm-dialog.mjs");
    const result = await PurchaseConfirmDialog.prompt({
      actor:        this.document,
      change:       { traitLabel: entry.traitLabel, oldValue: entry.oldValue, newValue: entry.newValue },
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
    const log   = foundry.utils.deepClone(this.document.system.purchaseLog ?? []);
    const entry = log[idx];
    if (!entry) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize("EX2E.Delete") },
      content: `<p>${game.i18n.format("EX2E.PurchaseLogDeleteConfirm", { xp: entry.xpCost })}</p>`,
      yes: { label: game.i18n.localize("EX2E.Delete"), icon: "fa-solid fa-trash" },
      no:  { label: game.i18n.localize("Cancel"),      icon: "fa-solid fa-xmark" }
    });
    if (!confirmed) return;
    log.splice(idx, 1);
    await this.document.update({
      "system.purchaseLog":      log,
      "system.experience.value": (this.document.system.experience.value ?? 0) + (Number(entry.xpCost) || 0)
    });
  }

  static async #onCompleteTraining(_event, target) {
    if (!game.user.isGM) return;
    const actor  = this.document;
    const idx    = parseInt(target.dataset.trainingIndex);
    if (isNaN(idx)) return;
    const ledger = foundry.utils.deepClone(actor.system.trainingLedger ?? []);
    const entry  = ledger[idx];
    if (!entry) return;
    ledger.splice(idx, 1);
    await actor.update({ "system.trainingLedger": null });
    await actor.update({ "system.trainingLedger": ledger });
    await ChatMessage.create({
      content: `<p>${game.i18n.format("EX2E.TrainingCompleted", { actor: actor.name, charm: entry.charmName })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  static #onOpenCharmTree(event, target) {
    const groupKey = target.dataset.groupKey;
    const { CharmTreeDialog } = game.exalted2e;
    CharmTreeDialog.open({ actor: this.actor, exaltType: 'fairfolk', groupKey });
  }

  static async #onSendItemToChat(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item) await item.sendToChat();
  }

  static #onToggleMultiPurchaseGroup(_event, target) {
    const uid = target.dataset.charmUid;
    if (!uid) return;
    /** @type {FairFolkSheet} */ const self = (this);
    if (self.#expandedGroups.has(uid)) self.#expandedGroups.delete(uid);
    else self.#expandedGroups.add(uid);
    self.render({ force: true });
  }

  static async #onActivateCombo(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item?.type === "combo") await item.activateCombo();
  }

  static async #onCreateEffect(_event, _target) {
    const created = await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.localize("EX2E.NewEffect"),
      img:      "icons/svg/aura.svg",
      disabled: true
    }]);
    created[0]?.sheet?.render({ force: true });
  }

  static async #onEditEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    this.document.effects.get(effectId)?.sheet?.render({ force: true });
  }

  static async #onDeleteEffect(_event, target) {
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

  static async #onToggleEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    if (!effect) return;
    await effect.update({ disabled: !effect.disabled });
  }

  static async #onDispelSpellEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const ae = this.actor.effects.get(effectId);
    if (!ae) return;
    const { CountermagicDialog } = await import("../../dialogs/countermagic-dialog.mjs");
    await CountermagicDialog.open({ type: "effect-self", ae }, this.actor);
  }

  static async #onToggleAblationDot(_event, target) {
    const itemId   = target.dataset.itemId;
    const dotIndex = parseInt(target.dataset.dotIndex, 10);
    const item     = this.document.items.get(itemId);
    if (!item) return;
    const current  = item.system?.ablationDamage ?? 0;
    const newValue = dotIndex < current ? dotIndex : dotIndex + 1;
    await item.update({ "system.ablationDamage": newValue });
  }

  static async #onToggleEquip(_event, target) {
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

  static async #onStartTraining(_event, target) {
    const actor  = this.document;
    const itemId = target.dataset.itemId;
    const charm  = actor.items.get(itemId);
    if (!charm) return;

    const alreadyTraining = (actor.system.trainingLedger ?? []).some(e => e.charmId === charm.id);
    if (alreadyTraining) return;

    const { computeXpCost } = await import("../../helpers/xp-costs.mjs");
    const xp = computeXpCost(actor, { kind: "item", item: charm }).xp ?? 0;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.localize("EX2E.TrainingStartTitle") },
      content: `<p>${game.i18n.format("EX2E.TrainingStartBody", { name: charm.name, xp })}</p>`,
      yes: { label: game.i18n.localize("EX2E.TrainingConfirm") },
      no:  { label: game.i18n.localize("EX2E.Cancel") },
    });
    if (!confirmed) return;

    const currentXp = Number(actor.system.experience?.value) || 0;
    await actor.update({ "system.experience.value": currentXp - xp });

    const ledger = foundry.utils.deepClone(actor.system.trainingLedger ?? []);
    ledger.push({ charmId: charm.id, charmName: charm.name, img: charm.img, xpCost: xp, startDate: Date.now() });
    await actor.update({ "system.trainingLedger": null });
    await actor.update({ "system.trainingLedger": ledger });

    await ChatMessage.create({
      content: `<p>${game.i18n.format("EX2E.TrainingStarted", { actor: actor.name, charm: charm.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}
