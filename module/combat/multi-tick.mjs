import { EX2E } from "../config.mjs";
import { advanceTickState } from "./multi-tick-math.mjs";

/**
 * Handler registry for multi-tick actions. Keyed by `actionKey`. Each
 * entry exposes optional hooks:
 *   - onTick(combatant, action, combat)       — every advanceWheel tick
 *   - onComplete(combatant, action, combat)   — boundary tick only
 *   - onCommitOther(combatant, action, pending, flurry)
 *       returns { clearAction, applyAbortPenalty }
 *   - badgeLabelKey: i18n key for the tracker badge label
 *
 * Hooks are plain functions registered at init time; functions never
 * live in flags. Single-slot per combatant — at most one active
 * multi-tick action.
 */
EX2E.multiTickHandlers = EX2E.multiTickHandlers ?? {};

/**
 * Per-combatant tick advance. Reads the combatant's multiTickAction
 * flag, calls advanceTickState to compute the next state, persists
 * via combatant.update, then dispatches onComplete (boundary only)
 * and onTick (every tick). No-op if the combatant has no
 * multiTickAction.
 *
 * @param {object} combatant — Foundry Combatant document
 * @param {object} combat    — Foundry Combat document
 */
export async function dispatchTickAdvance(combatant, combat) {
  const action = combatant.getFlag?.("exalted2e", "multiTickAction") ?? null;
  if (!action) return;
  const handler = EX2E.multiTickHandlers[action.actionKey];
  if (!handler) return;

  const next = advanceTickState({
    ticksElapsed: action.ticksElapsed ?? 0,
    totalTicks:   action.totalTicks   ?? 0,
    cycleCount:   action.cycleCount   ?? 0
  });

  // Persist updated counters; preserve the rest of the action object.
  const updated = {
    ...action,
    ticksElapsed: next.ticksElapsed,
    cycleCount:   next.cycleCount
  };
  await combatant.update({ "flags.exalted2e.multiTickAction": updated });

  if (next.completedCycle && typeof handler.onComplete === "function") {
    await handler.onComplete(combatant, updated, combat);
  }
  if (typeof handler.onTick === "function") {
    await handler.onTick(combatant, updated, combat);
  }
}

/**
 * Decide commit-time effects when a combatant commits a new action while
 * a multi-tick action is active. Returns the handler's plan, or a
 * pass-through plan if there's no active action or no handler.
 *
 * @param {object}      combatant
 * @param {object|null} pending   — pendingAction flag snapshot
 * @param {object|null} flurry    — flurry flag snapshot
 * @returns {Promise<{action: object|null, plan: {clearAction: boolean, applyAbortPenalty: boolean}}>}
 */
export async function planCommitOther(combatant, pending, flurry) {
  const action = combatant.getFlag?.("exalted2e", "multiTickAction") ?? null;
  if (!action) {
    return { action: null, plan: { clearAction: false, applyAbortPenalty: false } };
  }
  const handler = EX2E.multiTickHandlers[action.actionKey];
  if (!handler || typeof handler.onCommitOther !== "function") {
    return { action, plan: { clearAction: false, applyAbortPenalty: false } };
  }
  const plan = await handler.onCommitOther(combatant, action, pending, flurry);
  return { action, plan };
}

/**
 * Clear the multiTickAction flag from every combatant in the given combat.
 * Fires onAbort per active multi-tick (so sorcery can refund motes/WP
 * cleanly when combat ends). Always clears the flag regardless of
 * handler return — this is a "clear all" operation, not a per-action
 * decision. Errors in handler.onAbort are caught and logged so a single
 * bad handler can't block the cleanup.
 *
 * Called by ExaltedCombat.endCombat() and the deleteCombat hook.
 *
 * @param {object} combat        — Foundry Combat document
 * @param {object} [options]
 * @param {boolean} [options.skipFlagUpdate=false] — skip the combatant
 *   flag-clearing update; pass true when called from deleteCombat since
 *   the combatants are being deleted anyway and the update would fail.
 */
export async function clearAllMultiTickActions(combat, { skipFlagUpdate = false } = {}) {
  if (!combat?.combatants) return;
  for (const c of combat.combatants) {
    const action = c.getFlag?.("exalted2e", "multiTickAction") ?? null;
    if (!action) continue;
    const handler = EX2E.multiTickHandlers[action.actionKey];
    if (typeof handler?.onAbort === "function") {
      try { await handler.onAbort(c, action, combat); }
      catch (err) { console.warn("multi-tick onAbort failed during clear", err); }
    }
    if (!skipFlagUpdate) {
      await c.update({ "flags.exalted2e.-=multiTickAction": null });
    }
  }
}

/**
 * Quickbar Abort dispatch. Gives the active multi-tick consumer a chance
 * to clean up its own state (refund committed costs, tear down sticky
 * AEs). Returns {clearAction} so the caller knows whether to clear the
 * flag — Aim's onAbort returns false (its abort penalty is applied by
 * next-commit's planCommitOther, which needs the flag to still be
 * present). Sorcery's onAbort returns true (refund done now; clear the
 * flag).
 *
 * @param {object} combatant — Foundry Combatant document
 * @param {object} combat    — Foundry Combat document
 * @returns {Promise<{clearAction: boolean}>}
 */
export async function dispatchAbort(combatant, combat) {
  const action = combatant.getFlag?.("exalted2e", "multiTickAction") ?? null;
  if (!action) return { clearAction: false };
  const handler = EX2E.multiTickHandlers[action.actionKey];
  if (typeof handler?.onAbort !== "function") return { clearAction: false };
  const result = await handler.onAbort(combatant, action, combat);
  return result ?? { clearAction: false };
}
