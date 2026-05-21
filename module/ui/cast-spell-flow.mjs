import {
  buildShapeDeclaration,
  buildContinueShapeDeclaration,
  buildCastDeclaration
} from "../combat/sorcery-math.mjs";
import { SorceryCastDialog } from "../dialogs/sorcery-cast-dialog.mjs";
import { postCastChatCard, _createSpellEffectAe } from "../combat/multi-tick-sorcery.mjs";

/**
 * Sorcery cast-flow entry point. Shared by:
 *   - SpellSheet's Cast button (spell item sheet header)
 *   - CharacterSheet's Charms tab spell row "cast" button
 *
 * Branches on the actor's current multiTickAction state:
 *   - No state (or first shape): show confirm dialog → spend costs →
 *     write multiTickAction + pendingAction (shape 1)
 *   - Mid-shape (this spell): write pendingAction (continue shape)
 *   - Ready to cast (this spell, all shapes complete): write
 *     pendingAction (cast)
 *
 * @param {object} item — Foundry Item document (type "spell")
 */
export async function castSpellFlow(item) {
  const actor = item?.actor;
  if (!actor) return;

  const sys = item.system;
  const combatants = (game.combats?.contents ?? []).flatMap(c => c.combatants?.contents ?? []);
  const combatant  = combatants.find(c => c.actorId === actor.id) ?? null;
  // ── Out-of-combat: no shaping steps, no DV AE — spend and post immediately ─
  if (!combatant) {
    const result = await SorceryCastDialog.prompt({ spell: item, actor, circle: sys.circle ?? 1 });
    if (!result?.ok) return;

    const motesCost  = sys.cost?.motes ?? 0;
    const wpCost     = sys.cost?.willpower ?? 0;
    const moteResult = motesCost > 0 ? await actor.spendMotes(motesCost, "peripheral") : null;
    if (motesCost > 0 && !moteResult) return;  // spendMotes already posted a warning

    if (wpCost > 0) {
      const currentWp = actor.system?.willpower?.value ?? 0;
      await actor.update({ "system.willpower.value": Math.max(0, currentWp - wpCost) });
    }

    await postCastChatCard(actor, item, {
      motesFromPrimary:   moteResult?.fromPrimary   ?? 0,
      motesFromSecondary: moteResult?.fromSecondary ?? 0,
      primaryPool:        moteResult?.primaryPool   ?? "peripheral",
      secondaryPool:      moteResult?.secondaryPool ?? "personal",
      wpCommitted:        wpCost
    });
    await _createSpellEffectAe(actor, item);
    return;
  }

  const action = combatant.flags?.exalted2e?.multiTickAction ?? null;

  // ── Continue shape (mid-chain) ─────────────────────────────────────────
  if (action?.actionKey === "sorcery"
      && action.state?.spellId === item.id
      && (action.state?.completedShapeActions ?? 0) < (action.state?.totalShapeActions ?? 0)) {
    const decl = buildContinueShapeDeclaration({ action });
    await _writePendingAction(combatant, decl);
    ui.notifications.info(game.i18n.format(decl.labelKey, decl.labelArgs));
    return;
  }

  // ── Release spell (cast) ───────────────────────────────────────────────
  if (action?.actionKey === "sorcery"
      && action.state?.spellId === item.id
      && (action.state?.completedShapeActions ?? 0) === (action.state?.totalShapeActions ?? 0)) {
    const decl = buildCastDeclaration({ action });
    await _writePendingAction(combatant, decl);
    ui.notifications.info(game.i18n.format(decl.labelKey, decl.labelArgs));
    return;
  }

  // ── First shape: confirm dialog → spend costs → write state ───────────
  const result = await SorceryCastDialog.prompt({
    spell: item, actor, circle: sys.circle ?? 1
  });
  if (!result?.ok) return;

  // Spend motes (peripheral preferred; spendMotes overflows to personal
  // automatically). Capture the per-pool split so refund can return
  // motes to exactly the pools they came from — recoverMotes is
  // single-pool, so we store both halves.
  const motesCost = sys.cost?.motes ?? 0;
  const wpCost    = sys.cost?.willpower ?? 0;
  const moteResult = motesCost > 0 ? await actor.spendMotes(motesCost, "peripheral") : null;
  if (motesCost > 0 && !moteResult) return;  // spendMotes posted a warning

  // Spend willpower.
  if (wpCost > 0) {
    const currentWp = actor.system?.willpower?.value ?? 0;
    await actor.update({
      "system.willpower.value": Math.max(0, currentWp - wpCost)
    });
  }

  // Stamp the sticky DV AE for the shape penalty.
  const decl = buildShapeDeclaration({ spell: item });
  let dvEffectId = null;
  if (decl.dvPenalty > 0) {
    const eff = await actor.applyDVPenalty("sorcery-shape", decl.dvPenalty, {
      label:  game.i18n.format("EX2E.SorceryShapingDvLabel",
                               { spell: item.name }),
      sticky: true
    });
    dvEffectId = eff?.id ?? null;
  }

  // Write multiTickAction (sorcery state) + pendingAction (first shape).
  const totalShapeActions = sys.circle ?? 1;
  await combatant.setFlag("exalted2e", "multiTickAction", {
    actionKey:    "sorcery",
    startTick:    combatant.parent?.currentTick ?? 0,
    totalTicks:   0,           // sorcery is commit-driven; no auto-tick
    ticksElapsed: 0,
    cycleCount:   0,
    state: {
      spellId:               item.id,
      spellName:             item.name,
      circle:                sys.circle ?? 1,
      totalShapeActions,
      completedShapeActions: 0,
      motesCommitted:        motesCost,
      wpCommitted:           wpCost,
      // Pool-accurate refund tracking. spendMotes drains primaryPool
      // first, overflows to secondaryPool. Storing both lets the
      // refund return exactly what was taken from each pool.
      motesFromPrimary:      moteResult?.fromPrimary   ?? 0,
      motesFromSecondary:    moteResult?.fromSecondary ?? 0,
      primaryPool:           moteResult?.primaryPool   ?? "peripheral",
      secondaryPool:         moteResult?.secondaryPool ?? "personal",
      // Legacy field retained for refundCommittedCosts fallback path only.
      // postCastChatCard now reads motesFromPrimary/Secondary for display.
      motePool:              moteResult?.primaryPool   ?? "peripheral",
      dvEffectId
    }
  });
  await combatant.setFlag("exalted2e", "pendingAction", {
    actionKey: decl.actionKey,
    spellId:   decl.spellId,
    label:     game.i18n.format(decl.labelKey, decl.labelArgs),
    speed:     decl.speed,
    dvPenalty: decl.dvPenalty,
    abortable: decl.abortable,
    dvEffectId
  });
  ui.notifications.info(game.i18n.format("EX2E.SpellCastShapingBtn",
                                         { k: 1, total: totalShapeActions }));
}

async function _writePendingAction(combatant, decl) {
  await combatant.setFlag("exalted2e", "pendingAction", {
    actionKey: decl.actionKey,
    spellId:   decl.spellId,
    label:     game.i18n.format(decl.labelKey, decl.labelArgs),
    speed:     decl.speed,
    dvPenalty: decl.dvPenalty,
    abortable: decl.abortable
  });
}
