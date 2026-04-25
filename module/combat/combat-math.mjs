/**
 * Ascending sort comparator for `Array.prototype.sort` on combatant-shaped
 * objects. Sort order (ascending = highest-priority row first):
 *   1. unacted-this-tick ahead of acted-this-tick
 *   2. lower initiative ahead of higher (Infinity for missing)
 *   3. higher Dex, higher Wits, name (localeCompare), id
 *
 * Keeping acted combatants at the bottom of the list means
 * `combat.combatant` (Foundry's first-entry derivation) always lands on a
 * still-eligible combatant while any remain.
 *
 * Reads:
 *   - `c.flags.exalted2e.actedThisTick` (boolean)
 *   - `c.initiative` (number, Infinity for missing)
 *   - `c.actor.system.attributes.dexterity.value`
 *   - `c.actor.system.attributes.wits.value`
 *   - `c.name`, `c.id`
 *
 * @param {object} a
 * @param {object} b
 * @returns {number} negative if a before b, positive if b before a, zero if equal
 */
export function sortCombatants(a, b) {
  const aActed = !!a.flags?.exalted2e?.actedThisTick;
  const bActed = !!b.flags?.exalted2e?.actedThisTick;
  if (aActed !== bActed) return aActed ? 1 : -1;

  const ai = Number.isFinite(a.initiative) ? a.initiative : Infinity;
  const bi = Number.isFinite(b.initiative) ? b.initiative : Infinity;
  if (ai !== bi) return ai - bi;

  const aDex = a.actor?.system?.attributes?.dexterity?.value ?? 0;
  const bDex = b.actor?.system?.attributes?.dexterity?.value ?? 0;
  if (aDex !== bDex) return bDex - aDex;                 // higher Dex wins

  const aWits = a.actor?.system?.attributes?.wits?.value ?? 0;
  const bWits = b.actor?.system?.attributes?.wits?.value ?? 0;
  if (aWits !== bWits) return bWits - aWits;             // higher Wits wins

  const byName = (a.name ?? "").localeCompare(b.name ?? "");
  if (byName !== 0) return byName;
  return (a.id ?? "").localeCompare(b.id ?? "");
}

/**
 * Tick position for a Join Battle result relative to the winner.
 *
 * Canonical wheel cap: botchers land on tick 6 regardless of the math.
 * Everyone else lands at `max - theirs`, clamped to 6 (so even if the winner
 * rolled 20 and you rolled 3, you're at tick 6, not tick 17).
 *
 * @param {number} successes - Combatant's JB successes
 * @param {boolean} botched - Whether the JB roll botched
 * @param {number} max - Highest JB successes among all rolled combatants
 * @returns {number} Tick index in [0, 6]
 */
export function computeTickFromJB(successes, botched, max) {
  if (botched) return 6;
  return Math.min(6, max - successes);
}

/**
 * Decide what to do with a combatant's aim flag when they commit a new
 * action. Returns `{clearAim, applyAbortPenalty}` for the caller to apply.
 *
 * Rules (from the combatant's committed aim state):
 *   - No aim flag → no changes.
 *   - Aim + pending action (from `pendingAction`):
 *       - actionKey === "aim" and same target → continuation (keep aim)
 *       - actionKey === "attack" and same target → aimed attack consumes aim
 *         (clear, no penalty — the bonus was already applied in rollAttack)
 *       - anything else → divert (clear + -2 internal penalty)
 *   - Aim + flurry (no pending action): flurry breaks aim in MVP
 *     (clear + -2 internal penalty).
 *
 * @param {object} args
 * @param {object | null} args.pending - `pendingAction` flag snapshot
 * @param {object | null} args.flurry  - `flurry` flag snapshot
 * @param {object | null} args.aim     - `aim` flag snapshot `{targetActorId, ...}`
 * @returns {{clearAim: boolean, applyAbortPenalty: boolean}}
 */
export function planCommitOnAim({ pending, flurry, aim }) {
  if (!aim) return { clearAim: false, applyAbortPenalty: false };

  if (pending) {
    const sameTarget        = pending.targetActorId === aim.targetActorId;
    const isAimContinuation = pending.actionKey === "aim"    && sameTarget;
    const isAimedAttack     = pending.actionKey === "attack" && sameTarget;
    if (isAimContinuation) return { clearAim: false, applyAbortPenalty: false };
    if (isAimedAttack)     return { clearAim: true,  applyAbortPenalty: false };
    return { clearAim: true, applyAbortPenalty: true };
  }

  if (flurry) {
    return { clearAim: true, applyAbortPenalty: true };
  }

  return { clearAim: false, applyAbortPenalty: false };
}
