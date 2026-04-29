import { cleanupOnAfter } from "./cleanup.mjs";

/**
 * Register a test handler in `EX2E.multiTickHandlers[actionKey]`. Each
 * provided callback (`onTick`, `onComplete`, `onAbort`, `onCommitOther`)
 * is wrapped in a recorder that pushes its call args onto an internal
 * log; missing callbacks default to a no-op recorder.
 *
 * Returns `{ handler, records }` so tests can inspect:
 *   records.onTick         — array of { combatant, action, combat }
 *   records.onComplete     — array of { combatant, action, combat }
 *   records.onAbort        — array of { combatant, action, combat }
 *   records.onCommitOther  — array of { combatant, action, pending, flurry }
 *
 * `cleanupOnAfter` restores the previous handler (or deletes the key if
 * absent), so registrations are scoped to one test.
 */
export async function registerTestHandler(actionKey, {
  onTick, onComplete, onAbort, onCommitOther
} = {}) {
  const { EX2E } = await import("../../../module/config.mjs");
  EX2E.multiTickHandlers = EX2E.multiTickHandlers ?? {};
  const previous = EX2E.multiTickHandlers[actionKey];

  const records = {
    onTick: [], onComplete: [], onAbort: [], onCommitOther: []
  };

  const handler = {
    onTick: async (combatant, action, combat) => {
      records.onTick.push({ combatant, action, combat });
      if (typeof onTick === "function") {
        return onTick(combatant, action, combat);
      }
    },
    onComplete: async (combatant, action, combat) => {
      records.onComplete.push({ combatant, action, combat });
      if (typeof onComplete === "function") {
        return onComplete(combatant, action, combat);
      }
    },
    onAbort: async (combatant, action, combat) => {
      records.onAbort.push({ combatant, action, combat });
      if (typeof onAbort === "function") {
        return onAbort(combatant, action, combat);
      }
      return { clearAction: false };
    },
    onCommitOther: async (combatant, action, pending, flurry) => {
      records.onCommitOther.push({ combatant, action, pending, flurry });
      if (typeof onCommitOther === "function") {
        return onCommitOther(combatant, action, pending, flurry);
      }
      return { clearAction: false, applyAbortPenalty: false };
    }
  };

  cleanupOnAfter(() => {
    if (previous === undefined) {
      delete EX2E.multiTickHandlers[actionKey];
    } else {
      EX2E.multiTickHandlers[actionKey] = previous;
    }
  });
  EX2E.multiTickHandlers[actionKey] = handler;
  return { handler, records };
}

/**
 * Set the multi-tick action flag on a combatant.
 * Action shape: { actionKey, startTick, totalTicks, ticksElapsed, cycleCount, state? }
 */
export async function setMultiTickAction(combatant, action) {
  await combatant.update({
    "flags.exalted2e.multiTickAction": action
  });
}

/** Read the flag (returns the action object or null). */
export function getMultiTickAction(combatant) {
  return combatant.flags?.exalted2e?.multiTickAction ?? null;
}
