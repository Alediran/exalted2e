import { EX2E }          from "../../config.mjs";
import { ExaltedRoll }   from "../../rolls/exalted-roll.mjs";
import { evaluateCharmPrereqs } from "../../helpers/charm-prereqs.mjs";

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ActorSheetV2: sheets.ActorSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

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
      toggleEquip:         CharacterSheet.#onToggleEquip,
      sendItemToChat:      CharacterSheet.#onSendItemToChat,
      rollPool:            CharacterSheet.#onRollPool,
      cycleAbilityFlag:    CharacterSheet.#onCycleAbilityFlag,
      rollAttack:          CharacterSheet.#onRollAttack,
      pickVirtueFlaw:      CharacterSheet.#onPickVirtueFlaw,
      clearVirtueFlaw:     CharacterSheet.#onClearVirtueFlaw,
      editEffect:          CharacterSheet.#onEditEffect,
      deleteEffect:        CharacterSheet.#onDeleteEffect,
      toggleEffect:        CharacterSheet.#onToggleEffect,
      createEffect:        CharacterSheet.#onCreateEffect
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
      tabCharms:    { id: "tabCharms",    group: "sheet", icon: "fa-solid fa-sun",            label: game.i18n.localize("EX2E.TabCharms"),     cssClass: this.tabGroups.sheet === "tabCharms"     ? "active" : "" },
      tabInventory: { id: "tabInventory", group: "sheet", icon: "fa-solid fa-suitcase",       label: game.i18n.localize("EX2E.TabInventory"),  cssClass: this.tabGroups.sheet === "tabInventory"  ? "active" : "" },
      tabBiography: { id: "tabBiography", group: "sheet", icon: "fa-solid fa-book",           label: game.i18n.localize("EX2E.TabBiography"),  cssClass: this.tabGroups.sheet === "tabBiography"  ? "active" : "" },
      tabExperience:{ id: "tabExperience",group: "sheet", icon: "fa-solid fa-graduation-cap", label: game.i18n.localize("EX2E.TabExperience"), cssClass: this.tabGroups.sheet === "tabExperience" ? "active" : "" },
      tabEffects:   { id: "tabEffects",   group: "sheet", icon: "fa-solid fa-wand-sparkles",  label: game.i18n.localize("EX2E.TabEffects"),    cssClass: this.tabGroups.sheet === "tabEffects"    ? "active" : "" }
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
    const buckets = new Map();
    for (const c of charms) {
      const k = c.system?.ability ?? "";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(c);
    }
    const charmGroups = [...buckets.entries()]
      .map(([key, list]) => ({ key, label: labelForCharmAbility(key), charms: list }))
      .sort((a, b) => a.label.localeCompare(b.label));

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
    const spellGroups = { sorcery: [], necromancy: [] };
    const spellBuckets = { sorcery: new Map(), necromancy: new Map() };
    for (const s of spells) {
      const trad = s.system?.tradition === "necromancy" ? "necromancy" : "sorcery";
      const circle = Math.max(1, Math.min(3, Number(s.system?.circle) || 1));
      if (!spellBuckets[trad].has(circle)) spellBuckets[trad].set(circle, []);
      spellBuckets[trad].get(circle).push(s);
    }
    const buildSpellGroups = (trad, circleLabels) => {
      return [...spellBuckets[trad].entries()]
        .sort(([a], [b]) => a - b)
        .map(([circle, list]) => ({ circle, label: circleLabels[circle], spells: list }));
    };
    spellGroups.sorcery    = buildSpellGroups("sorcery",    SORCERY_CIRCLES);
    spellGroups.necromancy = buildSpellGroups("necromancy", NECROMANCY_CIRCLES);
    const spellSections = [
      {
        tradition: "sorcery",
        label:     game.i18n.localize(sorceryLabelKey),
        initiation: sys.sorcery?.initiation ?? 0,
        initiationPath: "system.sorcery.initiation",
        groups:    spellGroups.sorcery
      },
      {
        tradition: "necromancy",
        label:     game.i18n.localize("EX2E.TraditionNecromancy"),
        initiation: sys.necromancy?.initiation ?? 0,
        initiationPath: "system.necromancy.initiation",
        groups:    spellGroups.necromancy
      }
    ];
    // Per-spell "circle too high for this caster's initiation" flag, so
    // the template can show a warning indicator without re-reading the
    // initiation level for each row.
    const spellInitStatus = {};
    for (const s of spells) {
      const trad = s.system?.tradition === "necromancy" ? "necromancy" : "sorcery";
      const req  = Math.max(1, Number(s.system?.circle) || 1);
      const cur  = Number(sys[trad]?.initiation ?? 0);
      spellInitStatus[s.id] = { ok: cur >= req, required: req, current: cur };
    }

    const knacks     = actor.items.filter(i => i.type === "knack")      .sort((a,b) => a.name.localeCompare(b.name));
    const weapons    = actor.items.filter(i => i.type === "weapon")     .sort((a,b) => a.name.localeCompare(b.name));
    const armors     = actor.items.filter(i => i.type === "armor")      .sort((a,b) => a.name.localeCompare(b.name));
    const backgrounds= actor.items.filter(i => i.type === "background") .sort((a,b) => a.name.localeCompare(b.name));
    const intimacies = actor.items.filter(i => i.type === "intimacy")   .sort((a,b) => a.name.localeCompare(b.name));
    const meritflaws = actor.items.filter(i => i.type === "meritflaw")  .sort((a,b) => a.name.localeCompare(b.name));
    const virtueFlaw = actor.items.find(i => i.type === "virtueflaw") ?? null;

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

    return {
      ...context,
      actor,
      system:           sys,
      tabs,
      config:           EX2E,
      availableCastes,
      abilityGroups,
      specialtiesSection,
      useFourColumnAbilities: ["lunar", "alchemical"].includes(sys.exaltType),
      exaltTypeChoices: Object.entries(EX2E.exaltTypes).map(([k,v]) => ({ value: k, label: game.i18n.localize(v) })),
      charms,
      charmGroups,
      charmPrereqs,
      spells,
      spellSections,
      spellInitStatus,
      knacks,
      combos: comboRows,
      isLunar: sys.exaltType === "lunar",
      weapons,
      armors,
      backgrounds,
      intimacies,
      meritflaws,
      virtueFlaw,
      effects,
      isEditable: this.isEditable,
      useIntimacyIntensity: game.settings.get("exalted2e", "useIntimacyIntensity")
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
      context.enrichedBiography = await TextEditor.enrichHTML(this.document.system.biography, enrichOpts);
      context.enrichedNotes     = await TextEditor.enrichHTML(this.document.system.notes, enrichOpts);
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
    this.document.update({ "system.limit.value": val });
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
    // Spells let the Add button pick a starting tradition via data-tradition
    // so a new spell landing in the Necromancy section isn't Sorcery by default.
    if (type === "spell" && target.dataset.tradition) {
      data.system = { tradition: target.dataset.tradition };
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
    if (item?.type === "charm") await item.activateCharm();
    else if (item?.type === "spell") await item.castSpell();
  }

  static async #onActivateCombo(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.document.items.get(itemId);
    if (item?.type === "combo") await item.activateCombo();
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
}
