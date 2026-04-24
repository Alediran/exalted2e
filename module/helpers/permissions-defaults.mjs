// module/helpers/permissions-defaults.mjs

/**
 * Default permission thresholds for EX2E gated actions.
 *
 * Each key maps to a minimum `CONST.USER_ROLES` value the user must hold
 * for the helper `ex2eCan(key)` to return true. Defaults exactly reproduce
 * the previously hardcoded behavior, so a world with no stored override
 * behaves the same as before this feature landed.
 *
 *   combatFlow       — advance tick, end combat, Begin Encounter, manual DV resolve
 *   purchaseMode     — toggle Purchase Mode, edit Current/Total XP,
 *                      edit/delete purchase-log rows
 *   protectedEffects — delete ActiveEffects flagged `gmOnlyRemoval`
 */
export const PERMISSION_DEFAULTS = Object.freeze({
  combatFlow:       CONST.USER_ROLES.GAMEMASTER, // 4
  purchaseMode:     CONST.USER_ROLES.ASSISTANT,  // 3
  protectedEffects: CONST.USER_ROLES.GAMEMASTER  // 4
});

/**
 * Row order for the configuration dialog. Kept separate so the dialog
 * doesn't have to enumerate the defaults object directly (and so any
 * future key that's defined but not displayed can be opted out here).
 */
export const PERMISSION_KEY_ORDER = Object.freeze([
  "combatFlow",
  "purchaseMode",
  "protectedEffects"
]);

/**
 * Deep-clone the defaults and overlay numeric overrides from a stored
 * settings object. Non-finite / null / empty values fall back to defaults,
 * so a partial override is fine. Never mutates the defaults.
 *
 * @param {object|null} overrides  raw object read from game.settings
 * @returns {object}               resolved map with the same shape as PERMISSION_DEFAULTS
 */
export function resolvePermissions(overrides) {
  const out = foundry.utils.deepClone(PERMISSION_DEFAULTS);
  if (!overrides || typeof overrides !== "object") return out;
  for (const key of Object.keys(out)) {
    const raw = overrides[key];
    if (raw === "" || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}
