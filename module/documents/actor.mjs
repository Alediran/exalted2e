import { EX2E } from "../config.mjs";

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
    return data;
  }

  /**
   * When the caste changes for an ability-based exalt, auto-set the caste
   * flag on all abilities that belong to the new caste's group.
   */
  _preUpdate(changed, options, user) {
    super._preUpdate(changed, options, user);
    if (this.type !== "character") return;

    const newCaste = changed.system?.caste;
    if (newCaste === undefined) return;           // caste didn't change
    const exaltType = changed.system?.exaltType ?? this.system.exaltType;

    // Only ability-based exalts get automatic caste ability flags
    const attrBased = ["lunar", "alchemical"];
    if (attrBased.includes(exaltType)) return;

    // Determine which abilities belong to the new caste
    const groupDefs    = EX2E.abilityGroups[exaltType] ?? [];
    const casteGroup   = groupDefs.find(g => g.key === newCaste);
    const casteAbilSet = new Set(casteGroup?.abilities ?? []);

    // Build update: clear caste on all abilities, set on matching ones
    const abilUpdates = {};
    for (const key of EX2E.abilities) {
      abilUpdates[`system.abilities.${key}.caste`] = casteAbilSet.has(key);
    }
    foundry.utils.mergeObject(changed, foundry.utils.expandObject(abilUpdates));
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
  async applyDVPenalty(type, value, { label, icon } = {}) {
    if (!type || !Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/shield.svg",
      flags: {
        exalted2e: {
          dvPenalty:     { type, value },
          dvRefreshable: true
        }
      },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
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

    // Cap total damage at total boxes
    const totalBoxes = this.type === "character"
      ? (7 + h.bonus)
      : h.totalBoxes;
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
