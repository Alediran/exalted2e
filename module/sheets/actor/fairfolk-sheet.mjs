import { editImageAction } from "../_edit-image.mjs";
import { ex2eCan } from "../../helpers/permissions.mjs";
import { GRACE_CASTE_ABILITIES, GRACE_VIRTUE_MAP } from "../../data/actor/fairfolk-data.mjs";
import { buildPurchaseLogRows } from "../../helpers/character-sheet-helpers.mjs";
import { buildXpCostRows } from "../../helpers/xp-cost-table.mjs";
import { resolveXpCosts } from "../../helpers/xp-cost-defaults.mjs";

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
      editPurchaseEntry:  FairFolkSheet.#onEditPurchaseEntry,
      deletePurchaseEntry:FairFolkSheet.#onDeletePurchaseEntry,
      completeTraining:   FairFolkSheet.#onCompleteTraining
    }
  };

  tabGroups = { sheet: "tabMain" };

  get title() { return this.actor.name; }

  static PARTS = {
    header:     { template: "systems/exalted2e/templates/actor/fairfolk/header.hbs" },
    tabs:       { classes: ["tabs-right"], template: "systems/exalted2e/templates/actor/fairfolk/tabs.hbs" },
    tabMain:    { template: "systems/exalted2e/templates/actor/fairfolk/tab-main.hbs",   scrollable: [".sheet-body"] },
    tabCombat:      { template: "systems/exalted2e/templates/actor/fairfolk/tab-combat.hbs",     scrollable: [".sheet-body"] },
    tabCharms:      { template: "systems/exalted2e/templates/actor/fairfolk/tab-charms.hbs",     scrollable: [".sheet-body"] },
    tabExperience:  { template: "systems/exalted2e/templates/actor/character/tab-experience.hbs", scrollable: [".sheet-body"] },
    tabNotes:       { template: "systems/exalted2e/templates/actor/fairfolk/tab-notes.hbs",      scrollable: [".sheet-body"] }
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
      { value: "staff", label: game.i18n.localize("EX2E.GraceCasteWorker") },
      { value: "heart", label: game.i18n.localize("EX2E.GraceCasteCasteless") }
    ];

    const rankKeyToLabel     = Object.fromEntries(fairFolkRankChoices.map(r => [r.value, r.label]));
    const casteKeyToLabel    = Object.fromEntries(fairFolkCasteChoices.map(c => [c.value, c.label]));
    const isNoble            = sys.rank === "noble";
    const activeRankLabel    = rankKeyToLabel[sys.rank]           ?? "—";
    const activeCasteLabel   = casteKeyToLabel[sys.caste]         ?? "—";
    const shadowedCasteLabel = casteKeyToLabel[sys.shadowedCaste] ?? "—";

    const tabs = {
      tabMain:   { id: "tabMain",   group: "sheet", icon: "fa-solid fa-user",          label: game.i18n.localize("EX2E.TabMain"),   cssClass: this.tabGroups.sheet === "tabMain"   ? "active" : "" },
      tabCombat:     { id: "tabCombat",     group: "sheet", icon: "fa-solid fa-shield-halved",    label: game.i18n.localize("EX2E.TabCombat"),      cssClass: this.tabGroups.sheet === "tabCombat"     ? "active" : "" },
      tabCharms:     { id: "tabCharms",     group: "sheet", icon: "fa-solid fa-star",             label: game.i18n.localize("EX2E.TabCharms"),      cssClass: this.tabGroups.sheet === "tabCharms"     ? "active" : "" },
      tabExperience: { id: "tabExperience", group: "sheet", icon: "fa-solid fa-graduation-cap",   label: game.i18n.localize("EX2E.TabExperience"),  cssClass: this.tabGroups.sheet === "tabExperience" ? "active" : "" },
      tabNotes:      { id: "tabNotes",      group: "sheet", icon: "fa-solid fa-book",             label: game.i18n.localize("EX2E.TabNotes"),       cssClass: this.tabGroups.sheet === "tabNotes"      ? "active" : "" }
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

    // Charm list grouped by grace
    const allCharms = actor.items.filter(i => i.type === "charm").sort((a, b) => a.name.localeCompare(b.name));
    const charmsByGrace = {};
    for (const g of GRACE_ORDER) charmsByGrace[g] = allCharms.filter(c => c.system.ability === g);
    const charmsOther = allCharms.filter(c => !GRACE_ORDER.includes(c.system.ability));

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
      charmsByGrace, charmsOther,
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
}
