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
      const actor = combatant.actor;
      const spell = actor?.items?.get(action.state?.spellId);
      await postCastChatCard(actor, spell, {
        motesFromPrimary:   action.state?.motesFromPrimary  ?? 0,
        motesFromSecondary: action.state?.motesFromSecondary ?? 0,
        primaryPool:        action.state?.primaryPool  ?? "peripheral",
        secondaryPool:      action.state?.secondaryPool ?? "personal",
        wpCommitted:        action.state?.wpCommitted   ?? 0
      });
      await _createSpellEffectAe(actor, spell);
      // Motes/WP already spent at shape #1; cast just releases the
      // commitment. Sticky DV AE will clear via the existing
      // sticky-DV-on-next-commit pattern in advanceCurrentByTicks.
      return { clearAction: true, applyAbortPenalty: false };
    }

    // kind === "interrupt" or "noop" — interrupt path is the safe
    // default. RAW: "consider the spell interrupted" — no internal
    // penalty stamped.
    if (decision.kind === "interrupt") {
      await interruptShaping(combatant);
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
    await interruptShaping(combatant, null, action);
    return { clearAction: true };
  }
};

/**
 * Render and post the spell-cast chat card. Exported so the out-of-combat
 * path in cast-spell-flow.mjs can call it directly.
 *
 * @param {object} actor  - Foundry Actor
 * @param {object} spell  - Foundry Item of type "spell"
 * @param {object} ledger - { motesFromPrimary, motesFromSecondary, primaryPool, secondaryPool, wpCommitted }
 */
export async function postCastChatCard(actor, spell, ledger) {
  if (!actor || !spell) {
    console.warn("Sorcery cast: missing actor or spell", { actor, spell });
    return;
  }
  const tradition = spell.system?.tradition ?? "sorcery";
  const circle    = spell.system?.circle ?? 1;
  const traditionKey = tradition === "necromancy"
    ? "EX2E.TraditionNecromancy"
    : tradition === "weaving"
      ? "EX2E.TraditionWeaving"
      : "EX2E.TraditionSorcery";
  const circleKeyMap = {
    sorcery:    { 1: "EX2E.CircleTerrestrial", 2: "EX2E.CircleCelestial", 3: "EX2E.CircleSolar"   },
    necromancy: { 1: "EX2E.CircleShadowlands", 2: "EX2E.CircleLabyrinth", 3: "EX2E.CircleVoid"     },
    weaving:    { 1: "EX2E.CircleManMachine",  2: "EX2E.CircleGodMachine"                           }
  };
  const circleKey = circleKeyMap[tradition]?.[circle] ?? "EX2E.CircleTerrestrial";
  const primaryPool    = ledger.primaryPool ?? "peripheral";
  const motePoolLabel  = game.i18n.localize(
    primaryPool === "personal" ? "EX2E.MotesPersonalShort" : "EX2E.MotesPeripheralShort"
  );
  const motesSpent = (ledger.motesFromPrimary ?? 0) + (ledger.motesFromSecondary ?? 0);

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/spell-cast.hbs",
    {
      actorName:      actor.name,
      spellName:      spell.name,
      traditionLabel: game.i18n.localize(traditionKey),
      circleLabel:    game.i18n.localize(circleKey),
      description:    spell.system?.description ?? "",
      motesSpent,
      motePoolLabel,
      wpSpent:        ledger.wpCommitted ?? 0
    }
  );

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      exalted2e: {
        spellCast: {
          actorId:           actor.id,
          spellId:           spell.id,
          spellName:         spell.name,
          tradition,
          circle,
          motesFromPrimary:  ledger.motesFromPrimary  ?? 0,
          motesFromSecondary:ledger.motesFromSecondary ?? 0,
          primaryPool:       ledger.primaryPool  ?? "peripheral",
          secondaryPool:     ledger.secondaryPool ?? "personal",
          wpCommitted:       ledger.wpCommitted   ?? 0,
          reversed:          false
        }
      }
    }
  });
}

/**
 * Canonical teardown for an interrupted or aborted shaping sequence.
 * Refunds committed motes/WP, removes the shaping DV AE, clears both
 * multiTickAction and pendingAction flags, and posts a chat card.
 *
 * @param {object} combatant     - Foundry Combatant
 * @param {string|null} interrupterName - Name of the interrupter (if any)
 */
export async function interruptShaping(combatant, interrupterName = null, action = null) {
  const resolvedAction = action ?? combatant.flags?.exalted2e?.multiTickAction ?? null;
  if (!resolvedAction) return;
  if (resolvedAction.actionKey !== "sorcery" && resolvedAction.actionKey !== "necromancy") return;

  await refundCommittedCosts(combatant, resolvedAction);
  await tearDownDvAe(combatant, resolvedAction);
  await combatant.unsetFlag("exalted2e", "multiTickAction");
  await combatant.unsetFlag("exalted2e", "pendingAction");

  const msg = interrupterName
    ? game.i18n.format("EX2E.ShapingInterruptedBy", { name: interrupterName, spell: resolvedAction.state?.spellName ?? "" })
    : game.i18n.format("EX2E.ShapingInterrupted", { spell: resolvedAction.state?.spellName ?? "" });
  await ChatMessage.create({
    content: `<p>${msg}</p>`,
    style:   CONST.CHAT_MESSAGE_STYLES.OTHER,
    speaker: ChatMessage.getSpeaker({ actor: combatant.actor }),
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

/**
 * Stamp a spellEffect ActiveEffect on the caster after a non-instant
 * spell is successfully cast. This AE is the hook point for the
 * self-dispel (countermagic) path.
 *
 * No-op for instant-duration spells (they leave no ongoing effect to
 * dispel). Also no-op if actor or spell is missing.
 *
 * @param {object} actor - Foundry Actor
 * @param {object} spell - Foundry Item of type "spell"
 */
export async function _createSpellEffectAe(actor, spell) {
  if (!actor || !spell) {
    console.warn("_createSpellEffectAe: missing actor or spell", { actor, spell });
    return;
  }
  const dur = spell.system?.duration;
  if (!dur || dur === "instant") return;
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name:     spell.name,
    icon:     spell.img ?? "icons/svg/aura.svg",
    origin:   spell.uuid,
    transfer: false,
    disabled: false,
    flags:    {
      exalted2e: {
        spellEffect: {
          tradition:          spell.system?.tradition ?? "sorcery",
          circle:             spell.system?.circle ?? 1,
          spellId:            spell.id,
          spellName:          spell.name,
          countermagicImmune: spell.system?.countermagicImmune ?? false,
        }
      }
    }
  }]);
}
