// module/rolls/charm-combat-math.mjs

/**
 * Aggregate attack bonuses from activated supplemental charms.
 * Formula fields (e.g. damageDice: "@ess") require Foundry's Roll.safeEval
 * and cannot be evaluated here. Non-integer values silently yield 0.
 * @param {object[]} charms
 * @param {object}  _rollData — reserved for future formula evaluation
 * @returns {{ extraAccuracyDice:number, extraAccuracySuccesses:number, extraDamageDice:number, ignorePenalties:boolean }}
 */
export function computeAttackCharmBonus(charms, _rollData) {
  let extraAccuracyDice = 0, extraAccuracySuccesses = 0, extraDamageDice = 0;
  let ignorePenalties = false;
  for (const c of charms) {
    const ab = c?.system?.attackBonus;
    if (!ab?.enabled) continue;
    extraAccuracyDice      += _parseIntField(ab.accuracyDice);
    extraAccuracySuccesses += _parseIntField(ab.accuracySuccesses);
    extraDamageDice        += _parseIntField(ab.damageDice);
    if (ab.ignoreAccuracyPenalties) ignorePenalties = true;
  }
  return { extraAccuracyDice, extraAccuracySuccesses, extraDamageDice, ignorePenalties };
}

/**
 * Compute effective weapon speed after applying all active speedModifier charms.
 * Result = clamp(baseSpeed + sum(deltas), max(minimums across active charms)).
 * @param {object[]} charms
 * @param {number} baseSpeed
 * @returns {number}
 */
export function computeSpeedModifier(charms, baseSpeed) {
  let totalDelta = 0, globalMin = 3; // 3 is the fastest legal weapon speed in 2e
  let anyEnabled = false;
  for (const c of charms) {
    const sm = c?.system?.speedModifier;
    if (!sm?.enabled) continue;
    anyEnabled = true;
    totalDelta += sm.delta ?? 0;
    globalMin = Math.max(globalMin, sm.minimum ?? 3);
  }
  if (!anyEnabled) return baseSpeed;
  return Math.max(globalMin, baseSpeed + totalDelta);
}

/**
 * Return the maximum number of extra actions granted by active extraActions charms.
 * Extra-action charms take the maximum, not sum (only one applies per action in 2e).
 * @param {object[]} charms
 * @param {object}  _rollData — reserved for formula evaluation
 * @returns {number}
 */
export function computeExtraActionsMax(charms, _rollData) {
  let max = 0;
  for (const c of charms) {
    const ea = c?.system?.extraActions;
    if (!ea?.enabled) continue;
    const n = _parseIntField(ea.maxFormula);
    if (n > max) max = n;
  }
  return max;
}

/** Parse plain-integer string. Returns 0 for formula tokens or empty values. */
function _parseIntField(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  const s = String(raw).trim();
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return 0;
}
