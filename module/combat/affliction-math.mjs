/** Leading integer of a free-text damage string (e.g. "3 lethal" -> 3); else 0. */
export function parseAfflictionDamage(str) {
  const n = parseInt(str, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

/** Net poison damage after resistance successes, floored at 0. */
export function poisonNetDamage(damageValue, resistanceSuccesses) {
  return Math.max(0, (parseInt(damageValue) || 0) - (parseInt(resistanceSuccesses) || 0));
}
