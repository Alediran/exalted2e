/**
 * Normalize a raw charm `system.cost` object to non-negative integer values.
 *
 * Accepts fields in the shape used by `CharmData`:
 *   { motes, willpower, bashingHealth, lethalHealth, aggravatedHealth, xp }
 *
 * Returns a `{moteCost, willpowerCost, bashingCost, lethalCost, aggravatedCost,
 * xpCost}` object with every field coerced via `Math.max(0, Math.floor(Number(v) || 0))`.
 * Missing / NaN / negative values become 0. Fractional values floor.
 *
 * @param {object} [cost]
 * @param {object} [overrides]
 * @param {number} [overrides.motesOverride] - If provided, use this instead of cost.motes
 * @returns {{moteCost: number, willpowerCost: number, bashingCost: number, lethalCost: number, aggravatedCost: number, xpCost: number}}
 */
export function normalizeCost(cost, { motesOverride } = {}) {
  const n = v => Math.max(0, Math.floor(Number(v) || 0));
  return {
    moteCost:       motesOverride !== undefined ? n(motesOverride) : n(cost?.motes),
    willpowerCost:  n(cost?.willpower),
    bashingCost:    n(cost?.bashingHealth),
    lethalCost:     n(cost?.lethalHealth),
    aggravatedCost: n(cost?.aggravatedHealth),
    xpCost:         n(cost?.xp)
  };
}

/**
 * Compute the Foundry `actor.update()` payload that reverses a charm activation
 * ledger.
 *
 * Inputs:
 *   - `ledger`: the record stored on the chat message at activation time:
 *     `{moteBreakdown, willpower, bashing, lethal, aggravated, xp}`.
 *     `moteBreakdown` has shape `{primaryPool, secondaryPool, fromPrimary, fromSecondary}`
 *     as returned by `ExaltedActor.spendMotes`.
 *   - `actorSystem`: the actor's `system` object as it stands right now.
 *     Reads `motes[poolKey]`, `willpower`, `experience`, and `health`.
 *
 * Returns `{updates}` where `updates` is a flat dict of dotted paths suitable
 * for `actor.update(updates)`. Refunds are capped at each resource's max (pool
 * max, willpower max, experience total); health values are floored at 0.
 * Toggle-state and spawned-weapon teardown are NOT this helper's concern — the
 * listener still handles those through the `ExaltedItem` API.
 *
 * @param {object} ledger
 * @param {object} actorSystem
 * @returns {{updates: Record<string, unknown>}}
 */
export function planLedgerRefund(ledger, actorSystem) {
  const updates = {};
  const sys = actorSystem ?? {};
  const l   = ledger      ?? {};

  // ── Motes: refund to the exact pools they came from ────────────────
  const mb = l.moteBreakdown;
  if (mb && (Number(mb.fromPrimary) > 0 || Number(mb.fromSecondary) > 0)) {
    const primary   = sys.motes?.[mb.primaryPool]   ?? { value: 0, max: 0 };
    const secondary = sys.motes?.[mb.secondaryPool] ?? { value: 0, max: 0 };
    updates[`system.motes.${mb.primaryPool}.value`]   = Math.min(primary.max   ?? 0, (primary.value   ?? 0) + (Number(mb.fromPrimary)   || 0));
    updates[`system.motes.${mb.secondaryPool}.value`] = Math.min(secondary.max ?? 0, (secondary.value ?? 0) + (Number(mb.fromSecondary) || 0));
  }

  // ── Willpower (capped at max) ──────────────────────────────────────
  const wpRefund = Number(l.willpower) || 0;
  if (wpRefund > 0) {
    const wp = sys.willpower ?? { value: 0, max: 0 };
    updates["system.willpower.value"] = Math.min(wp.max ?? 0, (wp.value ?? 0) + wpRefund);
  }

  // ── XP (capped at `experience.total`, the earned-XP ceiling) ───────
  const xpRefund = Number(l.xp) || 0;
  if (xpRefund > 0) {
    const xp = sys.experience ?? { value: 0, total: 0 };
    updates["system.experience.value"] = Math.min(xp.total ?? 0, (xp.value ?? 0) + xpRefund);
  }

  // ── Health: decrement each column, fresh object so the original
  //    system.health is not mutated ────────────────────────────────────
  const bRefund = Number(l.bashing)    || 0;
  const lRefund = Number(l.lethal)     || 0;
  const aRefund = Number(l.aggravated) || 0;
  if (bRefund > 0 || lRefund > 0 || aRefund > 0) {
    const h = { ...(sys.health ?? {}) };
    if (bRefund > 0) h.bashing    = Math.max(0, (h.bashing    ?? 0) - bRefund);
    if (lRefund > 0) h.lethal     = Math.max(0, (h.lethal     ?? 0) - lRefund);
    if (aRefund > 0) h.aggravated = Math.max(0, (h.aggravated ?? 0) - aRefund);
    updates["system.health"] = h;
  }

  return { updates };
}
