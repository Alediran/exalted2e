/** Astrology prayer: every 4 successes grants a bonus effect die. */
export function prayerBonusDice(successes) {
  return Math.ceil((successes ?? 0) / 4);
}

/** Destiny effect-roll pool: Essence + college dots + prayer bonus dice. */
export function destinyEffectPool(essenceVal, collegeDots, bonusDice) {
  return (essenceVal ?? 0) + (collegeDots ?? 0) + (bonusDice ?? 0);
}
