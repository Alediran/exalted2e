// module/rolls/charm-combat-math.mjs
import { evaluateCharmFormula } from '../documents/item.mjs';

/**
 * Aggregate attack bonuses from activated supplemental charms.
 * Formula fields (e.g. damageDice: "@ess") are evaluated via evaluateCharmFormula.
 * Per-mote fields are pre-scaled by resolvedUnits before being passed in — the
 * caller (rollAttack) handles that multiplication; this function just sums.
 * Pass actor.getRollData() as rollData to resolve stat tokens.
 * @param {object[]} charms
 * @param {object}   rollData — actor roll-data for formula evaluation; pass {} if unavailable
 * @returns {{ extraAccuracyDice:number, extraAccuracySuccesses:number, extraDamageDice:number, extraPostSoakDamageDice:number, ignorePenalties:boolean, ignoreRangeBand:boolean }}
 */
export function computeAttackCharmBonus(charms, rollData = {}) {
  let extraAccuracyDice = 0, extraAccuracySuccesses = 0, extraDamageDice = 0;
  let extraPostSoakDamageDice = 0;
  let ignorePenalties = false;
  let ignoreRangeBand = false;
  for (const c of charms) {
    const ab = c?.system?.attackBonus;
    if (!ab?.enabled) continue;
    extraAccuracyDice       += evaluateCharmFormula(ab.accuracyDice,       rollData, 0) | 0;
    extraAccuracySuccesses  += evaluateCharmFormula(ab.accuracySuccesses,   rollData, 0) | 0;
    extraDamageDice         += evaluateCharmFormula(ab.damageDice,          rollData, 0) | 0;
    extraPostSoakDamageDice += evaluateCharmFormula(ab.postSoakDamageDice,  rollData, 0) | 0;
    if (ab.ignoreAccuracyPenalties) ignorePenalties = true;
    if (ab.ignoreRangeBand)         ignoreRangeBand = true;
  }
  return { extraAccuracyDice, extraAccuracySuccesses, extraDamageDice, extraPostSoakDamageDice, ignorePenalties, ignoreRangeBand };
}

