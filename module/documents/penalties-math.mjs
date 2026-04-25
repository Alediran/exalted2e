/**
 * Aggregate penalty entries from an ActiveEffect collection.
 *
 * Walks the collection, skips disabled effects, picks up effects whose
 * `flags.exalted2e[flagKey]` is shaped `{type: string, value: number}`,
 * and returns an array of `{type, value, effectId, label}` rows.
 *
 * Used by `_aggregateDVPenalties` (flagKey `"dvPenalty"`) and
 * `_aggregateMDVPenalties` (flagKey `"mdvPenalty"`).
 *
 * @param {Iterable<{disabled?: boolean, id?: string, name?: string, flags?: object}>} effects
 * @param {string} flagKey
 * @returns {Array<{type: string, value: number, effectId: string, label: string}>}
 */
export function aggregatePenalties(effects, flagKey) {
  const out = [];
  for (const eff of effects ?? []) {
    if (eff.disabled) continue;
    const p = eff.flags?.exalted2e?.[flagKey];
    // Number.isFinite rejects NaN and ±Infinity — both would propagate
    // garbage through `dvPenaltyTotal` / `mdvPenaltyTotal` if accepted.
    // Matches the filter used by `sumPenalties` below.
    if (!p || !Number.isFinite(p.value) || !p.type) continue;
    out.push({ type: p.type, value: p.value, effectId: eff.id, label: eff.name });
  }
  return out;
}

/**
 * Sum penalty values for a given action category.
 *
 * Walks the effects, skips disabled ones, picks up effects whose
 * `flags.exalted2e[flagKey]` is `{type, value}` with a finite numeric
 * value, and accumulates the value when `type === category` or
 * `type === "all"`.
 *
 * Used by `externalPenaltyFor` (flagKey `"externalPenalty"`) and
 * `internalPenaltyFor` (flagKey `"internalPenalty"`).
 *
 * @param {Iterable<{disabled?: boolean, flags?: object}>} effects
 * @param {string} flagKey
 * @param {string} category - "physical" | "social" | "mental" | other
 * @returns {number}
 */
export function sumPenalties(effects, flagKey, category) {
  let total = 0;
  for (const eff of effects ?? []) {
    if (eff.disabled) continue;
    const p = eff.flags?.exalted2e?.[flagKey];
    if (!p || !Number.isFinite(p.value)) continue;
    if (p.type !== "all" && p.type !== category) continue;
    total += p.value;
  }
  return total;
}
