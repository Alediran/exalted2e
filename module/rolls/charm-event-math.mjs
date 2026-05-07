// module/rolls/charm-event-math.mjs

/**
 * Return all enabled moteRecovery charms that fire on the given event.
 * @param {object[]} items
 * @param {"onDamageReceived"|"onKill"|"onAttackSuccess"} event
 * @returns {object[]}
 */
export function collectMoteRecoveryCharms(items, event) {
  return items.filter(c => {
    const mr = c?.system?.moteRecovery;
    return mr?.enabled && mr.event === event;
  });
}

/**
 * Return all enabled statusApply charms.
 * @param {object[]} items
 * @returns {object[]}
 */
export function collectStatusApplyCharms(items) {
  return items.filter(c => c?.system?.statusApply?.enabled);
}

/**
 * Return all enabled willpowerRecovery charms matching the given event.
 * @param {object[]} items
 * @param {string} event
 * @returns {object[]}
 */
export function collectWillpowerRecoveryCharms(items, event) {
  return items.filter(c => {
    const wr = c?.system?.willpowerRecovery;
    return wr?.enabled && wr.event === event;
  });
}

/**
 * Sum the target-penalty amounts across all enabled targetPenalty charms.
 * Amounts are negative integers; result is the total deduction.
 * @param {object[]} items
 * @returns {number} ≤ 0
 */
export function computeTargetPenaltyAmount(items) {
  let total = 0;
  for (const c of items) {
    const tp = c?.system?.targetPenalty;
    if (!tp?.enabled) continue;
    total += tp.amount ?? 0;
  }
  return Math.min(0, total);
}
