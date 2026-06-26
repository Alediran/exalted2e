import { evaluateCharmFormula } from "../documents/item.mjs";

const SOCIAL_ABILITIES = new Set(["presence", "performance", "bureaucracy", "investigation"]);

/**
 * Returns true if the charm should contribute passive effects.
 * Permanent charms always contribute; other durations only contribute when
 * the charm is currently toggled on (system.active === true).
 * @param {object} item
 * @returns {boolean}
 */
export function isCharmPassivelyActive(item) {
  return item?.system?.duration  === "permanent"
    || item?.system?.charmType === "permanent"
    || item?.system?.active    === true;
}

/**
 * Apply wound-reduction charm bonus to the base wound penalty.
 * bonusReduction is the integer accumulated in system.bonuses.woundPenaltyReduction
 * by charmSource AEs (formula="" → AE value 4, which covers the -4 max wound penalty).
 * @param {number} bonusReduction — ≥ 0
 * @param {number} baseWoundPenalty — typically ≤ 0
 * @returns {number} effective wound penalty
 */
export function computeWoundReduction(bonusReduction, baseWoundPenalty) {
  if (!bonusReduction) return baseWoundPenalty;
  return Math.min(0, baseWoundPenalty + bonusReduction);
}

/**
 * Aggregate the maximum extraActions allowed by all enabled charms flagged with extraActionsMax.
 * Returns the highest max across all charms (not the sum).
 * @param {object} actor
 * @returns {number}
 */
export function aggregateExtraActionsMaxFromAEs(actor) {
  let max = 0;
  for (const ae of (actor.effects ?? [])) {
    if (ae.disabled) continue;
    const n = ae.flags?.exalted2e?.extraActionsMax ?? 0;
    if (n > max) max = n;
  }
  return max;
}

/**
 * Aggregate speed modifiers from all enabled charms flagged with speedModifier.
 * Sums all deltas and clamps to the highest minimum across all charms.
 * @param {object} actor
 * @param {number} baseSpeed
 * @returns {number}
 */
export function aggregateSpeedModifierFromAEs(actor, baseSpeed) {
  let totalDelta = 0, globalMin = 3;
  let anyEnabled = false;
  for (const ae of (actor.effects ?? [])) {
    if (ae.disabled) continue;
    const sm = ae.flags?.exalted2e?.speedModifier;
    if (!sm) continue;
    anyEnabled = true;
    totalDelta += sm.delta ?? 0;
    globalMin = Math.max(globalMin, sm.minimum ?? 3);
  }
  if (!anyEnabled) return baseSpeed;
  return Math.floor(Math.max(globalMin, baseSpeed + totalDelta));
}

export function getMasteryDiscount(actor, ability) {
  const ae = actor.effects?.find(
    e => !e.disabled
      && e.flags?.exalted2e?.masteryAbility === ability
      && (e.flags?.exalted2e?.masteryCommitment ?? 0) > 0
  );
  return ae ? Math.floor((ae.flags.exalted2e.masteryCommitment ?? 0) / 2) : 0;
}

/**
 * Aggregate movement bonuses from all passively-active charms.
 * Returns dash pool bonus (sum), flight flag (OR), and water-walking flag (OR).
 * @param {object} actor
 * @returns {{ dashBonus: number, hasFlight: boolean, hasWaterWalking: boolean }}
 */
/**
 * Aggregate DV bonuses from all passively-active charms with dvBonus enabled.
 * @param {object} actor
 * @returns {{ dodgeBonus: number, parryBonus: number }}
 */
export function aggregateDVBonusFromCharms(actor) {
  const charms   = (actor.items ?? []).filter(i => i.type === "charm" && isCharmPassivelyActive(i));
  const rollData = actor.getRollData?.() ?? {};
  let dodgeBonus = 0, parryBonus = 0;
  for (const c of charms) {
    const dvb = c.system?.dvBonus;
    if (!dvb?.enabled) continue;
    dodgeBonus += dvb.dodgeBonus ?? 0;
    parryBonus += dvb.parryBonus ?? 0;
    if (dvb.dodgeBonusFormula) {
      dodgeBonus += (evaluateCharmFormula(dvb.dodgeBonusFormula, rollData, 0) | 0);
    }
    if (dvb.parryBonusFormula) {
      parryBonus += (evaluateCharmFormula(dvb.parryBonusFormula, rollData, 0) | 0);
    }
  }
  return { dodgeBonus, parryBonus };
}

/**
 * Aggregate ONLY the formula-based DV bonuses from passively-active charms.
 * Does NOT include dvBonus.dodgeBonus / dvBonus.parryBonus integer fields —
 * those arrive via AEs and are already counted in _aggregateDVBonuses.
 * @param {object} actor
 * @returns {{ dodgeBonus: number, parryBonus: number }}
 */
export function aggregateDVBonusFormulaFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  let dodgeBonus = 0, parryBonus = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const dvb = c.system?.dvBonus;
    if (dvb?.enabled) {
      if (dvb.dodgeBonusFormula) {
        dodgeBonus += (evaluateCharmFormula(dvb.dodgeBonusFormula, rollData, 0) | 0);
      }
      if (dvb.parryBonusFormula) {
        parryBonus += (evaluateCharmFormula(dvb.parryBonusFormula, rollData, 0) | 0);
      }
    }
    // Top-level dvBonusFormula applies to both DVs, independent of dvBonus.enabled
    const topFormula = c.system?.dvBonusFormula;
    if (topFormula) {
      const bonus = (evaluateCharmFormula(topFormula, rollData, 0) | 0);
      dodgeBonus += bonus;
      parryBonus += bonus;
    }
  }
  return { dodgeBonus, parryBonus };
}

/**
 * Sum the Rate bonus from all passively-active charms with rateBonus enabled.
 * NOTE: In the live system, rateBonus is accumulated into system.bonuses.rateBonus
 * by buildCharmSynthAEs (form-charms.mjs) via ADD active-effect changes, so this
 * helper is NOT called from rollAttack. It is provided as a pure utility for
 * headless tests and any future context that needs to aggregate rateBonus without AEs.
 * @param {object} actor
 * @returns {number}
 */
export function aggregateRateBonusFromCharms(actor) {
  const charms   = (actor.items ?? []).filter(i => i.type === "charm" && isCharmPassivelyActive(i));
  const rollData = actor.getRollData?.() ?? {};
  let total = 0;
  for (const c of charms) {
    const rb = c.system?.rateBonus;
    if (!rb?.enabled || !rb.formula) continue;
    total += (evaluateCharmFormula(rb.formula, rollData, 0) | 0);
  }
  return total;
}

/**
 * Return the highest attackSuccessMultiplier across all passively-active charms.
 * Returns 1 if no charm has a multiplier > 1.
 * @param {object} actor
 * @returns {number}
 */
export function getAttackSuccessMultiplier(actor) {
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.attackSuccessMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

/**
 * Return the highest extraSuccessMultiplier across all passively-active charms.
 * Multiplies only threshold successes (above DV) before adding to rawDamagePool (Step 7),
 * NOT total Step 3 successes.
 * Returns 1 if no charm has a multiplier > 1.
 * @param {object} actor
 * @returns {number}
 */
export function getExtraSuccessMultiplierFromCharms(actor) {
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.extraSuccessMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

/**
 * Sum flat attack success bonuses from all passively-active charms.
 * Guaranteed successes added to the Step 3 tally before DV comparison.
 * @param {object} actor
 * @returns {number}
 */
export function getAttackSuccessBonusFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.attackSuccessBonus ?? 0;
  }
  return total;
}

/**
 * Return the highest minimumDamage across all passively-active charms.
 * The minimum applies to the post-soak damage pool (after soak subtraction,
 * before adding post-soak dice). Returns 0 if no charm enforces a minimum.
 * @param {object} actor
 * @returns {number}
 */
export function getMinimumDamageFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  let max = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const md = c.system?.minimumDamage;
    if (!md?.enabled || !md.formula) continue;
    const val = (evaluateCharmFormula(md.formula, rollData, 0) | 0);
    if (val > max) max = val;
  }
  return max;
}

/**
 * Sum rawDamageBonus across all passively-active charms.
 * Returns 0 if no charm contributes.
 * @param {object} actor
 * @returns {number}
 */
export function aggregateRawDamageBonusFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const rb = c.system?.rawDamageBonus;
    if (!rb?.enabled || !rb.formula) continue;
    total += (evaluateCharmFormula(rb.formula, rollData, 0) | 0);
  }
  return total;
}

/**
 * Return the first essenceDrain config from a passively-active charm, or null if none.
 * Drains motes from the target on a confirmed hit.
 * @param {object} actor
 * @returns {{ amount: number, pool: string, targetTypeFilter: string }|null}
 */
export function getEssenceDrainFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const ed = c.system?.essenceDrain;
    if (!ed?.enabled || !ed.formula) continue;
    const amount = (evaluateCharmFormula(ed.formula, rollData, 0) | 0);
    if (amount <= 0) continue;
    return { amount, pool: ed.pool ?? "peripheral", targetTypeFilter: ed.targetTypeFilter ?? "" };
  }
  return null;
}

/**
 * Return combined targetWillpowerDrain from all passively-active charms, or null if none enabled.
 * On a confirmed hit, reduce target's WP by the summed amount.
 */
export function getTargetWillpowerDrainFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const wd = c.system?.targetWillpowerDrain;
    if (!wd?.enabled || !wd.formula) continue;
    total += (evaluateCharmFormula(wd.formula, rollData, 0) | 0);
  }
  return total > 0 ? { amount: total } : null;
}

/**
 * Sum abilityDiceBonus entries matching the given ability across all passively-active charms.
 * @param {object} actor
 * @param {string} abilityKey
 * @returns {number}
 */
export function aggregateAbilityDiceBonusFromCharms(actor, abilityKey) {
  const rollData = actor.getRollData?.() ?? {};
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const bonuses = c.system?.abilityDiceBonus ?? [];
    for (const entry of bonuses) {
      if (entry.ability !== abilityKey || !entry.formula) continue;
      total += (evaluateCharmFormula(entry.formula, rollData, 0) | 0);
    }
  }
  return total;
}

export function getRawDamageMultiplierFromCharms(actor) {
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.rawDamageMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

export function getPostSoakDamageMultiplierFromCharms(actor) {
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.postSoakDamageMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

export function getDamageSuccessMultiplierFromCharms(actor) {
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.damageSuccessMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

export function getIgnoreSoakFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.ignoreSoak === true) return true;
  }
  return false;
}

export function aggregateMoveBonusFromCharms(actor) {
  const charms   = (actor.items ?? []).filter(i => i.type === "charm" && isCharmPassivelyActive(i));
  const rollData = actor.getRollData?.() ?? {};
  let dashBonus = 0, hasFlight = false, hasWaterWalking = false;
  for (const c of charms) {
    const mb = c.system?.moveBonus;
    if (!mb?.enabled) continue;
    if (mb.dashAdd) {
      const val = evaluateCharmFormula(mb.dashAdd, rollData, 0);
      dashBonus += (val | 0);
    }
    if (mb.flight)       hasFlight       = true;
    if (mb.waterWalking) hasWaterWalking = true;
  }
  return { dashBonus, hasFlight, hasWaterWalking };
}

export function aggregateSocialSuccessBonusFromCharms(actor, abilityKey) {
  if (!SOCIAL_ABILITIES.has(abilityKey)) return 0;
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.socialSuccessBonus ?? 0;
  }
  return total;
}

export function aggregateSocialSuccessMultiplierFromCharms(actor, abilityKey) {
  if (!SOCIAL_ABILITIES.has(abilityKey)) return 1;
  let max = 1;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const m = c.system?.socialSuccessMultiplier ?? 1;
    if (m > max) max = m;
  }
  return max;
}

/**
 * Returns true if an active charm has the clockworkAutoSuccessConversion flag.
 * When true, the rolled dice pool becomes automatic successes (no dice rolled).
 * @param {object} actor
 * @returns {boolean}
 */
export function getClockworkAutoSuccessFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.clockworkAutoSuccessConversion === true) return true;
  }
  return false;
}

/**
 * Build a map of ability/attribute key → override max for all passively-active charms
 * with abilityMaxOverride > 0. The charm's `ability` field identifies the target.
 * Takes the highest override for any given key.
 * @param {object} actor
 * @returns {object} map of { [abilityKey]: maxValue }
 */
export function aggregateAbilityMaxOverridesFromCharms(actor) {
  const overrides = {};
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const override = c.system?.abilityMaxOverride ?? 0;
    if (override <= 0) continue;
    const key = c.system?.ability;
    if (!key) continue;
    overrides[key] = Math.max(overrides[key] ?? 0, override);
  }
  return overrides;
}

/**
 * Returns true if any passively-active charm has harmImmaterial set.
 * Covers permanent/scene-duration charms (e.g. Lunar God-Cutting Essence).
 * Supplemental charms are checked separately via activatedCharmItems in rollAttack.
 * @param {object} actor
 * @returns {boolean}
 */
export function getHarmImmaterialFromCharms(actor) {
  return (actor.items ?? []).some(
    c => c.type === "charm" && isCharmPassivelyActive(c) && c.system?.harmImmaterial === true
  );
}

/**
 * Sum postSoakDamageReduction from all passively-active charms on the defender.
 * Applied by the Roll Damage handler to reduce the attacker's post-soak pool.
 * @param {object} actor
 * @returns {number}
 */
export function aggregatePostSoakDamageReductionFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.postSoakDamageReduction ?? 0;
  }
  return total;
}

/**
 * Sum minimumDamageReduction from all passively-active charms on the defender.
 * Reduces the attacker's minimum damage pool (clamped to 0), applied after soak.
 * @param {object} actor
 * @returns {number}
 */
export function aggregateMinimumDamageReductionFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.minimumDamageReduction ?? 0;
  }
  return total;
}

