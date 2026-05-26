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
 * @returns {{ extraAccuracyDice:number, extraAccuracySuccesses:number, extraDamageDice:number, extraPostSoakDamageDice:number, ignorePenalties:boolean, ignoreRangeBand:boolean, soakPiercing:number, ignoresArmor:boolean }}
 */
export function computeAttackCharmBonus(charms, rollData = {}) {
  let extraAccuracyDice = 0, extraAccuracySuccesses = 0, extraDamageDice = 0;
  let extraPostSoakDamageDice = 0;
  let ignorePenalties = false;
  let ignoreRangeBand = false;
  let soakPiercing    = 0;
  let ignoresArmor    = false;
  for (const c of charms) {
    const synthAE = c.actor?.effects?.find(
      e => !e.disabled && e.flags?.exalted2e?.charmSource === c.id && e.flags?.exalted2e?.synthAE
    );
    const ab = synthAE?.flags?.exalted2e?.tierAttackBonus ?? c?.system?.attackBonus;
    if (!ab?.enabled) continue;
    const charmRollData = { ...rollData, purchaseLevel: c.system?.purchaseLevel ?? 1 };
    extraAccuracyDice       += evaluateCharmFormula(ab.accuracyDice,       charmRollData, 0) | 0;
    extraAccuracySuccesses  += evaluateCharmFormula(ab.accuracySuccesses,   charmRollData, 0) | 0;
    extraDamageDice         += evaluateCharmFormula(ab.damageDice,          charmRollData, 0) | 0;
    extraPostSoakDamageDice += evaluateCharmFormula(ab.postSoakDamageDice,  charmRollData, 0) | 0;
    if (ab.ignoreAccuracyPenalties) ignorePenalties = true;
    if (ab.ignoreRangeBand)         ignoreRangeBand = true;
    soakPiercing += ab.soakPiercing ?? 0;
    if (ab.ignoresArmor)            ignoresArmor    = true;
  }
  return { extraAccuracyDice, extraAccuracySuccesses, extraDamageDice, extraPostSoakDamageDice, ignorePenalties, ignoreRangeBand, soakPiercing, ignoresArmor };
}

/**
 * Aggregate social attack bonuses from activated supplemental charms.
 * Formula fields are evaluated via evaluateCharmFormula.
 * poolDicePerMote fields are scaled by resolvedUnits (set by mote slider
 * during activation). Pass actor.getRollData() as rollData.
 * @param {object[]} charms
 * @param {object}   rollData
 * @returns {{ poolDice:number, poolSuccesses:number, ignorePenalties:boolean }}
 */
export function computeSocialCharmBonus(charms, rollData = {}) {
  let poolDice = 0, poolSuccesses = 0, ignorePenalties = false;
  for (const c of charms) {
    const sb = c?.system?.socialBonus;
    if (!sb?.enabled) continue;
    const units = c.system?.resolvedUnits ?? 1;
    poolDice      += (evaluateCharmFormula(sb.poolDice,      rollData, 0) | 0)
                     * (sb.poolDicePerMote ? units : 1);
    poolSuccesses += (evaluateCharmFormula(sb.poolSuccesses, rollData, 0) | 0);
    if (sb.ignorePenalties) ignorePenalties = true;
  }
  return { poolDice, poolSuccesses, ignorePenalties };
}

