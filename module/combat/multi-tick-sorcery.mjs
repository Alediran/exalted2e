import { planSorceryCommit } from "./sorcery-math.mjs";

/**
 * Sorcery's multi-tick action handler. Registered into
 * EX2E.multiTickHandlers during init. Hooks fire from the central
 * dispatch in module/combat/multi-tick.mjs.
 *
 * Sorcery is commit-driven (totalTicks: 0 makes advanceTickState
 * degenerate). onTick is no-op; the state machine advances on each
 * Finish-Turn commit via onCommitOther.
 */
export const sorceryHandler = {
  badgeLabelKey: "EX2E.MultiTickActionSorcery",  // fallback only

  /**
   * Custom badge text — sorcery's progress is shape-action count, not
   * tick count.
   */
  getBadgeText(action) {
    const s = action?.state ?? {};
    const completed = s.completedShapeActions ?? 0;
    const total     = s.totalShapeActions ?? 0;
    if (completed < total) {
      return game.i18n.format("EX2E.SorceryShaping", {
        spell: s.spellName ?? "—",
        completed,
        total
      });
    }
    return game.i18n.format("EX2E.SorceryReadyToCast",
                            { spell: s.spellName ?? "—" });
  },

  onTick(_combatant, _action, _combat) { /* no-op — commit-driven */ },

  /**
   * Commit-driven state machine. Reads planSorceryCommit's decision
   * and applies the right side effects:
   *   - continue:  bump state.completedShapeActions
   *   - cast:      post chat card; flag cleared by container
   *   - interrupt: refund motes/WP, tear down DV AE; flag cleared by container
   *
   * Async because the state advance, refund, and chat post all need
   * combatant.update / actor.update / ChatMessage.create.
   */
  async onCommitOther(combatant, action, pending, flurry) {
    const decision = planSorceryCommit({ action, pending, flurry });

    if (decision.kind === "continue") {
      const next = (action.state.completedShapeActions ?? 0) + 1;
      await combatant.update({
        "flags.exalted2e.multiTickAction.state.completedShapeActions": next
      });
      return { clearAction: false, applyAbortPenalty: false };
    }

    if (decision.kind === "cast") {
      await postCastChatCard(combatant, action);
      // Motes/WP already spent at shape #1; cast just releases the
      // commitment. Sticky DV AE will clear via the existing
      // sticky-DV-on-next-commit pattern in advanceCurrentByTicks.
      return { clearAction: true, applyAbortPenalty: false };
    }

    // kind === "interrupt" or "noop" — interrupt path is the safe
    // default. RAW: "consider the spell interrupted" — no internal
    // penalty stamped.
    if (decision.kind === "interrupt") {
      await refundCommittedCosts(combatant, action);
      await tearDownDvAe(combatant, action);
      return { clearAction: true, applyAbortPenalty: false };
    }

    // noop: shouldn't happen in practice (advanceCurrentByTicks always
    // has either pending or flurry). Defensive: leave state alone.
    return { clearAction: false, applyAbortPenalty: false };
  },

  /**
   * Quickbar Abort path. Refund + DV teardown happen here so the
   * player gets immediate feedback (motes restored, AE removed). The
   * caller (dispatchAbort → quickbar's _handleAbort) clears the flag
   * based on the {clearAction: true} return.
   */
  async onAbort(combatant, action, _combat) {
    await refundCommittedCosts(combatant, action);
    await tearDownDvAe(combatant, action);
    return { clearAction: true };
  }
};

/**
 * Render and post the Cast Sorcery chat card. Includes spell
 * description (HTML, rendered), tradition + circle labels, and the
 * mote/WP ledger (no Reverse button — confirm dialog at declaration
 * is the change-your-mind gate).
 */
async function postCastChatCard(combatant, action) {
  const actor = combatant.actor;
  const spell = actor?.items?.get(action.state?.spellId);
  if (!actor || !spell) {
    console.warn("Sorcery cast: missing actor or spell", action);
    return;
  }
  const tradition = spell.system?.tradition ?? "sorcery";
  const circle    = spell.system?.circle ?? 1;
  const traditionKey = tradition === "necromancy"
    ? "EX2E.TraditionNecromancy"
    : "EX2E.TraditionSorcery";
  const circleKeyMap = {
    sorcery:    { 1: "EX2E.CircleTerrestrial", 2: "EX2E.CircleCelestial", 3: "EX2E.CircleSolar" },
    necromancy: { 1: "EX2E.CircleShadowlands", 2: "EX2E.CircleLabyrinth", 3: "EX2E.CircleVoid" }
  };
  const circleKey = circleKeyMap[tradition]?.[circle] ?? "EX2E.CircleTerrestrial";
  const motePool  = action.state?.motePool ?? "peripheral";
  const motePoolLabel = game.i18n.localize(
    motePool === "personal" ? "EX2E.MotesPersonalShort" : "EX2E.MotesPeripheralShort"
  );
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/spell-cast.hbs",
    {
      actorName:      actor.name,
      spellName:      spell.name,
      traditionLabel: game.i18n.localize(traditionKey),
      circleLabel:    game.i18n.localize(circleKey),
      description:    spell.system?.description ?? "",
      motesSpent:     action.state?.motesCommitted ?? 0,
      motePoolLabel,
      wpSpent:        action.state?.wpCommitted ?? 0
    }
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}

/**
 * Refund committed motes + WP to the pools they came from.
 *
 * Pool-accurate: when spendMotes overflows from primary (peripheral)
 * to secondary (personal), state.motesFromPrimary / motesFromSecondary
 * record the split. Refund issues one recoverMotes per non-zero half so
 * neither pool is over-credited beyond its max.
 *
 * Legacy fallback: if motesFromPrimary/Secondary are absent (state was
 * written by an older code path), refund the legacy `motesCommitted`
 * to `motePool` — preserves the prior behavior for forward compat.
 *
 * WP is the actor's single willpower.value (no peripheral/personal
 * split).
 */
async function refundCommittedCosts(combatant, action) {
  const actor = combatant.actor;
  if (!actor) return;
  const s = action.state ?? {};

  if (typeof actor.recoverMotes === "function") {
    const fromPrimary   = s.motesFromPrimary;
    const fromSecondary = s.motesFromSecondary;
    if (fromPrimary !== undefined || fromSecondary !== undefined) {
      // New per-pool tracking. Refund each pool only if it received motes.
      if ((fromPrimary ?? 0) > 0) {
        await actor.recoverMotes(fromPrimary, s.primaryPool ?? "peripheral");
      }
      if ((fromSecondary ?? 0) > 0) {
        await actor.recoverMotes(fromSecondary, s.secondaryPool ?? "personal");
      }
    } else {
      // Legacy fallback (state from an older write).
      const motes = s.motesCommitted ?? 0;
      const pool  = s.motePool ?? "peripheral";
      if (motes > 0) await actor.recoverMotes(motes, pool);
    }
  }

  const wp = s.wpCommitted ?? 0;
  if (wp > 0) {
    const currentWp = actor.system?.willpower?.value ?? 0;
    const maxWp     = actor.system?.willpower?.max ?? 0;
    await actor.update({
      "system.willpower.value": Math.min(maxWp, currentWp + wp)
    });
  }
}

/**
 * Delete the sticky DV AE created at shape #1 (id stored in
 * state.dvEffectId). No-op if the AE is already gone (e.g. removed
 * manually by the player).
 */
async function tearDownDvAe(combatant, action) {
  const actor = combatant.actor;
  const id = action.state?.dvEffectId;
  if (!actor || !id) return;
  const ae = actor.effects.get(id);
  if (ae) await ae.delete();
}
