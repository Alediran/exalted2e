import { evaluateCharmFormula } from "../documents/item.mjs";

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
 * @returns {{ amount: number, pool: string }|null}
 */
export function getEssenceDrainFromCharms(actor) {
  const rollData = actor.getRollData?.() ?? {};
  for (const c of (actor.items ?? [])) {
    if (c.type !== "charm" || !isCharmPassivelyActive(c)) continue;
    const ed = c.system?.essenceDrain;
    if (!ed?.enabled || !ed.formula) continue;
    const amount = (evaluateCharmFormula(ed.formula, rollData, 0) | 0);
    if (amount <= 0) continue;
    return { amount, pool: ed.pool ?? "peripheral" };
  }
  return null;
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
