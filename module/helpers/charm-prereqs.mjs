/**
 * Charm prerequisite validation.
 *
 * Each charm has `system.prereqGroups`, an array of AND-ed requirement
 * groups. Within a group, alternatives OR together — so one satisfied
 * alternative satisfies its group, and all groups must be satisfied for
 * the charm's prerequisites to be met overall.
 *
 * Alternative types:
 *   • charm          — matches an owned charm whose name equals
 *                      `alt.charmName` (case-insensitive, trimmed).
 *   • anyExcellency  — matches any owned charm whose `excellency` is
 *                      first/second/third AND whose `ability` equals the
 *                      hosting charm's `ability` field (works for both
 *                      ability-keyed and attribute-keyed excellencies —
 *                      CharmData stores the key in `ability` for both).
 *
 * Charm-without-an-actor (compendium view, unowned item) cannot be
 * validated; the matrix returns an empty array for those.
 */

const EXCELLENCY_TIERS = new Set(["first", "second", "third"]);

function _norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Decide whether a single alternative is satisfied by an actor's owned
 * charms. Excludes the hosting charm from the pool (a charm cannot be its
 * own prerequisite, and in practice its name would satisfy itself).
 */
function _altSatisfied(alt, hostCharm, ownedCharms) {
  if (alt.type === "charm") {
    const want = _norm(alt.charmName);
    if (!want) return false;
    return ownedCharms.some(c => _norm(c.name) === want);
  }
  if (alt.type === "anyExcellency") {
    const hostAbility = _norm(hostCharm.system?.ability);
    if (!hostAbility) return false;
    return ownedCharms.some(c =>
      EXCELLENCY_TIERS.has(c.system?.excellency ?? "")
      && _norm(c.system?.ability) === hostAbility
    );
  }
  return false;
}

/**
 * Evaluate every prerequisite group on a charm against its owning actor.
 * Returns a flat array of `{ group, index, satisfied, label }` so callers
 * can both compute an overall pass/fail (all `satisfied`) and render a
 * group-by-group breakdown in tooltips.
 *
 * @param {Item}  charm  The charm being checked.
 * @param {Actor} actor  The owning actor; if null, returns an empty array.
 * @returns {Array<{group: object, index: number, satisfied: boolean, label: string}>}
 */
export function evaluateCharmPrereqs(charm, actor) {
  if (!actor) return [];
  const groups = charm.system?.prereqGroups ?? [];
  if (groups.length === 0) return [];
  const ownedCharms = actor.items.filter(i => i.type === "charm" && i.id !== charm.id);
  return groups.map((group, index) => {
    const alts = group.alternatives ?? [];
    const satisfied = alts.some(alt => _altSatisfied(alt, charm, ownedCharms));
    return { group, index, satisfied, label: describeGroup(group) };
  });
}

/** Convenience: true iff every group has a satisfying alternative. */
export function areCharmPrereqsMet(charm, actor) {
  const report = evaluateCharmPrereqs(charm, actor);
  if (report.length === 0) return true;
  return report.every(r => r.satisfied);
}

/**
 * Human-readable description of a single group. "X or Y or Z" for OR
 * groups; a bare name for singletons.
 */
export function describeGroup(group) {
  const alts = group?.alternatives ?? [];
  const parts = alts.map(_altLabel).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.join(` ${game.i18n.localize("EX2E.PrereqOr")} `);
}

/**
 * Flat comma-separated list of every alternative across every group.
 * Used by the read-only charm sheet display.
 */
export function describeAllPrereqs(charm) {
  const groups = charm.system?.prereqGroups ?? [];
  const labels = [];
  for (const g of groups) {
    for (const a of (g.alternatives ?? [])) {
      const label = _altLabel(a);
      if (label) labels.push(label);
    }
  }
  return labels.join(", ");
}

function _altLabel(alt) {
  if (alt?.type === "anyExcellency") return game.i18n.localize("EX2E.PrereqAnyExcellency");
  return (alt?.charmName ?? "").trim();
}
