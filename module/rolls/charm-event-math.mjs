// module/rolls/charm-event-math.mjs
import { evaluateCharmFormula } from '../documents/item.mjs';

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
 * @param {object}   [rollData={}] — actor roll-data for formula evaluation
 * @returns {number} ≤ 0
 */
export function computeTargetPenaltyAmount(items, rollData = {}) {
  let total = 0;
  for (const c of items) {
    const tp = c?.system?.targetPenalty;
    if (!tp?.enabled) continue;
    const pl = c.system?.purchaseLevel ?? 1;
    const charmRollData = { ...rollData, purchaseLevel: pl };
    const amount = tp.amountFormula
      ? evaluateCharmFormula(tp.amountFormula, charmRollData, tp.amount ?? 0)
      : (tp.amount ?? 0);
    total += amount;
  }
  return Math.min(0, total);
}

export const SCOPE_TO_TYPE = {
  all:                "all",
  physicalAttributes: "physical",
  socialRolls:        "social",
  attackRolls:        "attack",
};

/**
 * Return one { type, value, label, duration } entry per enabled targetPenalty charm.
 * Respects scope → internal-penalty-type mapping and amountFormula evaluation.
 * @param {object[]} items
 * @param {object}   [rollData={}]
 * @returns {{ type: string, value: number, label: string, duration: string }[]}
 */
export function getTargetPenaltyChanges(items, rollData = {}) {
  const changes = [];
  for (const c of items) {
    const tp = c?.system?.targetPenalty;
    if (!tp?.enabled) continue;
    const pl = c.system?.purchaseLevel ?? 1;
    const charmRollData = { ...rollData, purchaseLevel: pl };
    const rawAmount = tp.amountFormula
      ? evaluateCharmFormula(tp.amountFormula, charmRollData, tp.amount ?? 0)
      : (tp.amount ?? 0);
    const value = Math.abs(Math.min(0, rawAmount)) * pl;
    if (value <= 0) continue;
    changes.push({
      type:     SCOPE_TO_TYPE[tp.scope] ?? "all",
      value,
      label:    c.name ?? "Charm Penalty",
      duration: tp.duration ?? "oneScene",
    });
  }
  return changes;
}
