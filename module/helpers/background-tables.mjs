/** Clamp a Background rating to the legal 0..5 range. */
export function clampBackgroundRating(value) {
  return Math.max(0, Math.min(5, Number(value) || 0));
}

/** Read a per-rating background table (cult mote-regen, command war-dice, …) at a clamped rating; missing → 0. */
export function lookupBackgroundTableValue(rating, table) {
  return (table ?? {})[clampBackgroundRating(rating)] ?? 0;
}
