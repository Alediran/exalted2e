/**
 * Pure migration transforms — no Foundry dependencies. Each takes plain
 * document source data (a live Actor/Item document works too: property access
 * is identical) and returns a minimal update object, or null/false when nothing
 * changes, so the runner can skip the write. ID generation is injected so tests
 * are deterministic.
 */

/** Fallback random id used when foundry.utils.randomID is unavailable (Vitest). */
function _fallbackId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Default id generator: real Foundry randomID in-world, fallback in tests. */
export function defaultMakeId() {
  return globalThis.foundry?.utils?.randomID?.() ?? _fallbackId();
}

/**
 * True when a character actor lacks its unarmed natural-attack weapon.
 * Mirrors the legacy _hasUnarmedWeapon check, expressed against source data.
 */
export function actorNeedsUnarmed(actorSource) {
  if (actorSource?.type !== "character") return false;
  const items = actorSource.items ?? [];
  const has = Array.from(items).some(i =>
    i?.type === "weapon" && i?.flags?.exalted2e?.unarmed === true);
  return !has;
}

/** Returns a charmUid update for a charm item missing one, else null. */
export function assignCharmUid(itemSource, makeId = defaultMakeId) {
  if (itemSource?.type !== "charm") return null;
  if (itemSource?.system?.charmUid) return null;
  return { "system.charmUid": makeId() };
}

/** Returns a spellUid update for a spell item missing one, else null. */
export function assignSpellUid(itemSource, makeId = defaultMakeId) {
  if (itemSource?.type !== "spell") return null;
  if (itemSource?.system?.spellUid) return null;
  return { "system.spellUid": makeId() };
}
