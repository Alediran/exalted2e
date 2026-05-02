import { aggregateStuntPayouts } from "./stunt-math.mjs";

/**
 * Single banking entry point used by every stunt-bearing roll site.
 *
 * Branches:
 *   - actor.type !== "character"     → no-op (NPC has no structured pools)
 *   - reward.stunt < 1               → no-op
 *   - in combat with this actor      → push record onto combatant flag
 *   - else                           → pay immediately
 *
 * @param {Actor} actor
 * @param {{stunt:number, advancesMotivation:boolean, rewardKind:"motes"|"willpower", sourceMessageId?:string}} reward
 */
export async function bankStuntReward(actor, reward) {
  if (!actor || actor.type !== "character") return;
  if (!reward || (Number(reward.stunt) || 0) < 1) return;

  const combatant = (game.combats?.contents ?? [])
    .flatMap(c => c.combatants?.contents ?? [])
    .find(c => c.actorId === actor.id) ?? null;

  if (combatant) {
    const existing = combatant.getFlag("exalted2e", "pendingStuntRewards") ?? [];
    const next = [...existing, {
      stunt:              Number(reward.stunt) || 0,
      advancesMotivation: !!reward.advancesMotivation,
      rewardKind:         reward.rewardKind === "willpower" ? "willpower" : "motes",
      sourceMessageId:    reward.sourceMessageId ?? null
    }];
    await combatant.setFlag("exalted2e", "pendingStuntRewards", next);
    return;
  }

  await payStuntRewardImmediate(actor, reward);
}

/**
 * Out-of-combat single-shot payout. Builds a one-element rewards array,
 * runs the aggregate math against actor pool headroom, applies one
 * actor.update, and posts the chat card.
 *
 * @param {Actor} actor
 * @param {{stunt:number, advancesMotivation:boolean, rewardKind:"motes"|"willpower"}} reward
 */
export async function payStuntRewardImmediate(actor, reward) {
  if (!actor || actor.type !== "character") return;
  const stunt = Number(reward?.stunt) || 0;
  if (stunt < 1) return;

  const headroom = _readHeadroom(actor);
  const agg = aggregateStuntPayouts({
    rewards: [{
      stunt,
      advancesMotivation: !!reward.advancesMotivation,
      rewardKind:         reward.rewardKind === "willpower" ? "willpower" : "motes"
    }],
    ...headroom
  });

  await _applyAggregate(actor, agg);
  await _postCard(actor, agg);
}

/**
 * Drain combatant.flags.exalted2e.pendingStuntRewards: aggregate via the
 * pure math, run one actor.update, post the summary card, clear the flag.
 * No-op when the flag is missing or empty — safe to call unconditionally.
 *
 * @param {Combatant} combatant
 */
export async function payPendingStuntRewards(combatant) {
  if (!combatant) return;
  const rewards = combatant.getFlag("exalted2e", "pendingStuntRewards") ?? [];
  if (!Array.isArray(rewards) || rewards.length === 0) return;

  const actor = combatant.actor;
  if (!actor || actor.type !== "character") {
    // Stale flag on a non-character combatant; drop it.
    await combatant.update({ "flags.exalted2e.-=pendingStuntRewards": null });
    return;
  }

  const headroom = _readHeadroom(actor);
  const agg = aggregateStuntPayouts({ rewards, ...headroom });

  await _applyAggregate(actor, agg);
  await _postCard(actor, agg);
  await combatant.update({ "flags.exalted2e.-=pendingStuntRewards": null });
}

// ── internals ─────────────────────────────────────────────────────────

function _readHeadroom(actor) {
  const motes = actor.system?.motes ?? {};
  const wp    = actor.system?.willpower ?? {};
  const personal = motes.personal ?? { value: 0, max: 0 };
  const peripheral = motes.peripheral ?? { value: 0, max: 0 };
  return {
    personalAvailable:   Math.max(0, (Number(personal.max)   || 0) - (Number(personal.value)   || 0)),
    peripheralAvailable: Math.max(0, (Number(peripheral.max) || 0) - (Number(peripheral.value) || 0)),
    willpowerAvailable:  Math.max(0, (Number(wp.max)         || 0) - (Number(wp.value)         || 0))
  };
}

async function _applyAggregate(actor, agg) {
  const updates = {};
  if (agg.toPersonal > 0) {
    const cur = Number(actor.system.motes.personal.value) || 0;
    updates["system.motes.personal.value"] = cur + agg.toPersonal;
  }
  if (agg.toPeripheral > 0) {
    const cur = Number(actor.system.motes.peripheral.value) || 0;
    updates["system.motes.peripheral.value"] = cur + agg.toPeripheral;
  }
  if (agg.toWillpower > 0) {
    const cur = Number(actor.system.willpower.value) || 0;
    updates["system.willpower.value"] = cur + agg.toWillpower;
  }
  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }
}

async function _postCard(actor, agg) {
  const hasWaste = agg.wastedMotes > 0 || agg.wastedWillpower > 0;
  const context = {
    actorName:       actor.name,
    rewards:         agg.perRecord,
    hasWaste,
    wastedMotes:     agg.wastedMotes,
    wastedWillpower: agg.wastedWillpower
  };
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/stunt-reward.hbs",
    context
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}
