// module/rolls/charm-combat-math.mjs
import { evaluateCharmFormula } from '../documents/item.mjs';

/**
 * Aggregate attack bonuses from activated supplemental charms.
 * Formula fields (e.g. damageDice: "@ess") are evaluated via evaluateCharmFormula.
 * Pass actor.getRollData() as rollData to resolve stat tokens.
 * @param {object[]} charms
 * @param {object}   rollData — actor roll-data for formula evaluation; pass {} if unavailable
 * @returns {{ extraAccuracyDice:number, extraAccuracySuccesses:number, extraDamageDice:number, ignorePenalties:boolean }}
 */
export function computeAttackCharmBonus(charms, rollData = {}) {
  let extraAccuracyDice = 0, extraAccuracySuccesses = 0, extraDamageDice = 0;
  let ignorePenalties = false;
  for (const c of charms) {
    const ab = c?.system?.attackBonus;
    if (!ab?.enabled) continue;
    extraAccuracyDice      += evaluateCharmFormula(ab.accuracyDice,      rollData, 0) | 0;
    extraAccuracySuccesses += evaluateCharmFormula(ab.accuracySuccesses,  rollData, 0) | 0;
    extraDamageDice        += evaluateCharmFormula(ab.damageDice,         rollData, 0) | 0;
    if (ab.ignoreAccuracyPenalties) ignorePenalties = true;
  }
  return { extraAccuracyDice, extraAccuracySuccesses, extraDamageDice, ignorePenalties };
}

/**
 * Compute effective weapon speed after applying all active speedModifier charms.
 * Result = clamp(baseSpeed + sum(deltas), max(minimums across active charms)).
 * @param {object[]} charms
 * @param {number}   baseSpeed
 * @param {object}   rollData — actor roll-data for formula evaluation; pass {} if unavailable
 * @returns {number}
 */
export function computeSpeedModifier(charms, baseSpeed, rollData = {}) {
  let totalDelta = 0, globalMin = 3; // 3 is the fastest legal weapon speed in 2e
  let anyEnabled = false;
  for (const c of charms) {
    const sm = c?.system?.speedModifier;
    if (!sm?.enabled) continue;
    anyEnabled = true;
    const delta = sm.deltaFormula
      ? evaluateCharmFormula(sm.deltaFormula, rollData, sm.delta ?? 0)
      : (sm.delta ?? 0);
    totalDelta += delta;
    globalMin = Math.max(globalMin, sm.minimum ?? 3);
  }
  if (!anyEnabled) return baseSpeed;
  return Math.floor(Math.max(globalMin, baseSpeed + totalDelta));
}

/**
 * Return the maximum number of extra actions granted by active extraActions charms.
 * Extra-action charms take the maximum, not sum (only one applies per action in 2e).
 * @param {object[]} charms
 * @param {object}   rollData — actor roll-data for formula evaluation; pass {} if unavailable
 * @returns {number}
 */
export function computeExtraActionsMax(charms, rollData = {}) {
  let max = 0;
  for (const c of charms) {
    const ea = c?.system?.extraActions;
    if (!ea?.enabled) continue;
    const n = evaluateCharmFormula(ea.maxFormula, rollData, 0) | 0;
    if (n > max) max = n;
  }
  return max;
}
