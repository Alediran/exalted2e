/**
 * Scale a Token Magic FX preset's params by a tier scalar. Strength/intensity
 * fields multiply; padding multiplies then rounds. Fields absent on a param
 * are left absent. Returns new objects (input is not mutated).
 */
export function scaleTmfxParams(params, scalar) {
  return (params ?? []).map(p => {
    const out = { ...p };
    if (p.outerStrength    !== undefined) out.outerStrength    = p.outerStrength    * scalar;
    if (p.innerStrength    !== undefined) out.innerStrength    = p.innerStrength    * scalar;
    if (p.auraIntensity    !== undefined) out.auraIntensity    = p.auraIntensity    * scalar;
    if (p.subAuraIntensity !== undefined) out.subAuraIntensity = p.subAuraIntensity * scalar;
    if (p.padding          !== undefined) out.padding          = Math.round(p.padding * scalar);
    return out;
  });
}

/**
 * Deterministic identity key for a filter's params: JSON of its entries,
 * excluding the keys in `excludeKeys` (and `filterId`), sorted by key name.
 */
export function makeFilterParamsKey(p, excludeKeys = new Set()) {
  return JSON.stringify(
    Object.entries(p)
      .filter(([k]) => !excludeKeys.has(k) && k !== "filterId")
      .sort(([a], [b]) => a.localeCompare(b))
  );
}
