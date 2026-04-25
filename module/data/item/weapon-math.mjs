/**
 * Wielder-shortfall dice penalty for a weapon mode.
 *
 * A weapon mode lists minimum Strength / Dexterity / Martial Arts dots.
 * Every dot the wielder is missing accumulates as a one-die penalty
 * applied to Speed (slower), Accuracy (less precise), and Defense (less
 * stable). Damage is unaffected — even a weakling can swing for full
 * damage if the blow lands.
 *
 * Returns the total missing dots across all three minimums (≥ 0).
 *
 * @param {object} mode - Weapon mode `{minStrength, minDexterity, minMartialArts}`
 * @param {object} wielderStats - `{strength, dexterity, martialArts}` (zero defaults)
 * @returns {number} Non-negative dot shortfall
 */
export function computeWielderPenalty(mode, wielderStats) {
  const m = mode ?? {};
  const w = wielderStats ?? {};
  const str = Number(w.strength)     || 0;
  const dex = Number(w.dexterity)    || 0;
  const ma  = Number(w.martialArts)  || 0;
  return Math.max(0, (m.minStrength    ?? 0) - str)
       + Math.max(0, (m.minDexterity   ?? 0) - dex)
       + Math.max(0, (m.minMartialArts ?? 0) - ma);
}
