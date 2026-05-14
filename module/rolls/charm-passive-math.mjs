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
  const charm = actor.items?.find(
    c => c.type === "charm"
      && c.system?.grantsMastery
      && c.system?.ability === ability
      && isCharmPassivelyActive(c)
  );
  if (!charm) return { first: 0, second: 0 };
  return {
    first:  Math.floor((charm.system.masteryCommitment?.first  ?? 0) / 2),
    second: Math.floor((charm.system.masteryCommitment?.second ?? 0) / 2),
  };
}
