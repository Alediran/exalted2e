/**
 * Advance a multi-tick action's tick counter by one step.
 *
 * Behavior:
 *   - ticksElapsed bumps by 1, clamped to [0, totalTicks].
 *   - completedCycle = true only on the exact transition to totalTicks
 *     (i.e., when ticksElapsed went from totalTicks-1 to totalTicks).
 *   - cycleCount bumps by 1 atomically with that transition.
 *   - If ticksElapsed is already at totalTicks (clamp), completedCycle is
 *     false and cycleCount is unchanged — no double-fire.
 *   - totalTicks <= 0 is degenerate; the input passes through unchanged
 *     with completedCycle:false.
 *
 * @param {object} state
 * @param {number} [state.ticksElapsed=0]
 * @param {number} [state.totalTicks=0]
 * @param {number} [state.cycleCount=0]
 * @returns {{ticksElapsed: number, cycleCount: number, completedCycle: boolean}}
 */
export function advanceTickState({ ticksElapsed = 0, totalTicks = 0, cycleCount = 0 } = {}) {
  if (totalTicks <= 0) {
    return { ticksElapsed, cycleCount, completedCycle: false };
  }

  // Clamp the input to valid range [0, totalTicks]
  const clampedPrev = Math.max(0, Math.min(ticksElapsed, totalTicks));

  // If we had to clamp downward (ticksElapsed < 0) or upward (ticksElapsed > totalTicks),
  // return the clamped value without advancing on the same call
  if (clampedPrev !== ticksElapsed) {
    return { ticksElapsed: clampedPrev, cycleCount, completedCycle: false };
  }

  // Normal advance: increment by 1
  const next      = Math.min(clampedPrev + 1, totalTicks);
  const completed = next === totalTicks && next > clampedPrev;
  return {
    ticksElapsed:    next,
    cycleCount:      completed ? cycleCount + 1 : cycleCount,
    completedCycle:  completed
  };
}
