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
 *   • virtue         — checks the actor's `system.virtues[key].dotRating`
 *                      against `alt.virtueMin`. The actor is resolved from
 *                      the explicit `actor` arg passed to evaluateCharmPrereqs,
 *                      falling back to `hostCharm.actor` for embedded charms.
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
 * own prerequisite).
 *
 * For `type: "charm"` alternatives we match by stable `system.charmUid`
 * when one is stored on the alt (which is the normal case — the sheet's
 * picker captures it on selection). A blank `charmUid` falls back to
 * case-insensitive name match for compendium-authored prereqs that
 * haven't been rewired through a UID-aware picker, and for data authored
 * before charmUids existed.
 *
 * @param {object}      alt        The alternative descriptor from prereqGroups.
 * @param {Item}        hostCharm  The charm whose prerequisites are being evaluated.
 * @param {Item[]}      ownedCharms  Actor-owned charms, excluding hostCharm.
 * @param {Actor|null}  actor      The owning actor; falls back to hostCharm.actor
 *                                 for embedded-charm contexts.
 */
function _altSatisfied(alt, hostCharm, ownedCharms, actor = null) {
  if (alt.type === "charm") {
    const wantUid = String(alt.charmUid ?? "").trim();
    if (wantUid) {
      return ownedCharms.some(c => c.system?.charmUid === wantUid);
    }
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
  if (alt.type === "virtue") {
    const key = String(alt.virtueKey ?? "").trim().toLowerCase();
    if (!key) return false;
    const min  = Number(alt.virtueMin ?? 1);
    const sys  = actor?.system ?? hostCharm.actor?.system ?? null;
    const rating = sys?.virtues?.[key]?.dotRating ?? 0;
    return rating >= min;
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
    const satisfied = alts.some(alt => _altSatisfied(alt, charm, ownedCharms, actor));
    return { group, index, satisfied, label: describeGroup(group) };
  });
}

/** Convenience: true iff every group has a satisfying alternative. */
export function areCharmPrereqsMet(charm, actor) {
  if (charm.type === "knack" && charm.system?.isChimera) {
    const s = actor?.system;
    if (!s || s.exaltType !== "lunar" ||
        s.caste !== "casteless" ||
        (s.limit?.value ?? 0) < 10) return false;
  }
  const report = evaluateCharmPrereqs(charm, actor);
  if (report.length === 0) return true;
  return report.every(r => r.satisfied);
}

/**
 * Human-readable description of a single group. "X or Y or Z" for OR
 * groups; a bare name for singletons. When `actor` is provided, charm
 * alternatives with a `charmUid` resolve their label from the actor's
 * current charm name (so post-rename displays stay current).
 */
export function describeGroup(group, actor = null) {
  const alts = group?.alternatives ?? [];
  const parts = alts.map(a => _altLabel(a, actor)).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.join(` ${game.i18n.localize("EX2E.PrereqOr")} `);
}

/**
 * Flat comma-separated list of every alternative across every group.
 * Used by the read-only charm sheet display.
 */
export function describeAllPrereqs(charm, actor = null) {
  const groups = charm.system?.prereqGroups ?? [];
  const labels = [];
  for (const g of groups) {
    for (const a of (g.alternatives ?? [])) {
      const label = _altLabel(a, actor ?? charm.actor ?? null);
      if (label) labels.push(label);
    }
  }
  return labels.join(", ");
}

function _altLabel(alt, actor = null) {
  if (alt?.type === "anyExcellency") return game.i18n.localize("EX2E.PrereqAnyExcellency");
  if (alt?.type === "virtue") {
    const key = String(alt.virtueKey ?? "").trim();
    const min = Number(alt.virtueMin ?? 1);
    if (!key) return "";
    return `${key.charAt(0).toUpperCase() + key.slice(1)} ${min}+`;
  }
  const uid = String(alt?.charmUid ?? "").trim();
  if (uid && actor) {
    const match = actor.items.find(i => i.type === "charm" && i.system?.charmUid === uid);
    if (match?.name) return match.name;
  }
  return (alt?.charmName ?? "").trim();
}
