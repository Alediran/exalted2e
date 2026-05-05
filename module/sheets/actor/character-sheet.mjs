import { EX2E }          from "../../config.mjs";
import { ExaltedRoll }   from "../../rolls/exalted-roll.mjs";
import { evaluateCharmPrereqs } from "../../helpers/charm-prereqs.mjs";
import { ex2eCan }       from "../../helpers/permissions.mjs";
import { buildXpCostRows } from "../../helpers/xp-cost-table.mjs";
import { computeSpellCastButtonState } from "../../ui/spell-cast-button.mjs";
import { resolveXpCosts }  from "../../helpers/xp-cost-defaults.mjs";
import { priceAlchemicalCharmSlot } from "../../helpers/xp-costs.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { sceneChangeFade } from "../../combat/anima-fade.mjs";
import { AnimaColorDialog } from "../../dialogs/anima-color-dialog.mjs";
import { sanctifyOathBinding } from "../../helpers/oath.mjs";

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

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ActorSheetV2: sheets.ActorSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

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
      abandonMotivationCampaign: CharacterSheet.#onAbandonMotivationCampaign,
      cycleAttributeFlag:  CharacterSheet.#onCycleAttributeFlag,
      createForm:          CharacterSheet.#onCreateForm,
      setActiveForm:       CharacterSheet.#onSetActiveForm,
      editForm:            CharacterSheet.#onEditForm,
      deleteForm:          CharacterSheet.#onDeleteForm,
      endDBT:              CharacterSheet.#onEndDBT,
      nudgeScenePeripheral: CharacterSheet.#onNudgeScenePeripheral,
      endScene:             CharacterSheet.#onEndScene,
      installCharm:        CharacterSheet.#onInstallCharm,
      uninstallCharm:      CharacterSheet.#onUninstallCharm,
      addDedicatedSlot:    CharacterSheet.#onAddDedicatedSlot,
      addGeneralSlot:      CharacterSheet.#onAddGeneralSlot,
      upgradeSlot:         CharacterSheet.#onUpgradeSlot,
      createSubmodule:     CharacterSheet.#onCreateSubmodule,
      editImage:           editImageAction,
      configureAnimaColors: CharacterSheet.#onConfigureAnimaColors,
      activateAnimaPower:  CharacterSheet.#onActivateAnimaPower,
      viewAnimaPower:      CharacterSheet.#onViewAnimaPower,
      rollActOfVillainy:   CharacterSheet.#onRollActOfVillainy,
      toggleTellHidden:    CharacterSheet.#onToggleTellHidden,
      sanctifyOath:        CharacterSheet.#onSanctifyOath,
      createDestiny:       CharacterSheet.#onCreateDestiny,
      ventResonance:       CharacterSheet.#onVentResonance,
      activateGreaterSign: CharacterSheet.#onActivateAnimaPower,
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
    tabAstrology: {
      template: "systems/exalted2e/templates/actor/character/_astrology.hbs",
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
    }
  };

  /** Current tab group state */
  tabGroups = { sheet: "tabMain" };

  // ── Context Preparation ─────────────────────────────────────────────────

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.document;
    const sys     = actor.system;

    // Tab definitions (icons shown in vertical right-side nav)
    const tabs = {
      tabMain:      { id: "tabMain",      group: "sheet", icon: "fa-solid fa-user",           label: game.i18n.localize("EX2E.TabMain"),       cssClass: this.tabGroups.sheet === "tabMain"       ? "active" : "" },
      tabCombat:    { id: "tabCombat",    group: "sheet", icon: "fa-solid fa-shield-halved",  label: game.i18n.localize("EX2E.TabCombat"),     cssClass: this.tabGroups.sheet === "tabCombat"     ? "active" : "" },
      tabCharms:    { id: "tabCharms",    group: "sheet", icon: "fa-solid fa-sun",            label: game.i18n.localize("EX2E.TabCharms"),          cssClass: this.tabGroups.sheet === "tabCharms"     ? "active" : "" },
      ...(sys.exaltType === "sidereal" ? { tabAstrology: { id: "tabAstrology", group: "sheet", icon: "fa-solid fa-star", label: game.i18n.localize("EX2E.SiderealAstrology"), cssClass: this.tabGroups.sheet === "tabAstrology" ? "active" : "" } } : {}),
      tabInventory: { id: "tabInventory", group: "sheet", icon: "fa-solid fa-suitcase",       label: game.i18n.localize("EX2E.TabInventory"),       cssClass: this.tabGroups.sheet === "tabInventory"  ? "active" : "" },
      tabBiography: { id: "tabBiography", group: "sheet", icon: "fa-solid fa-book",           label: game.i18n.localize("EX2E.TabBiography"),       cssClass: this.tabGroups.sheet === "tabBiography"  ? "active" : "" },
      tabExperience:{ id: "tabExperience",group: "sheet", icon: "fa-solid fa-graduation-cap", label: game.i18n.localize("EX2E.TabExperience"),      cssClass: this.tabGroups.sheet === "tabExperience" ? "active" : "" },
      tabEffects:   { id: "tabEffects",   group: "sheet", icon: "fa-solid fa-wand-sparkles",  label: game.i18n.localize("EX2E.TabEffects"),         cssClass: this.tabGroups.sheet === "tabEffects"    ? "active" : "" }
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
    if (sys.exaltType === "infernal") {
      const yoziBuckets = new Map();
      for (const c of charms) {
        if (c.system?.isSubmodule) continue;
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
    const sorceryLabelKey = sys.exaltType === "alchemical"
      ? "EX2E.TraditionProcedures"
      : "EX2E.TraditionSorcery";
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
    if (isAlchemical) {
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
    if (!isAlchemical || (sys.sorcery?.initiation ?? 0) > 0) {
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
    if (!isAlchemical || (sys.necromancy?.initiation ?? 0) > 0) {
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
    const meritflaws = actor.items.filter(i => i.type === "meritflaw")  .sort((a,b) => a.name.localeCompare(b.name));
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

    // Limit label varies by splat
    const limitLabel = (() => {
      switch (sys.exaltType) {
        case "abyssal":    return game.i18n.localize("EX2E.LimitVariantResonance");
        case "infernal":   return game.i18n.localize("EX2E.LimitVariantTorment");
        case "alchemical": return game.i18n.localize("EX2E.LimitVariantClarity");
        default:           return game.i18n.localize("EX2E.Limit");
      }
    })();

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

    const animaLabel = (() => {
      const tier = sys.anima;
      if (tier === "dim" && sys.exaltType === "terrestrial") {
        return game.i18n.localize("EX2E.AnimaLiminal");
      }
      return game.i18n.localize(EX2E.anima[tier] ?? "EX2E.AnimaNone");
    })();

    const dbFluxTiers = new Set(["burning", "bonfire", "totemic"]);
    const dbFluxInfo  = (sys.exaltType === "terrestrial" && dbFluxTiers.has(sys.anima))
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

    const greaterSigns = sys.exaltType === "sidereal"
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
    if (sys.exaltType === "sidereal") {
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
      useFourColumnAbilities: ["lunar", "alchemical"].includes(sys.exaltType),
      useAttributeCasteUI: ["lunar", "alchemical"].includes(sys.exaltType),
      exaltTypeChoices: Object.entries(EX2E.exaltTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      charms,
      charmGroups,
      submodulesByParent,
      charmPrereqs,
      spells,
      spellSections,
      spellInitStatus,
      spellCastButton,
      knacks,
      combos: comboRows,
      isLunar: sys.exaltType === "lunar",
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
      destinies
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
    for (const eff of actor.effects) {
      const refreshable = !!eff.flags?.exalted2e?.dvRefreshable;
      const entry = {
        id:           eff.id,
        name:         eff.name,
        img:          eff.img || "icons/svg/aura.svg",
        disabled:     eff.disabled,
        // For turn-refreshable effects there's no formal duration — label
        // them with a localized "Until next turn" string so the row isn't
        // blank. Otherwise fall back to Foundry's built-in duration label.
        durationLabel: refreshable
          ? game.i18n.localize("EX2E.EffectUntilNextTurn")
          : (eff.duration?.label ?? "")
      };
      const isTemporal = refreshable || eff.isTemporary;
      (isTemporal ? temporal : permanent).push(entry);
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

    let newCaste   = false;
    let newFavored = false;

    if (!ab.favored && !ab.caste) {
      // none → favored
      newFavored = true;
    } else if (ab.favored && !ab.caste) {
      // favored → caste
      newCaste = true;
    }
    // caste → none (both remain false)

    await this.document.update({
      [`system.abilities.${abilKey}.favored`]: newFavored,
      [`system.abilities.${abilKey}.caste`]:   newCaste
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
    await this.actor.update({ "system.splat.lunar.activeFormId": "" });
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
}
