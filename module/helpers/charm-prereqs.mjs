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
 *   • essence        — checks `actor.system.essence.value >= alt.essenceMin`.
 *   • ability        — checks an ability or attribute dot rating:
 *                      `alt.abilityKey` (normalized, case-insensitive) against
 *                      `alt.abilityMin`. Tries `system.abilities` first, then
 *                      `system.attributes`.
 *   • background     — checks that the actor owns a background item whose
 *                      normalized name equals `alt.backgroundName` and whose
 *                      `system.value >= alt.backgroundMin` (default 1).
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
      return ownedCharms.some(c =>
        c.system?.charmUid === wantUid ||
        (c.system?.mergedIds ?? []).includes(wantUid)
      );
    }
    const want = _norm(alt.charmName);
    if (!want) return false;
    return ownedCharms.some(c => _norm(c.name) === want);
  }
  if (alt.type === "anyExcellency") {
    const override    = _norm(alt.abilityKey ?? "");
    const hostAbility = override || _norm(hostCharm.system?.ability);
    if (!hostAbility) return false;
    const count = ownedCharms.filter(c =>
      EXCELLENCY_TIERS.has(c.system?.excellency ?? "")
      && _norm(c.system?.ability) === hostAbility
    ).length;
    return count >= (alt.minCount ?? 1);
  }
  if (alt.type === "virtue") {
    const key = String(alt.virtueKey ?? "").trim().toLowerCase();
    if (!key) return false;
    const min  = Number(alt.virtueMin ?? 1);
    const sys  = actor?.system ?? hostCharm.actor?.system ?? null;
    const rating = sys?.virtues?.[key]?.dotRating ?? 0;
    return rating >= min;
  }
  if (alt.type === "essence") {
    const min = Number(alt.essenceMin ?? 1);
    const sys = actor?.system ?? hostCharm.actor?.system ?? null;
    return (sys?.essence?.value ?? 0) >= min;
  }
  if (alt.type === "ability") {
    const key = _norm(alt.abilityKey ?? "");
    if (!key) return false;
    const min = Number(alt.abilityMin ?? 1);
    const sys = actor?.system ?? hostCharm.actor?.system ?? null;
    if (!sys) return false;
    const abilEntry = Object.entries(sys.abilities ?? {}).find(([k]) => _norm(k) === key);
    if (abilEntry) return (abilEntry[1]?.value ?? 0) >= min;
    const attrEntry = Object.entries(sys.attributes ?? {}).find(([k]) => _norm(k) === key);
    if (attrEntry) return (attrEntry[1]?.value ?? 0) >= min;
    return false;
  }
  if (alt.type === "background") {
    const wantName = _norm(alt.backgroundName ?? "");
    if (!wantName) return false;
    const min = Number(alt.backgroundMin ?? 1);
    const a = actor ?? hostCharm.actor ?? null;
    if (!a) return false;
    return a.items.filter(i => i.type === "background" && _norm(i.name) === wantName)
                  .some(i => (i.system?.value ?? 0) >= min);
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

/**
 * Check whether an actor meets the minAbility requirement for a charm.
 *
 * MA charms check the actor's Martial Arts ability, except Lunar Hero Style
 * charms on Lunar actors, which check Dexterity instead (the style's
 * prerequisites are attribute-based rather than ability-based).
 */
export function meetsMinAbility(charm, actor) {
  const min = charm.system?.minAbility ?? 0;
  if (!min) return true;
  const sys = actor?.system;
  if (!sys) return true;

  const ability = charm.system?.ability;
  if (ability === "martialarts") {
    if (charm.system?.martialArtsStyleName === "Lunar Hero Style"
        && sys.exaltType === "lunar") {
      return (sys.attributes?.dexterity?.value ?? 0) >= min;
    }
    return (sys.abilities?.martialArts?.value ?? 0) >= min;
  }
  if (sys.attributes?.[ability] !== undefined) {
    return (sys.attributes[ability]?.value ?? 0) >= min;
  }
  return true;
}

/** Convenience: true iff every group has a satisfying alternative. */
export function areCharmPrereqsMet(charm, actor) {
  if (charm.type === "knack" && charm.system?.isChimera) {
    const s = actor?.system;
    if (!s || s.exaltType !== "lunar" ||
        s.caste !== "casteless" ||
        (s.limit?.value ?? 0) < 10) return false;
  }
  if (!meetsMinAbility(charm, actor)) return false;
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
  if (alt?.type === "anyExcellency") {
    const n = alt.minCount ?? 1;
    if (n > 1) {
      const ability = String(alt.abilityKey ?? "").trim();
      return game.i18n.format("EX2E.PrereqAnyNExcellencies", { count: n, ability });
    }
    return game.i18n.localize("EX2E.PrereqAnyExcellency");
  }
  if (alt?.type === "virtue") {
    const key = String(alt.virtueKey ?? "").trim();
    const min = Number(alt.virtueMin ?? 1);
    if (!key) return "";
    return `${key.charAt(0).toUpperCase() + key.slice(1)} ${min}+`;
  }
  if (alt?.type === "essence") {
    const min = Number(alt.essenceMin ?? 1);
    return `${game.i18n.localize("EX2E.Essence")} ${min}+`;
  }
  if (alt?.type === "ability") {
    const key = String(alt.abilityKey ?? "").trim();
    const min = Number(alt.abilityMin ?? 1);
    if (!key) return "";
    return `${key.charAt(0).toUpperCase() + key.slice(1)} ${min}+`;
  }
  if (alt?.type === "background") {
    const name = String(alt.backgroundName ?? "").trim();
    const min  = Number(alt.backgroundMin ?? 1);
    if (!name) return "";
    return `${name} ${min}+`;
  }
  const uid = String(alt?.charmUid ?? "").trim();
  if (uid && actor) {
    const match = actor.items.find(i => i.type === "charm" && i.system?.charmUid === uid);
    if (match?.name) return match.name;
  }
  return (alt?.charmName ?? "").trim();
}
