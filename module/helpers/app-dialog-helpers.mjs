/**
 * Pure helpers extracted from the module/apps dialogs so the small in-dialog
 * logic is unit-testable. Foundry-free; i18n via injected `localize`.
 */

/**
 * Rally:Numbers eligibility — true when some OTHER unit combatant has dropped
 * below the magnitude it had at join-war and is still above mine.
 */
export function isNumbersEligible(myId, myMagnitude, combatants) {
  for (const combatant of (combatants ?? [])) {
    const actor = combatant.actor;
    if (!actor || actor.id === myId || actor.type !== "unit") continue;
    const joinMag = combatant.flags?.exalted2e?.magnitudeAtJoinWar ?? null;
    const curMag  = actor.system.magnitude.value;
    if (joinMag !== null && joinMag > curMag && curMag > myMagnitude) return true;
  }
  return false;
}

const FORMATION_MIN_DRILL = { none: 99, unordered: 1, skirmish: 2, relaxed: 2, close: 3 };

/** Formation choice list for a unit's drill rating; `current` flags the active one. `localize(fullKey)`. */
export function buildFormationOptions(drill, currentFormation, localize) {
  return ["none", "unordered", "skirmish", "relaxed", "close"]
    .filter(k => drill >= (FORMATION_MIN_DRILL[k] ?? Infinity))
    .map(k => ({
      value:   k,
      label:   localize(`EX2E.Formation${k.charAt(0).toUpperCase() + k.slice(1)}`),
      current: k === currentFormation,
    }));
}

/** Hero mass-combat weapon display rows, filtered by ranged/melee. */
export function buildHeroWeaponRows(weapons, ranged, selectedWeaponId) {
  return (weapons ?? [])
    .filter(w => ranged ? w.system.ranged : !w.system.ranged)
    .map(w => ({
      id:       w.id,
      name:     w.name,
      ability:  w.system.ability ?? "melee",
      damage:   w.system.damage  ?? 0,
      selected: w.id === selectedWeaponId,
    }));
}

/** Parse a manual join-war tick input → non-negative number, or null when blank/NaN. */
export function parseManualTick(raw) {
  if (raw === "" || raw == null) return null;
  if (Number.isNaN(Number(raw))) return null;
  return Math.max(0, Number(raw));
}

/**
 * Parse a tier-selection dropdown value against the active tier list.
 * "standard"/blank/NaN/out-of-bounds → `{ standard: true }`; "tier_N" → `{ standard:false, tier: active[N] }`.
 */
export function parseTierSelection(val, active) {
  if (!val || val === "standard") return { standard: true };
  const idx = parseInt(String(val).replace("tier_", ""), 10);
  if (isNaN(idx) || idx < 0 || idx >= (active?.length ?? 0)) return { standard: true };
  return { standard: false, tier: active[idx] };
}
