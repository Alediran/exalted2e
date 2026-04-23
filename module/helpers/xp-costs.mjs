/**
 * Compute the XP cost for a trait change on a given actor.
 *
 * This is the stable seam between Purchase Mode (the enforcement + UI
 * layer that ships now) and the XP Cost Engine (Spec 2, not yet written
 * — see docs/superpowers/specs/2026-04-23-xp-cost-engine-design.md).
 *
 * Spec 1 ships with the stub below: returns { xp: 0, confident: false }
 * for every change, which forces the GM to type the cost manually in the
 * Purchase-confirm dialog. Spec 2 will replace the body of this function
 * with per-exalt rule tables and favored/caste logic; the return shape
 * does NOT change, so Purchase Mode consumers keep working as-is.
 *
 * @param {Actor} actor
 *   The character being changed.
 * @param {object} change
 *   Description of the change.
 * @param {"field"|"item"} change.kind
 *   Schema field vs embedded item.
 * @param {string} change.path
 *   Dot-path for field changes (e.g. "system.abilities.melee.value")
 *   OR "item:<type>" pseudo-path for item changes
 *   (e.g. "item:charm", "item:spell", "item:knack", "item:background").
 * @param {number|null} change.oldValue
 *   Pre-change numeric value. `null` for item additions.
 * @param {number|null} change.newValue
 *   Post-change numeric value. `null` for item removals (which
 *   Purchase Mode blocks outright — this path isn't exercised today).
 * @param {Item} [change.item]
 *   For item-kind changes, the item being added.
 * @returns {{ xp: number, confident: boolean, description: string }}
 *   - `xp`          non-negative integer, best-effort cost (0 when the
 *                   stub is unsure — Spec 2 will return real values).
 *   - `confident`   true when the stub is certain. Always false in the
 *                   stub; Spec 2 will flip to true where the rule is
 *                   unambiguous.
 *   - `description` short human-readable label, e.g. "charm: Excellent
 *                   Strike" or "system.abilities.melee.value 3→4".
 *                   Safe to use even after Spec 2 lands.
 */
export function computeXpCost(actor, change) {
  return {
    xp:          0,
    confident:   false,
    description: _describeChange(change)
  };
}

function _describeChange(change) {
  if (change.kind === "item" && change.item) {
    return `${change.item.type}: ${change.item.name}`;
  }
  const delta = change.oldValue != null ? ` ${change.oldValue}→${change.newValue}` : "";
  return `${change.path}${delta}`;
}
