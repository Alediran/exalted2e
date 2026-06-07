/** Astrology prayer: every 4 successes grants a bonus effect die. */
export function prayerBonusDice(successes) {
  return Math.ceil((successes ?? 0) / 4);
}

/** Destiny effect-roll pool: Essence + college dots + prayer bonus dice. */
export function destinyEffectPool(essenceVal, collegeDots, bonusDice) {
  return (essenceVal ?? 0) + (collegeDots ?? 0) + (bonusDice ?? 0);
}

/**
 * Map a destiny config entry (providence/trigger/scope/duration/frequency) to a
 * typed sheet option. Numeric-string keys become numbers. `localize` resolves
 * the entry's labelKey.
 */
export function normalizeDestinyOption(key, entry, localize) {
  return {
    key:            isNaN(key) ? key : Number(key),
    label:          localize(entry.labelKey),
    paradoxDice:    entry.paradoxDice ?? 0,
    effectPoints:   entry.effectPoints ?? 0,
    invitesCensure: !!entry.invitesCensure,
  };
}

/** Paradox accrual, capped at `max` (default 10). */
export function clampParadox(current, gained, max = 10) {
  return Math.min(max, (current ?? 0) + (gained ?? 0));
}
