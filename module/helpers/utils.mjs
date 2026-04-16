/**
 * Utility helpers for the Exalted 2e system.
 */

/**
 * Returns the wound penalty for a given damage state.
 * @param {number} filled  - Number of filled health boxes
 * @param {number} total   - Total number of health boxes
 * @returns {number|null}  - Wound penalty (null = incapacitated)
 */
export function getWoundPenalty(filled, total) {
  if (filled >= total) return null;
  const penalties = [0, -1, -1, -2, -2, -4, null];
  return penalties[Math.min(filled, 6)] ?? null;
}

/**
 * Calculate Solar mote pools from essence and willpower.
 */
export function calcSolarMotes(essence, willpower, highestVirtue) {
  return {
    personal:   essence * 3 + willpower,
    peripheral: essence * 7 + willpower + highestVirtue * 4
  };
}

/**
 * Returns the castes available for the given exalt type.
 */
export function getCastesForType(exaltType) {
  const { EX2E } = game.exalted2e ?? {};
  if (!EX2E) return {};
  return EX2E.castes[exaltType] ?? {};
}

/**
 * Truncates a string to a maximum length with ellipsis.
 */
export function truncate(str, length = 30) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length - 1) + "…" : str;
}

/**
 * Converts a camelCase key to a title-cased display label.
 * e.g. "martialArts" → "Martial Arts"
 */
export function camelToTitle(str) {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase());
}
