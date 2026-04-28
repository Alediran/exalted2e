/**
 * Aim's multi-tick action handler. Registered into EX2E.multiTickHandlers
 * during init. Hooks fire from the central dispatch in
 * module/combat/multi-tick.mjs.
 *
 * onCommitOther handles abort/consume/divert decisions when the combatant
 * commits a new action — relocated from combat-math.mjs::planCommitOnAim.
 */

export const aimHandler = {
  badgeLabelKey: "EX2E.MultiTickActionAim",

  /**
   * No-op for aim. The bonus is computed lazily by computeAimBonus
   * (in module/rolls/attack-math.mjs) from startTick. The badge gets
   * its progress directly from action.ticksElapsed via the registry's
   * persistence in dispatchTickAdvance, so onTick has nothing to do.
   */
  onTick(_combatant, _action, _combat) { /* no-op */ },

  /**
   * Fires on the boundary tick (ticksElapsed → totalTicks). Posts the
   * "fully banked" chat message exactly once on the first completion;
   * subsequent cycles (after re-aim) bump cycleCount past 1, and the
   * cycleCount !== 1 guard suppresses the chat for "covering" ticks.
   *
   * onComplete sees post-bump cycleCount because dispatchTickAdvance
   * persists the new state before calling onComplete.
   */
  async onComplete(combatant, action, _combat) {
    if (action?.cycleCount !== 1) return;
    const target = game.actors?.get?.(action?.state?.targetActorId);
    const targetName = target?.name ?? "—";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
      content: game.i18n.format("EX2E.AimFullyBanked", {
        actor:  combatant.actor?.name ?? combatant.name ?? "",
        target: targetName
      })
    });
  },

  onCommitOther(_combatant, action, pending, flurry) {
    const targetActorId = action?.state?.targetActorId;
    if (pending) {
      const sameTarget        = pending.targetActorId === targetActorId;
      const isAimContinuation = pending.actionKey === "aim"    && sameTarget;
      const isAimedAttack     = pending.actionKey === "attack" && sameTarget;
      if (isAimContinuation) return { clearAction: false, applyAbortPenalty: false };
      if (isAimedAttack)     return { clearAction: true,  applyAbortPenalty: false };
      return { clearAction: true, applyAbortPenalty: true };
    }
    if (flurry) {
      return { clearAction: true, applyAbortPenalty: true };
    }
    return { clearAction: false, applyAbortPenalty: false };
  }
};