/**
 * Sum combatDiceBonus from all passively-active charms on the actor.
 * Adds flat dice to the attack roll pool.
 * @param {object} actor
 * @returns {number}
 */
export function aggregateCombatDiceBonusFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.combatDiceBonus ?? 0;
  }
  return total;
}

/**
 * Returns true if any passively-active charm on the actor has upgradeWeaponRange: true.
 * Suppresses the out-of-range abort so the attack can proceed at extended distance.
 * @param {object} actor
 * @returns {boolean}
 */
export function hasUpgradeWeaponRangeFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.upgradeWeaponRange === true) return true;
  }
  return false;
}

/**
 * Return the majesticResistanceType of the first passively-active charm that sets it.
 * Overrides the normal intent-based MDV selection in social attacks.
 * Values: "dodgelike" (force Dodge MDV) | "parrylike" (force Parry MDV) | null.
 * @param {object} actor
 * @returns {string|null}
 */
export function getMajesticResistanceTypeFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.majesticResistanceType) return c.system.majesticResistanceType;
  }
  return null;
}

/**
 * Returns the actor's Appearance rating if any passively-active charm
 * has addAppearanceDice: true, otherwise 0.
 * Adds Appearance to social roll pools.
 * @param {object} actor
 * @returns {number}
 */
export function getAddAppearanceDiceFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.addAppearanceDice === true) {
      return actor.system?.attributes?.appearance?.value ?? 0;
    }
  }
  return 0;
}

/**
 * Evaluate creatureOfDarknessRawDamageReduction formulas from all passively-active charms.
 * Reduces the attacker's raw damage pool when the attacker is a Creature of Darkness.
 * @param {object} actor - The DEFENDER
 * @param {object} rollData
 * @returns {number}
 */
export function aggregateCoDRawDamageReductionFromCharms(actor, rollData = {}) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const formula = c.system?.creatureOfDarknessRawDamageReduction;
    if (!formula) continue;
    total += (evaluateCharmFormula(formula, rollData, 0) | 0);
  }
  return total;
}

/**
 * Returns the total postSoakDamageReductionPerMote rate from all passively-active charms.
 * Rate = damage reduction per mote spent (e.g., 1 = spend 1 mote → 1 less post-soak damage).
 * @param {object} actor - The DEFENDER
 * @returns {number}
 */
export function getPostSoakDamageReductionPerMoteFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.postSoakDamageReductionPerMote ?? 0;
  }
  return total;
}

/**
 * Sum dvPenaltyReduction from all passively-active charms on the actor.
 * Applied as a flat reduction to the total DV penalty (all penalty types).
 * @param {object} actor
 * @returns {number}
 */
export function aggregateDVPenaltyReductionFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.dvPenaltyReduction ?? 0;
  }
  return total;
}

/**
 * Sum onslaughtPenaltyReduction from all passively-active charms on the actor.
 * Applied specifically to reduce onslaught-type DV penalties before summing.
 * @param {object} actor
 * @returns {number}
 */
export function aggregateOnslaughtPenaltyReductionFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.onslaughtPenaltyReduction ?? 0;
  }
  return total;
}

// M44 — Incoming attack dice penalty imposed on the attacker by the defender's passive charms.
export function aggregateIncomingAttackDicePenaltyFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.incomingAttackDicePenalty ?? 0;
  }
  return total;
}

// M49 — True if any passively-active charm routes onslaught stacks as DV penalties too.
export function hasOnslaughtToDVPenaltyFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.onslaughtToDVPenalty) return true;
  }
  return false;
}

// M50 — Returns {dodge, parry} booleans: true when any passively-active charm ignores that DV penalty track.
export function getDVPenaltyIgnoreFromCharms(actor) {
  let dodge = false;
  let parry = false;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.ignoreDVPenalties?.dodge) dodge = true;
    if (c.system?.ignoreDVPenalties?.parry) parry = true;
    if (dodge && parry) break;
  }
  return { dodge, parry };
}

// M51 — Sum of mentalDVBonus from all passively-active charms (adds to both dodge and parry MDV).
export function aggregateMentalDVBonusFromCharms(actor) {
  let total = 0;
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    total += c.system?.mentalDVBonus ?? 0;
  }
  return total;
}

// M52 — True if any passively-active charm grants shaping immunity.
export function hasShapingImmunityFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.shapingImmunity) return true;
  }
  return false;
}

// M53 — True if any activated charm forces knockdown on hit.
export function hasAutomaticKnockdownFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.automaticKnockdown) return true;
  }
  return false;
}

// M54 — True if any passively-active charm grants the ability to detect dematerialized spirits.
export function hasDetectDematerializedFromCharms(actor) {
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    if (c.system?.detectDematerialized) return true;
  }
  return false;
}
