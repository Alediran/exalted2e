import { EX2E } from "../config.mjs";

/**
 * Flatten a partial update object into an array of permanent-trait
 * changes, comparing against the actor's current (pre-update) values.
 * Returns `[{ path, label, oldValue, newValue, kind }, ...]` where
 * `kind` is "reduction" or "increase".
 *
 * Paths scanned:
 *   system.attributes.<key>.value         (9 attributes)
 *   system.abilities.<key>.value          (22 abilities)
 *   system.abilities.<key>.specialties    (length delta)
 *   system.essence.value
 *   system.willpower.max
 *   system.virtues.<key>.value
 */
function _collectPermanentTraitChanges(changed, actor) {
  const flat = foundry.utils.flattenObject(changed ?? {});
  const results = [];

  const attrLabel = (key) => {
    for (const group of Object.values(EX2E.attributes)) {
      if (key in group) return game.i18n.localize(group[key]);
    }
    return key;
  };
  const abilityLabel = (key) => game.i18n.localize(EX2E.abilityLabels[key] ?? key);
  const virtueLabel  = (key) =>
    game.i18n.localize(`EX2E.Virtue${key.charAt(0).toUpperCase()}${key.slice(1)}`);

  for (const [path, rawNew] of Object.entries(flat)) {
    let match;

    if ((match = path.match(/^system\.attributes\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.attributes?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: attrLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.abilities\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.abilities?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: abilityLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.essence\.value$/))) {
      const oldVal = Number(actor.system.essence?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: game.i18n.localize("EX2E.EssencePermanent"),
        oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.willpower\.max$/))) {
      const oldVal = Number(actor.system.willpower?.max ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: game.i18n.localize("EX2E.Willpower"),
        oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.virtues\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.virtues?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: virtueLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }
  }

  // Specialties are an array; flatten doesn't produce a scalar for them.
  // Handle separately by checking the full-array path at system.abilities.<key>.specialties.
  const expanded = foundry.utils.expandObject(changed ?? {});
  const abilities = expanded.system?.abilities ?? {};
  for (const [key, ab] of Object.entries(abilities)) {
    if (!("specialties" in ab)) continue;
    const oldList = actor.system.abilities?.[key]?.specialties ?? [];
    const newList = ab.specialties ?? [];
    if (newList.length === oldList.length) continue;
    const label = `${game.i18n.localize("EX2E.Specialties")}: ${
      game.i18n.localize(EX2E.abilityLabels[key] ?? key)}`;
    results.push({
      path: `system.abilities.${key}.specialties`,
      label,
      oldValue: oldList.length,
      newValue: newList.length,
      kind: newList.length > oldList.length ? "increase" : "reduction"
    });
  }

  return results;
}

/**
 * ExaltedActor – extends the base Foundry Actor document with
 * Exalted 2e specific behaviours.
 */
