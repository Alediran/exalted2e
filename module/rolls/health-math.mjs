/**
 * Wound-penalty resolver.
 *
 * Given the number of filled health boxes and the per-level box counts
 * `{zero, one, two}` (typically `health.levelCounts` from CharacterData),
 * returns the penalty of the most-recently-filled box:
 *   - 0 when no -1+ box is filled
 *   - -1 when the -1 row has at least one filled box
 *   - -2 when the -2 row has at least one filled box
 *   - -4 when the -4 row has at least one filled box
 *   - null when the Incapacitated row is filled (i.e., the character is incap)
 *
 * -4 and Incap are always single-box rows regardless of bonus; -0 / -1 / -2
 * accept bonus boxes via the `levelCounts` widths. Rows widen with bonuses.
 *
 * @param {number} filled - Number of filled boxes (clamped at totalBoxes by caller)
 * @param {{zero: number, one: number, two: number}} levelCounts - Per-level widths
 * @returns {0 | -1 | -2 | -4 | null}
 */
export function computeWoundPenalty(filled, levelCounts) {
  const { zero = 0, one = 0, two = 0 } = levelCounts ?? {};
  if (filled > zero + one + two + 1) return null;   // Incap
  if (filled > zero + one + two)     return -4;
  if (filled > zero + one)           return -2;
  if (filled > zero)                 return -1;
  return 0;
}

/**
 * Apply `amount` of `type` damage to a health object, clamping total damage
 * at `totalBoxes`. Returns a fresh health object; does not mutate the input.
 *
 * If adding `amount` pushes total damage past `totalBoxes`, the excess is
 * subtracted from the incoming `type` column (so you can't gain aggravated
 * overflow by taking bashing while already maxed out on lethal).
 *
 * Accepts `amount` in either sign: positive for damage, negative values are
 * floored at zero per-column (matches the pre-extract `applyDamage`
 * `Math.max(0, h[type] + amount)` semantic).
 *
 * @param {{bashing: number, lethal: number, aggravated: number, bonus?: object}} health
 * @param {"bashing"|"lethal"|"aggravated"} type
 * @param {number} amount
 * @param {number} totalBoxes
 * @returns {object} fresh health object
 */
export function clampDamage(health, type, amount, totalBoxes) {
  const h = { ...(health ?? {}) };
  // Preserve the bonus subobject by reference — it's read, not written.
  h[type] = Math.max(0, (h[type] ?? 0) + amount);
  const totalDmg = (h.aggravated ?? 0) + (h.lethal ?? 0) + (h.bashing ?? 0);
  if (totalDmg > totalBoxes) {
    const excess = totalDmg - totalBoxes;
    h[type] = Math.max(0, h[type] - excess);
  }
  return h;
}

/**
 * Heal damage in priority order: bashing → lethal → aggravated. Any amount
 * that can't be consumed by a column cascades to the next. Returns a fresh
 * health object; does not mutate the input.
 *
 * @param {{bashing: number, lethal: number, aggravated: number, bonus?: object}} health
 * @param {number} amount - Non-negative amount to heal
 * @returns {object} fresh health object
 */
export function healInOrder(health, amount) {
  const h = { ...(health ?? {}) };
  let remaining = Math.max(0, Number(amount) || 0);
  for (const type of ["bashing", "lethal", "aggravated"]) {
    const heal = Math.min(h[type] ?? 0, remaining);
    h[type] = (h[type] ?? 0) - heal;
    remaining -= heal;
  }
  return h;
}
