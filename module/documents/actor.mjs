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
    }
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
   * the remainder spills over to the other pool. Returns false and warns
   * the user if both pools combined don't cover the cost.
   * @param {number} amount
   * @param {"personal"|"peripheral"} pool
   * @returns {Promise<boolean>} true if motes were spent, false if insufficient
   */
  async spendMotes(amount, pool = "peripheral") {
    if (this.type !== "character") return false;
    const primary   = this.system.motes[pool];
    const otherKey  = pool === "peripheral" ? "personal" : "peripheral";
    const secondary = this.system.motes[otherKey];

    if (primary.value + secondary.value < amount) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughMotes"));
      return false;
    }

    const fromPrimary   = Math.min(primary.value, amount);
    const overflow      = amount - fromPrimary;
    const fromSecondary = Math.min(secondary.value, overflow);

    await this.update({
      [`system.motes.${pool}.value`]:    primary.value - fromPrimary,
      [`system.motes.${otherKey}.value`]: secondary.value - fromSecondary
    });
    return true;
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
