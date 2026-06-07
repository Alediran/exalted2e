import { actorNeedsUnarmed, assignCharmUid, assignSpellUid, defaultMakeId } from "./transforms.mjs";

/**
 * Ordered, forward-only migration registry. Each entry is tagged with the
 * system version it ships in. `actor`/`item` are optional pure step functions:
 *   actor(actorSource) -> { createUnarmed?: true } | null
 *   item(itemSource, makeId) -> updateObject | null
 * The runner applies them across world actors (+ owned items), world items,
 * unlinked token actors, and world compendium packs.
 */
export const MIGRATIONS = [
  {
    version: "1.1.0",
    message: "Back-fill unarmed weapons and assign charm/spell UIDs",
    actor(actorSource) {
      return actorNeedsUnarmed(actorSource) ? { createUnarmed: true } : null;
    },
    item(itemSource, makeId = defaultMakeId) {
      return assignCharmUid(itemSource, makeId) ?? assignSpellUid(itemSource, makeId);
    },
  },
];
