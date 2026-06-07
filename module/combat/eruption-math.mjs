/** Sum a list of category values, treating negatives/NaN as 0. */
export function eruptionTotal(values) {
  return (values ?? []).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
}

/**
 * Whether a category step is allowed: the new value must stay within [0, 5],
 * and a positive step is blocked once the running total has reached `points`.
 */
export function canIncrementCategory(currentVal, step, totalUsed, points) {
  const newVal = currentVal + step;
  if (newVal < 0 || newVal > 5) return false;
  if (step > 0 && totalUsed >= points) return false;
  return true;
}