export class ExaltedActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * Roll-data short aliases so formulas in Charm attack stats (and any
   * other author-entered math) can reference attributes / abilities /
   * essence / willpower by three-letter tokens like `@str`, `@ess`,
   * `@melee` without having to spell out `@attributes.strength.value`.
   *
   * Foundry's Roll.replaceFormulaData consumes this map; anything the
   * author types is looked up against it.
   */
  getRollData() {
    const data = super.getRollData();
    const s = this.system ?? {};
    // Attribute shorthands.
    const a = s.attributes ?? {};
    const attr = (key) => a[key]?.value ?? 0;
    data.str = attr("strength");
    data.dex = attr("dexterity");
    data.sta = attr("stamina");
    data.cha = attr("charisma");
    data.man = attr("manipulation");
    data.app = attr("appearance");
    data.per = attr("perception");
    data.int = attr("intelligence");
    data.wit = attr("wits");
    // Every ability value exposed by its key (e.g. `@melee`, `@archery`).
    for (const [key, ab] of Object.entries(s.abilities ?? {})) {
      data[key] = ab?.value ?? 0;
    }
    // NOTE: `@essence` and `@willpower` already exist on roll data as
    // schema objects ({value, max}) — we can't overwrite those root keys
    // with plain numbers because the TypeDataModel setter rejects the
    // coercion silently. Use distinct aliases instead; formulas can also
    // always reference the nested path directly (`@essence.value`).
    data.ess          = s.essence?.value    ?? 0;
    data.wp           = s.willpower?.value  ?? 0;
    data.woundPenalty = s.health?.woundPenalty ?? 0;
    // Splat scalars are exposed only under the matching exaltType, so a
    // Solar never resolves @paradox to 0 silently. Array-shaped splat
    // data (forms, destinies, slots) is handled through the actor's
    // items list, not roll data.
    const splat = s.splat ?? {};
    switch (s.exaltType) {
      case "terrestrial":
        data.breeding = splat.terrestrial?.breeding ?? 0;
        break;
      case "sidereal":
        data.paradox    = splat.sidereal?.paradox    ?? 0;
        data.arcaneFate = splat.sidereal?.arcaneFate ?? 0;
        break;
      case "abyssal":
        data.resonance = splat.abyssal?.resonance ?? 0;
        data.whispers  = splat.abyssal?.whispers  ?? 0;
        break;
      case "infernal":
        data.torment       = splat.infernal?.torment       ?? 0;
        data.actOfVillainy = splat.infernal?.actOfVillainy ?? 0;
        break;
      case "alchemical": {
        const perm = splat.alchemical?.clarity?.permanent ?? 0;
        const temp = splat.alchemical?.clarity?.temporary ?? 0;
        data.clarity    = perm + temp;
        data.dissonance = splat.alchemical?.dissonance ?? 0;
        break;
      }
      // Solar, Lunar, and mortal: no numeric splat scalars to expose.
      default:
        break;
    }
    return data;
  }

  /**
   * When the caste changes for an ability-based exalt, auto-set the caste
   * flag on all abilities that belong to the new caste's group. Also
   * enforces Purchase Mode: when `system.purchaseLocked` is true, any
   * reduction of a permanent trait is rejected, and any increase opens
   * a confirmation dialog that logs an XP expenditure.
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    if (this.type !== "character") return;

    // ── Caste auto-assignment (existing behaviour, unchanged) ─────────
    const newCaste = changed.system?.caste;
    if (newCaste !== undefined) {
      const exaltType = changed.system?.exaltType ?? this.system.exaltType;
      const attrBased = ["lunar", "alchemical"];
      if (!attrBased.includes(exaltType)) {
        const groupDefs    = EX2E.abilityGroups[exaltType] ?? [];
        const casteGroup   = groupDefs.find(g => g.key === newCaste);
        const casteAbilSet = new Set(casteGroup?.abilities ?? []);
        const abilUpdates = {};
        for (const key of EX2E.abilities) {
          abilUpdates[`system.abilities.${key}.caste`] = casteAbilSet.has(key);
        }
        foundry.utils.mergeObject(changed, foundry.utils.expandObject(abilUpdates));
      }
    }

    // ── Purchase Mode enforcement ─────────────────────────────────────
    if (!this.system.purchaseLocked) return;

    const changes = _collectPermanentTraitChanges(changed, this);
    if (changes.length === 0) return;

    // Reductions: reject the whole update outright.
    const reductions = changes.filter(c => c.kind === "reduction");
    if (reductions.length > 0) {
      ui.notifications.warn(game.i18n.format("EX2E.PurchaseLockedReduction", {
        trait: reductions[0].label
      }));
      return false;
    }

    // Increases: confirm each via a dialog, then merge the log + XP
    // delta into `changed` so the field update and the ledger landing
    // persist atomically.
    const { PurchaseConfirmDialog } = await import("../dialogs/purchase-confirm-dialog.mjs");
    const { computeXpCost } = await import("../helpers/xp-costs.mjs");

    const newLog = [...(this.system.purchaseLog ?? [])];
    let newXp = Number(this.system.experience?.value ?? 0);

    for (const change of changes) {
      const costResult = computeXpCost(this, {
        kind: "field", path: change.path,
        oldValue: change.oldValue, newValue: change.newValue
      });
      const result = await PurchaseConfirmDialog.prompt({
        actor:        this,
        change:       {
          traitLabel: change.label,
          oldValue:   String(change.oldValue),
          newValue:   String(change.newValue)
        },
        initialXp:    costResult.xp,
        initialNote:  "",
        showStubHint: !costResult.confident,
        description:  costResult.description
      });
      if (result === null) return false;   // cancelled → abort whole update

      newLog.push({
        timestamp:  Date.now(),
        userId:     game.user.id,
        userName:   game.user.name,
        traitPath:  change.path,
        traitLabel: change.label,
        oldValue:   String(change.oldValue),
        newValue:   String(change.newValue),
        xpCost:     result.xpCost,
        note:       result.note
      });
      newXp -= result.xpCost;
    }

    foundry.utils.mergeObject(changed, {
      system: {
        purchaseLog:      newLog,
        experience:       { value: newXp }
      }
    });
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();

    const systemData = this.system;

    // ── Aggregate armor soak from equipped armor ──────────────────────────
    if (this.type === "character") {
      this._applyArmorSoak(systemData);
      this._applyWeaponStats(systemData);
      this._applyArtifactCommitment(systemData);
    }

    // ── Aggregate DV penalties carried by ActiveEffects ───────────────────
    this._aggregateDVPenalties(systemData);
    this._aggregateMDVPenalties(systemData);
  }

  /**
   * Collect every DV penalty currently attached to this actor and expose it
   * as a typed array on `system.dvPenalties`.
   *
   * Each penalty lives as a flag on an ActiveEffect:
   *   flags.exalted2e.dvPenalty      = { type: string, value: number }
   *   flags.exalted2e.dvRefreshable  = true   // cleared at turn start
   *
   * Keeping the data on the effect (rather than summed onto a stored base
   * field) lets us preserve the type — future charms that grant immunity to
   * a particular penalty category can filter the list before it's applied.
   */
  _aggregateDVPenalties(systemData) {
    const penalties = [];
    for (const eff of this.effects) {
      if (eff.disabled) continue;
      const p = eff.flags?.exalted2e?.dvPenalty;
      if (!p || typeof p.value !== "number" || !p.type) continue;
      penalties.push({ type: p.type, value: p.value, effectId: eff.id, label: eff.name });
    }
    systemData.dvPenalties = penalties;
  }

  /**
   * Mirror of `_aggregateDVPenalties` for mental/social defense. MDV-
   * reducing AEs persist for their own duration (there is no tick-
   * based refresh like physical DVs have), so this aggregator does not
   * pair with any equivalent of `dvRefreshable`.
   */
  _aggregateMDVPenalties(systemData) {
    const penalties = [];
    for (const eff of this.effects) {
      if (eff.disabled) continue;
      const p = eff.flags?.exalted2e?.mdvPenalty;
      if (!p || typeof p.value !== "number" || !p.type) continue;
      penalties.push({ type: p.type, value: p.value, effectId: eff.id, label: eff.name });
    }
    systemData.mdvPenalties = penalties;
  }

  /**
   * Sum every external penalty on this actor that applies to the given
   * action category. Each penalty lives on an ActiveEffect's flags as:
   *   flags.exalted2e.externalPenalty = { value: number, type: string }
   *
   * `type` is one of "physical" / "social" / "mental" / "all"; callers
   * pass the category they're rolling for, and a penalty matches iff its
   * type equals the category or is "all". Only non-reflexive rolls
   * (attacks, attribute+ability rolls) should subtract this — passive DV
   * calculations bypass it by not calling this helper.
   *
   * Foundry's built-in Prone status is patched in the init hook to carry
   * `{ value: 1, type: "physical" }`, which is where the penalty enters
   * the system — toggling Prone on the token HUD applies and removes it.
   */
  externalPenaltyFor(type = "physical") {
    let total = 0;
    for (const eff of this.effects) {
      if (eff.disabled) continue;
      const p = eff.flags?.exalted2e?.externalPenalty;
      if (!p || !Number.isFinite(p.value)) continue;
      if (p.type !== "all" && p.type !== type) continue;
      total += p.value;
    }
    return total;
  }

  /**
   * Same shape as `externalPenaltyFor` but for internal penalties. Both
   * subtract from dice pools today; tracking them separately matters
   * later for charm interactions (some charms reduce external penalties
   * but never internal ones).
   *
   * Internal penalty AEs are flagged:
   *   flags.exalted2e.internalPenalty = { value: number, type: string }
   * The current consumer is the "aborted Aim" -2 applied when a
   * character walks away from their designated target.
   */
  internalPenaltyFor(type = "physical") {
    let total = 0;
    for (const eff of this.effects) {
      if (eff.disabled) continue;
      const p = eff.flags?.exalted2e?.internalPenalty;
      if (!p || !Number.isFinite(p.value)) continue;
      if (p.type !== "all" && p.type !== type) continue;
      total += p.value;
    }
    // Armor mobility penalty is a structural internal penalty on
    // physical actions — stored as a negative integer on the actor by
    // `_applyArmorSoak`, so flip the sign to get the deduction magnitude.
    // Fatigue is a separate "scene-level stamina check" mechanic in RAW
    // and not a flat pool deduction; skipped here.
    if (type === "physical") {
      const mob = Number(this.system?.mobilityPenalty) || 0;
      if (mob < 0) total += -mob;
    }
    return total;
  }

  /**
   * Convenience: stamp an internal penalty as a refreshable AE that
   * clears at the next DV refresh. Mirrors `applyDVPenalty` for the
   * external-penalty / DV story.
   */
  async applyInternalPenalty(value, { type = "all", label, icon } = {}) {
    if (!Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/regen.svg",
      flags: {
        exalted2e: {
          internalPenalty: { type, value },
          dvRefreshable:   true
        }
      },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  /** Sum of every non-immune DV penalty. */
  get dvPenaltyTotal() {
    const penalties = this.system?.dvPenalties ?? [];
    // Immunity plumbing (future): charms can stash `flags.exalted2e.dvImmunities`
    // on this actor, and those types get filtered out here.
    const immunities = new Set(this.getFlag("exalted2e", "dvImmunities") ?? []);
    let total = 0;
    for (const p of penalties) {
      if (immunities.has(p.type)) continue;
      total += p.value;
    }
    return total;
  }

  /** Sum of every non-immune MDV penalty. */
  get mdvPenaltyTotal() {
    const penalties = this.system?.mdvPenalties ?? [];
    const immunities = new Set(this.getFlag("exalted2e", "mdvImmunities") ?? []);
    let total = 0;
    for (const p of penalties) {
      if (immunities.has(p.type)) continue;
      total += p.value;
    }
    return total;
  }

  /** DV after current penalties, never below 0. */
  get currentDodgeDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.dodgeDV ?? 0)
               : this.type === "npc"       ? (s.combat?.dodgeDV ?? 0)
               : 0;
    return Math.max(0, base - this.dvPenaltyTotal);
  }

  get currentParryDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.parryDV ?? s.parryDVBase ?? 0)
               : this.type === "npc"       ? (s.combat?.parryDV ?? 0)
               : 0;
    return Math.max(0, base - this.dvPenaltyTotal);
  }

  /** MDV after current penalties, never below 0. */
  get currentDodgeMDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.dodgeMDV ?? 0)
               : this.type === "npc"       ? (s.combat?.dodgeMDV ?? 0)
               : 0;
    return Math.max(0, base - this.mdvPenaltyTotal);
  }

  get currentParryMDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.parryMDV?.best ?? 0)
               : this.type === "npc"       ? (s.combat?.parryMDV ?? 0)
               : 0;
    return Math.max(0, base - this.mdvPenaltyTotal);
  }

  /**
   * Create an ActiveEffect that records a DV penalty of the given type and
   * magnitude on this actor. The effect is flagged refreshable so the combat
   * document clears it at the start of this actor's next turn.
   *
   * @param {string} type    Penalty category, e.g. "flurry", "onslaught".
   * @param {number} value   Positive magnitude (penalty to DV).
   * @param {object} [opts]
   * @param {string} [opts.label]  Human-readable effect name (defaults to the type).
   * @param {string} [opts.icon]   Status icon path.
   */
  async applyDVPenalty(type, value, { label, icon, sticky = false } = {}) {
    if (!type || !Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/shield.svg",
      flags: {
        exalted2e: {
          dvPenalty:     { type, value },
          dvRefreshable: true,
          // Sticky DV penalties survive the usual "refresh on your next
          // action's tick" clear-out — abortable actions (Aim, Guard)
          // need their DV penalty to persist until the next DIFFERENT
          // action's speed elapses. Flipped to false at the next commit.
          dvSticky:      !!sticky
        }
      },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  /**
   * Mirror of `applyDVPenalty` for MDVs. No refreshable mechanism —
   * MDV-reducing AEs stand on their own duration. No `sticky` option
   * for the same reason.
   *
   * @param {string} type   Penalty category (e.g., "emotion", "illusion").
   * @param {number} value  Positive magnitude.
   * @param {object} [opts]
   * @param {string} [opts.label]
   * @param {string} [opts.icon]
   */
  async applyMDVPenalty(type, value, { label, icon } = {}) {
    if (!type || !Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/aura.svg",
      flags: { exalted2e: { mdvPenalty: { type, value } } },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  /**
   * Stamp (or bump) the onslaught penalty on this actor. RAW: any time a
   * character is attacked, they accrue +1 DV penalty until their next
   * action. Multiple attacks in the same tick cycle stack onto a single
   * AE so the effects list stays readable; `_aggregateDVPenalties` reads
   * the `value` field directly. Auto-cleared by `advanceWheel` when the
   * defender's initiative comes up (the standard DV refresh).
   */
  async addOnslaught() {
    const existing = this.effects.find(e =>
      !e.disabled && e.flags?.exalted2e?.dvPenalty?.type === "onslaught"
    );
    if (existing) {
      const next = (existing.flags.exalted2e.dvPenalty.value ?? 0) + 1;
      await existing.update({
        name: game.i18n.format("EX2E.OnslaughtEffect", { n: next }),
        "flags.exalted2e.dvPenalty.value": next
      });
      return existing;
    }
    return this.applyDVPenalty("onslaught", 1, {
      label: game.i18n.format("EX2E.OnslaughtEffect", { n: 1 }),
      icon:  "icons/svg/hazard.svg"
    });
  }

  /**
   * Sum attunement costs of every attuned artifact (weapons + armor) and
   * expose them as derived commitment totals. Artifacts always commit to the
   * peripheral pool — the two pools are interchangeable for this purpose.
   *
   * Stored fields (manual / charm commitments):
   *   motes.personal.committed, motes.peripheral.committed
   * Derived:
   *   motes.personal.artifactCommitted, motes.peripheral.artifactCommitted
   *   motes.personal.totalCommitted,    motes.peripheral.totalCommitted
   */
  _applyArtifactCommitment(systemData) {
    let artifactPeripheral = 0;
    for (const item of this.items) {
      if ((item.type === "weapon" || item.type === "armor")
          && item.system.artifact && item.system.attuned) {
        artifactPeripheral += item.system.attunementCost ?? 0;
      }
    }

    systemData.motes.personal.artifactCommitted   = 0;
    systemData.motes.peripheral.artifactCommitted = artifactPeripheral;

    systemData.motes.personal.totalCommitted   = (systemData.motes.personal.committed   ?? 0);
    systemData.motes.peripheral.totalCommitted = (systemData.motes.peripheral.committed ?? 0) + artifactPeripheral;

    // Effective maximum = total max reduced by what's locked in commitments.
    // Displayed in the UI and enforced by spendMotes.
    systemData.motes.personal.effectiveMax   = Math.max(0, (systemData.motes.personal.max   ?? 0) - systemData.motes.personal.totalCommitted);
    systemData.motes.peripheral.effectiveMax = Math.max(0, (systemData.motes.peripheral.max ?? 0) - systemData.motes.peripheral.totalCommitted);
  }

  /**
   * Add soak from the first equipped armor to the character's natural soak.
   */
  _applyArmorSoak(systemData) {
    const equippedArmor = this.items.find(i => i.type === "armor" && i.system.equipped);
    if (equippedArmor) {
      const a = equippedArmor.system.effectiveSoak;
      systemData.totalSoak = {
        bashing:    (systemData.naturalSoak?.bashing    ?? 0) + a.bashing,
        lethal:     (systemData.naturalSoak?.lethal     ?? 0) + a.lethal,
        aggravated: (systemData.naturalSoak?.aggravated ?? 0) + a.aggravated
      };
      systemData.hardness          = equippedArmor.system.effectiveHardness;
      systemData.mobilityPenalty   = equippedArmor.system.effectiveMobilityPenalty;
      systemData.armorName         = equippedArmor.name;
    } else {
      systemData.totalSoak = { ...systemData.naturalSoak } ?? { bashing: 0, lethal: 0, aggravated: 0 };
      systemData.hardness        = 0;
      systemData.mobilityPenalty = 0;
      systemData.armorName       = null;
    }
  }

  /**
   * Build one row per (equipped weapon, mode of use) for the combat tab.
   */
  _applyWeaponStats(systemData) {
    const equipped = this.items.filter(i => i.type === "weapon" && i.system.equipped);
    const rows = [];
    for (const w of equipped) {
      const modes = w.system.modes ?? [];
      modes.forEach((mode, modeIndex) => {
        rows.push({
          id:         w.id,
          modeIndex,
          name:       modes.length > 1 ? `${w.name} — ${mode.name}` : w.name,
          speed:      mode.effectiveSpeed,
          accuracy:   mode.accuracyLabel,
          damage:     mode.damageLabel,
          defense:    mode.defenseLabel,
          rate:       mode.effectiveRate,
          range:      mode.effectiveRange
        });
      });
    }
    systemData.equippedWeapons = rows;
  }

  // ── Convenience Helpers ────────────────────────────────────────────────

  /**
   * Apply damage to the character.
   * @param {number} amount - Amount of damage.
   * @param {"bashing"|"lethal"|"aggravated"} type - Damage type.
   */
  async applyDamage(amount, type) {
    if (this.type !== "character" && this.type !== "npc") return;

    const h = foundry.utils.deepClone(this.system.health);
    h[type] = Math.max(0, h[type] + amount);

    // Cap total damage at total boxes. For characters, bonus is a
    // per-level object (-0 / -1 / -2); NPCs carry a flat totalBoxes.
    let totalBoxes;
    if (this.type === "character") {
      const b = h.bonus ?? { zero: 0, one: 0, two: 0 };
      const bonusTotal = (b.zero ?? 0) + (b.one ?? 0) + (b.two ?? 0);
      totalBoxes = 7 + bonusTotal;
    } else {
      totalBoxes = h.totalBoxes;
    }
    const totalDmg = h.aggravated + h.lethal + h.bashing;
    if (totalDmg > totalBoxes) {
      const excess = totalDmg - totalBoxes;
      h[type] = Math.max(0, h[type] - excess);
    }

    return this.update({ "system.health": h });
  }

  /**
   * Heal damage from the character, clearing from least severe first.
   * @param {number} amount
   */
  async healDamage(amount) {
    const h = foundry.utils.deepClone(this.system.health);
    let remaining = amount;

    // Heal bashing first, then lethal, then aggravated
    ["bashing", "lethal", "aggravated"].forEach(type => {
      const heal = Math.min(h[type], remaining);
      h[type] -= heal;
      remaining -= heal;
    });

    return this.update({ "system.health": h });
  }

  /**
   * Spend motes from the given pool. If the pool doesn't have enough,
   * the remainder spills over to the other pool.
   *
   * @param {number} amount
   * @param {"personal"|"peripheral"} pool
   * @returns {Promise<null | {fromPrimary:number, fromSecondary:number, primaryPool:string, secondaryPool:string}>}
   *     Per-pool breakdown on success (truthy), null on insufficient funds
   *     (with a user warning emitted). Callers that only care about
   *     success/failure still work — null is falsy, the object is truthy.
   */
  async spendMotes(amount, pool = "peripheral") {
    if (this.type !== "character") return null;
    const primary   = this.system.motes[pool];
    const otherKey  = pool === "peripheral" ? "personal" : "peripheral";
    const secondary = this.system.motes[otherKey];

    if (primary.value + secondary.value < amount) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughMotes"));
      return null;
    }

    const fromPrimary   = Math.min(primary.value, amount);
    const overflow      = amount - fromPrimary;
    const fromSecondary = Math.min(secondary.value, overflow);

    await this.update({
      [`system.motes.${pool}.value`]:    primary.value - fromPrimary,
      [`system.motes.${otherKey}.value`]: secondary.value - fromSecondary
    });
    return {
      fromPrimary,
      fromSecondary,
      primaryPool:   pool,
      secondaryPool: otherKey
    };
  }

  /**
   * Recover motes for the given pool.
   * @param {number} amount
   * @param {"personal"|"peripheral"} pool
   */
  async recoverMotes(amount, pool = "peripheral") {
    if (this.type !== "character") return;
    const moteData = this.system.motes[pool];
    const newVal   = Math.min(moteData.max, moteData.value + amount);
    return this.update({ [`system.motes.${pool}.value`]: newVal });
  }
}
