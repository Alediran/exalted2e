/**
 * chat-cards.mjs – Chat-message listener hooks and helpers.
 * Extracted from module/exalted2e.mjs during the entry-point-split refactor.
 */

import { EX2E }             from "../config.mjs";
import { evaluateCharmFormula } from "../documents/item.mjs";
import { ex2eCan }          from "../helpers/permissions.mjs";
import { resolveUserActor } from "../helpers/targeting.mjs";
import { computeAttackOutcome } from "../rolls/attack-math.mjs";
import { planLedgerRefund } from "../rolls/activation-ledger.mjs";
import { countSuccesses }   from "../rolls/dice-math.mjs";
import {
  applySocialInfluenceEffects,
  clearSocialInfluenceEffects
} from "../ui/social-influence-effects.mjs";
import {
  applyRefusalMath,
  applyRefundMath
} from "../rolls/motivation-break-math.mjs";
import { resolveKnockbackChain, onKnockdownResistClick } from "../combat/knockback.mjs";
import { resolveStep2, computeMdvExcellencyCaps } from "../rolls/social-attack-math.mjs";
import { Step2SocialDefenseDialog } from "../dialogs/step2-social-defense-dialog.mjs";
import { computeGmRollPool } from "../dialogs/gm-roll-pool-dialog.mjs";
import { rollExhaustion }    from "../rolls/unit-action-roll.mjs";
import { getTargetPenaltyChanges, collectStatusApplyCharms } from "../rolls/charm-event-math.mjs";
import {
  _applyStatusEffect,
  _applyFluxDamage,
} from "./actor-lifecycle.mjs";
import { buildLimitBreakEffectData } from "../combat/limit-break-effect.mjs";

// ── Limit Break resolution ─────────────────────────────────────────────────
export async function _resolveLimitBreak(message, choice) {
  const lb = message.flags?.exalted2e?.limitBreak;
  if (!lb || lb.resolved) return;

  const actor = game.actors.get(lb.actorId);
  if (!actor) return;
  if (!actor?.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
    return;
  }

  const updates = { "system.limit": 0 };

  if (choice === "full" && lb.virtueRating > 0) {
    const current = actor.system.willpower.value ?? 0;
    const max     = actor.system.willpower.max   ?? 0;
    updates["system.willpower.value"] = Math.min(current + lb.virtueRating, max);
  }

  await actor.update(updates);

  const virtueFlaw = actor.items.get(lb.virtueFlawId) ?? null;
  const enrichedDescription = virtueFlaw
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(virtueFlaw.system.description ?? "")
    : "";
  const localizedVirtue = virtueFlaw
    ? game.i18n.localize(EX2E.virtues[virtueFlaw.system.baseVirtue] ?? "")
    : "";

  // Stamp the scene-duration break effect. Dedup guard: never stamp twice
  // (e.g. if the card is resolved more than once). The AE is flagged
  // charmDuration: "oneScene" so clearSceneCharms removes it at scene end.
  if (virtueFlaw && !actor.effects.some(e => e.flags?.exalted2e?.limitBreakEffect)) {
    const aeName = game.i18n.format("EX2E.LimitBreakAEName", { virtue: localizedVirtue });
    await actor.createEmbeddedDocuments("ActiveEffect", [
      buildLimitBreakEffectData(virtueFlaw, aeName),
    ]);
  }

  const newContent = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/limit-break-card.hbs",
    {
      actor,
      virtueFlaw,
      virtueRating:    lb.virtueRating,
      enrichedDescription,
      resolved:        true,
      choice,
      localizedVirtue,
    }
  );

  await message.update({
    content: newContent,
    "flags.exalted2e.limitBreak.resolved": true,
    "flags.exalted2e.limitBreak.choice":   choice,
  });
}

// ── Act of Villainy resolution ─────────────────────────────────────────────
export async function _resolveActOfVillainy(message, successes) {
  const aov   = message.flags?.exalted2e?.actOfVillainy;
  if (!aov || aov.rolled) return;
  const actor = game.actors.get(aov.actorId);
  if (!actor) return;
  const newTorment = Math.max(0, (actor.system.limit ?? 0) - successes);
  await actor.update({ "system.limit": newTorment });
  await message.update({
    flags: { exalted2e: { actOfVillainy: { ...aov, rolled: true } } }
  });
}

// ── Attack-success hook helper ─────────────────────────────────────────────
function _tryFireAttackSuccess(newAttack) {
  if (newAttack.attackSuccessFired) return;
  const outcome = computeAttackOutcome(newAttack);
  if (!outcome.showResolution || !outcome.hit) return;
  newAttack.attackSuccessFired = true;
  Hooks.callAll("exalted2e.attackSuccess", { attackerActorId: newAttack.actorId, attack: newAttack });
}

// ── Per-damage-level targetEffect helper ──────────────────────────────────
async function _applyPerDamageLevelEffects(message, targetActor, rawDamage) {
  if (!rawDamage || rawDamage <= 0) return;
  const attack = message.flags?.exalted2e?.attack;
  const attackerActor = game.actors.get(attack?.actorId);
  if (!attackerActor || !attack?.attackCharms?.length) return;
  for (const name of attack.attackCharms) {
    const charm = attackerActor.items.find(i => i.name === name);
    const te = charm?.system?.targetEffect;
    if (!te?.enabled || !te.perDamageLevel || te.trigger !== "onHit") continue;
    const scaledAmount = (te.internalPenalty?.amount ?? -1) * rawDamage;
    const scaledTe = {
      ...te,
      internalPenalty: { ...te.internalPenalty, amount: scaledAmount },
    };
    await targetActor.applyCharmTargetEffect(scaledTe);
  }
}

// ── On-damage-dealt mote recovery helper (Ravening Mouth family) ──────────
async function _applyDamageDealtMoteRecovery(message, targetActor, rawDamage) {
  if (!rawDamage || rawDamage <= 0) return;
  const attack = message.flags?.exalted2e?.attack;
  const attackerActor = game.actors.get(attack?.actorId);
  if (!attackerActor || attackerActor.type !== 'character') return;
  if (!attack?.attackCharms?.length) return;

  const charms = attack.attackCharms
    .map(n => attackerActor.items.find(i => i.name === n))
    .filter(c => c?.system?.moteRecovery?.enabled && c.system.moteRecovery.event === 'onDamageDealt');
  if (!charms.length) return;

  for (const charm of charms) {
    const mr = charm.system.moteRecovery;
    if (mr.sentientOnly) {
      const isSentient = targetActor.type === 'character' ||
        (targetActor.type === 'npc' && targetActor.system?.npcType !== 'beast');
      if (!isSentient) continue;
    }
    const rollData = attackerActor.getRollData() ?? {};
    const base = evaluateCharmFormula(mr.formula, rollData, 0);
    const amount = mr.perDamageLevel ? base * rawDamage : base;
    const capped = Math.min(amount, mr.maxRecovery ?? 20);
    if (capped <= 0) continue;
    if (mr.action === 'gainOverdrive') {
      await attackerActor.addOverdriveMotes(capped);
    } else {
      const pool = mr.action === 'recoverPersonal' ? 'personal' : 'peripheral';
      await attackerActor.recoverMotes(capped, pool);
    }
  }
}

// ── Status-resist card helper ──────────────────────────────────────────────
async function _postStatusResistCard({ targetActorId, targetName, attackerName, charmName, status, resistPool, onFail }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/status-resist-card.hbs",
    { targetActorId, targetName, attackerName, charmName, status, resistPool, onFail }
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker(),
    flags: { exalted2e: { statusResist: { targetActorId, targetName, attackerName, charmName, status, resistPool, onFail } } }
  });
}

/**
 * Open the Step-2 social-defense dialog, apply the defender's choices
 * (charm activations, Excellency mote spend, perfect-defense / motes-resist
 * keyword detection), and update the chat-card flags with the resolved
 * hit/wpToResist outcome. Triggers a card rerender at the end.
 */
async function _resolveSocialAttackStep2(message) {
  const record = message.flags?.exalted2e?.socialAttack;
  // Re-defend after Reverse is allowed: Task 8 resets `step2Resolved` to
  // false but leaves `reversed: true` as a visual indicator. The atomic
  // update below clears `reversed` when the new outcome stamps over the
  // prior one. Bail only on missing record or already-resolved Step-2.
  if (!record || record.step2Resolved) return;

  const defender = game.actors.get(record.defenderId);
  if (!defender) return;
  if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
    return;
  }

  // Collect candidate charms: defender's Reflexive Step-2 charms whose
  // ability is one of the social-defense kit OR carry a Step-2 social
  // keyword. Heuristic — refines in 3c when keywords drive attacker
  // tagging.
  const SOCIAL_DEFENSE_ABILITIES = new Set([
    "integrity", "presence", "performance", "investigation", "bureaucracy"
  ]);
  const STEP2_KEYWORDS = new Set([
    "Perfect Mental Defense", "Resist Unnatural Mental Influence"
  ]);
  const candidates = defender.items.filter(i => {
    if (i.type !== "charm") return false;
    if (i.system?.charmType !== "reflexive") return false;
    if (!(i.system?.steps ?? []).includes(2)) return false;
    const ability = i.system?.ability ?? "";
    if (SOCIAL_DEFENSE_ABILITIES.has(ability)) return true;
    const kws = i.system?.keywords ?? [];
    return kws.some(k => STEP2_KEYWORDS.has(k));
  });

  // Excellency wiring: same pattern as the attacker AttackDialog.
  const exaltType   = defender.system?.exaltType ?? "";
  const isAttrBased = exaltType === "lunar" || exaltType === "alchemical";
  const allCharms   = defender.items.filter(i => i.type === "charm");
  const excKey      = isAttrBased
    ? (record.intent === "erode" ? "manipulation" : "stamina")
    : (record.intent === "erode" ? "presence"     : "integrity");
  const firstExc    = allCharms.find(c => c.system.excellency === "first"  && c.system.ability === excKey);
  const secondExc   = allCharms.find(c => c.system.excellency === "second" && c.system.ability === excKey);

  const { firstExcMax, secondExcMax } = computeMdvExcellencyCaps(record.intent, defender);

  const dialogResult = await Step2SocialDefenseDialog.prompt({
    charms:            candidates,
    intent:            record.intent,
    defenderMDV:       record.preStep2EffectiveMDV ?? 0,
    attackerSuccesses: record.rollSuccesses ?? 0,
    targetName:        defender.name,
    excellency:        { first: !!firstExc, second: !!secondExc },
    firstExcMax,
    secondExcMax,
    firstExcLabel:     firstExc?.name  ?? game.i18n.localize("EX2E.FirstExcellency"),
    secondExcLabel:    secondExc?.name ?? game.i18n.localize("EX2E.SecondExcellency")
  });
  if (!dialogResult) return;       // cancelled — card stays in step2-pending

  // Activate each selected charm via the standard activation pipeline —
  // each charm posts its own card with its own Reverse button.
  const activatedKeywords = new Set();
  const activatedCharmIds = [];
  for (const charmId of dialogResult.charmIds) {
    const charm = defender.items.get(charmId);
    if (!charm) continue;
    await charm.activateCharm({ skipXpConfirm: true, via: "step2-social" });
    activatedCharmIds.push(charmId);
    for (const kw of (charm.system?.keywords ?? [])) {
      activatedKeywords.add(kw);
    }
  }

  // Spend defender Excellency motes. firstExcDice = 1m each, secondExcSucc
  // = 2m each. Use defender.spendMotes for the per-pool breakdown so the
  // Reverse handler can refund accurately.
  const totalMoteCost = (dialogResult.firstExcDice ?? 0) + (dialogResult.secondExcSucc ?? 0) * 2;
  let defenderMoteSpend = null;
  if (totalMoteCost > 0) {
    defenderMoteSpend = await defender.spendMotes(totalMoteCost, dialogResult.moteType);
    // spendMotes emits EX2E.NotEnoughMotes itself on failure; just bail.
    if (!defenderMoteSpend) return;
  }

  // Resolve the Step-2 outcome.
  const resolved = resolveStep2({
    rollSuccesses:           record.rollSuccesses,
    baseMDV:                 record.baseMDV,
    stackingMod:             record.stackingMod,
    mdvShiftFromApp:         record.mdvShiftFromApp,
    isUnnatural:             record.unnaturalInfluence,
    autoFailedByNaturalCap:  record.autoFailedByNaturalCap,
    firstExcDice:            dialogResult.firstExcDice  ?? 0,
    secondExcSucc:           dialogResult.secondExcSucc ?? 0,
    activatedKeywords,
    umiCostSum:              record.umiCostSum ?? 0
  });

  // Auto-stamp resolution for perfect-defense and motes-resist outcomes.
  let resolution = null;
  if (resolved.perfectDefense) {
    resolution = {
      outcome:                       "perfect-defended",
      wpSpentByDefender:             0,
      erodedIntimacyId:              null,
      erodedIntimacyStrengthBefore:  null,
      erodedIntimacyStrengthAfter:   null,
      erodedIntimacyName:            null
    };
  } else if (resolved.motesResistApplied && resolved.hit) {
    resolution = {
      outcome:                       "resisted-via-motes",
      wpSpentByDefender:             0,
      erodedIntimacyId:              null,
      erodedIntimacyStrengthBefore:  null,
      erodedIntimacyStrengthAfter:   null,
      erodedIntimacyName:            null
    };
  }

  // Update the chat-card flags in one atomic write. `reversed: false`
  // is included so re-defending after a Reverse correctly clears the
  // "reversed" indicator from the prior outcome (Task 8 sets reversed
  // to true on Reverse — this resets it to a fresh state).
  const updates = {
    "flags.exalted2e.socialAttack.reversed":           false,
    "flags.exalted2e.socialAttack.step2Resolved":      true,
    "flags.exalted2e.socialAttack.step2Result":        dialogResult,
    "flags.exalted2e.socialAttack.defenderCharmIds":   activatedCharmIds,
    "flags.exalted2e.socialAttack.defenderMoteSpend":  defenderMoteSpend,
    "flags.exalted2e.socialAttack.effectiveMDV":       resolved.effectiveMDV,
    "flags.exalted2e.socialAttack.hit":                resolved.hit,
    "flags.exalted2e.socialAttack.wpToResist":         resolved.wpToResist,
    "flags.exalted2e.socialAttack.perfectDefense":     resolved.perfectDefense,
    "flags.exalted2e.socialAttack.motesResistApplied": resolved.motesResistApplied
  };
  if (resolution) {
    updates["flags.exalted2e.socialAttack.resolution"] = resolution;
  }
  await message.update(updates);
  await _rerenderSocialAttackCard(message);
}

// ── Social attack re-render helper ─────────────────────────────────────────
/**
 * Re-render the social-attack chat card after a state change. Rebuilds
 * the context by spreading the ledger (which carries the pool-breakdown
 * fields) and re-computing the live
 * permission / affordability / picker flags from current actor state.
 */
async function _rerenderSocialAttackCard(message) {
  const record = message.flags?.exalted2e?.socialAttack;
  if (!record) return;

  const attacker = game.actors.get(record.attackerId);
  const defender = game.actors.get(record.defenderId);
  const intimacies = defender
    ? defender.items.filter(i => i.type === "intimacy").map(i => ({
        id:     i.id,
        name:   i.name,
        system: {
          subject:  i.system?.subject  ?? "",
          strength: i.system?.strength ?? 0
        }
      }))
    : [];

  const intentLabel = game.i18n.localize({
    build:  "EX2E.IntentBuild",
    erode:  "EX2E.IntentErode",
    compel: "EX2E.IntentCompel"
  }[record.intent] ?? "EX2E.SocialAttack");

  const cardContext = {
    ...record,
    intentLabel,
    attackerName:     attacker?.name ?? "",
    attackerImg:      attacker?.img  ?? "",
    defenderName:     defender?.name ?? "",
    defenderImg:      defender?.img  ?? "",
    canDefend:        !record.step2Resolved && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    canRespond:       game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER")),
    canAffordResist:  (defender?.system?.willpower?.value ?? 0) >= (record.wpToResist ?? 0),
    canReverse:       game.user.isGM || (attacker && attacker.testUserPermission(game.user, "OWNER")),
    isGM:             game.user.isGM,
    hasIllusion:      (record.attackerCharmKeywords ?? []).includes("Illusion"),
    umiCostSum:       record.umiCostSum ?? 0,
    isUMI:            (record.umiCostSum ?? 0) > 0,
    // 3c-2: Motivation-break display flags
    canRefuse: record.isMotivationBreak
            && record.step2Resolved
            && record.hit === true
            && !record.resolution
            && (defender?.system?.willpower?.max ?? 0) > 0
            && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    canBreak: record.isMotivationBreak
           && record.step2Resolved
           && record.hit === true
           && !record.resolution
           && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    motivationBreakProgressLabel: record.isMotivationBreak
      ? game.i18n.format("EX2E.MotivationBreakChatCampaignProgress", {
          count:  record.campaignAttemptCount ?? 0,
          target: record.targetMotivation     ?? ""
        })
      : "",
    motivationBreakRefusedLabel: record.resolution?.outcome === "break-refused"
      ? game.i18n.format("EX2E.MotivationBreakResolutionRefused", {
          defender: defender?.name ?? ""
        })
      : "",
    motivationBreakBrokenLabel: record.resolution?.outcome === "broken"
      ? game.i18n.format("EX2E.MotivationBreakResolutionBroken", {
          defender: defender?.name ?? "",
          target:   record.targetMotivation ?? ""
        })
      : "",
    defenderIntimacies: intimacies,
    // 3c-1: derived display fields for attacker activated charms + Excellency
    attackerCharmNames: (record.attackerCharmIds ?? [])
      .map(id => attacker?.items?.get(id)?.name)
      .filter(n => !!n),
    hasAttackerCharms: (record.attackerCharmIds ?? []).length > 0,
    hasAttackerExcellency: (record.attackerExcMoteCost ?? 0) > 0,
    attackerExcellencyLabel: ((record.attackerExcMoteCost ?? 0) > 0)
      ? game.i18n.format("EX2E.AttackerExcellencyApplied", {
          dice: record.attackerFirstExcDice  ?? 0,
          succ: record.attackerSecondExcSucc ?? 0,
          cost: record.attackerExcMoteCost   ?? 0
        })
      : ""
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/social-attack-card.hbs",
    cardContext
  );
  await message.update({ content });
}

// ── Chat-card hook registrations ───────────────────────────────────────────

export function registerChatCardHooks() {
  // ── Chat Listeners ─────────────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    // Resolve the raw DOM element (html may be jQuery or HTMLElement)
    const el = html instanceof HTMLElement ? html : html[0] ?? html;

    // ── Reverse charm activation ──────────────────────────────────────────
    // Reverses everything the charm's activation ledger (stored on the
    // message's flags) recorded: refunds motes to the pools they came
    // from, restores willpower, flips sustained charms back off, tears
    // down spawned weapon artifacts, and disables the button so we don't
    // double-refund on subsequent clicks.
    el.querySelector?.(".btn-reverse-charm")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.charmActivation;
      if (!record || record.reversed) return;

      const actor = record.actorId ? game.actors.get(record.actorId) : null;
      if (!actor?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
        return;
      }

      // ── Combined activation card (combo / multi-supplemental) ─────────────
      if (record.combined) {
        for (const entry of record.entries ?? []) {
          if (entry.reversed) continue;
          const entryActor = entry.actorId ? game.actors.get(entry.actorId) : actor;
          if (!entryActor) continue;
          const { updates } = planLedgerRefund(entry.ledger ?? {}, entryActor.system);
          if (Object.keys(updates).length > 0) await entryActor.update(updates);
          const charm = entry.charmId ? entryActor.items.get(entry.charmId) : null;
          if (charm) {
            const ledger = entry.ledger ?? {};
            if (ledger.stackedOn) {
              const newCount = Math.max(0, (charm.system.stackCount ?? 1) - 1);
              const upd = { "system.stackCount": newCount };
              if (newCount === 0) upd["system.active"] = false;
              await charm.update(upd);
            } else {
              if (ledger.toggledOn && charm.system.active) {
                const upd = { "system.active": false };
                if (charm.system.keywords?.includes("Stackable")) upd["system.stackCount"] = 0;
                await charm.update(upd);
              } else if (ledger.toggledOff && !charm.system.active) {
                await charm.update({ "system.active": true });
              }
              if (ledger.spawnedWeapon) await charm._removeCharmWeaponArtifacts();
            }
          }
        }
        await message.update({
          flags: { exalted2e: { charmActivation: { ...record, reversed: true } } }
        });
        const btn = ev.currentTarget;
        btn.disabled = true;
        btn.classList.add("is-reversed");
        btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.CharmReversed")}`;
        ui.notifications.info(game.i18n.localize("EX2E.CharmReversed"));
        return;
      }

      // ── Single activation card ────────────────────────────────────────────
      const ledger = record.ledger ?? {};
      const { updates } = planLedgerRefund(ledger, actor.system);

      if (Object.keys(updates).length > 0) await actor.update(updates);

      // Undo toggle state and weapon artifacts on the charm itself.
      const charm = record.charmId ? actor.items.get(record.charmId) : null;
      if (charm) {
        if (ledger.stackedOn) {
          // Decrement one stack from a Stackable charm; turn off when the last stack is reversed.
          const newCount = Math.max(0, (charm.system.stackCount ?? 1) - 1);
          const updates  = { "system.stackCount": newCount };
          if (newCount === 0) updates["system.active"] = false;
          await charm.update(updates);
        } else {
          if (ledger.toggledOn && charm.system.active) {
            const updates = { "system.active": false };
            if (charm.system.keywords?.includes("Stackable")) updates["system.stackCount"] = 0;
            await charm.update(updates);
          } else if (ledger.toggledOff && !charm.system.active) {
            await charm.update({ "system.active": true });
          }
          if (ledger.spawnedWeapon) {
            await charm._removeCharmWeaponArtifacts();
          }
        }
      }

      // Mark the record so the button can't fire again and the card's
      // Reverse row can be visually retired via the renderer below.
      await message.update({
        flags: { exalted2e: { charmActivation: { ...record, reversed: true } } }
      });

      // Visually retire the button in place (no full rerender needed).
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-reversed");
      btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.CharmReversed")}`;
      ui.notifications.info(game.i18n.localize("EX2E.CharmReversed"));
    });

    // Retire the button on subsequent renders if the record was already
    // reversed (e.g. message reload after a refund).
    if (message.flags?.exalted2e?.charmActivation?.reversed) {
      const btn = el.querySelector(".btn-reverse-charm");
      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-reversed");
        btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.CharmReversed")}`;
      }
    }

    // ── Reverse Greater Sign activation ──────────────────────────────────
    const reverseSignBtn = el.querySelector?.(".btn-reverse-sign");
    if (reverseSignBtn) {
      if (message.flags?.exalted2e?.signActivation?.reversed) {
        reverseSignBtn.disabled = true;
        reverseSignBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.GreaterSignReversed")}`;
      } else {
        reverseSignBtn.addEventListener("click", async (ev) => {
          const record = message.flags?.exalted2e?.signActivation;
          if (!record || record.reversed) return;

          const actor = record.actorId ? game.actors.get(record.actorId) : null;
          if (!actor?.testUserPermission(game.user, "OWNER")) {
            ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
            return;
          }
          const item = record.itemId ? actor.items.get(record.itemId) : null;
          if (!item) return;

          const btn = ev.currentTarget;
          btn.disabled = true; // prevent double-click while async work runs

          const { _reverseGreaterSignActivation } = await import(
            "../sheets/actor/character-sheet.mjs"
          );
          await _reverseGreaterSignActivation(actor, item);
          await message.update({
            flags: { exalted2e: { signActivation: { ...record, reversed: true } } }
          });

          btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.GreaterSignReversed")}`;
          ui.notifications.info(game.i18n.localize("EX2E.GreaterSignReversed"));
        });
      }
    }

    // ── Reverse spell cast ────────────────────────────────────────────
    const reverseSpellBtn = el.querySelector?.(".btn-reverse-spell");
    if (reverseSpellBtn) {
      const spellRecord = message.flags?.exalted2e?.spellCast;
      if (spellRecord?.reversed) {
        reverseSpellBtn.disabled = true;
        reverseSpellBtn.classList.add("is-reversed");
        reverseSpellBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.SpellCastReversed")}`;
      } else {
        reverseSpellBtn.addEventListener("click", async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;

          const record = message.flags?.exalted2e?.spellCast;
          if (!record || record.reversed) return;

          const actor = record.actorId ? game.actors.get(record.actorId) : null;
          if (!actor) return;
          if (!actor.testUserPermission(game.user, "OWNER")) {
            ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
            return;
          }

          if (typeof actor.recoverMotes === "function") {
            if ((record.motesFromPrimary ?? 0) > 0) {
              await actor.recoverMotes(record.motesFromPrimary, record.primaryPool ?? "peripheral");
            }
            if ((record.motesFromSecondary ?? 0) > 0) {
              await actor.recoverMotes(record.motesFromSecondary, record.secondaryPool ?? "personal");
            }
          }

          if ((record.wpCommitted ?? 0) > 0) {
            const currentWp = actor.system?.willpower?.value ?? 0;
            const maxWp     = actor.system?.willpower?.max  ?? 0;
            await actor.update({
              "system.willpower.value": Math.min(maxWp, currentWp + record.wpCommitted)
            });
          }

          // Delete any AEs this spell cast created (tagged by payload system).
          for (const ae of [...actor.effects]) {
            if (ae.flags?.exalted2e?.spellCastSource === message.id) await ae.delete();
          }

          await message.update({
            flags: { exalted2e: { spellCast: { ...record, reversed: true } } }
          });

          btn.classList.add("is-reversed");
          btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.SpellCastReversed")}`;
          ui.notifications.info(game.i18n.localize("EX2E.SpellCastReversed"));
        });
      }
    }

    // ── Limit Break choice buttons ────────────────────────────────────────
    const lbCard = el.querySelector?.(".ex2e-limit-break-card");
    if (lbCard) {
      const lb = message.flags?.exalted2e?.limitBreak;
      if (lb && !lb.resolved) {
        lbCard.querySelector?.("[data-action='limitBreakFull']")
          ?.addEventListener("click", async () => { await _resolveLimitBreak(message, "full"); });
        lbCard.querySelector?.("[data-action='limitBreakPartial']")
          ?.addEventListener("click", async () => { await _resolveLimitBreak(message, "partial"); });
      }
    }

    // ── Apply Flux button ──────────────────────────────────────────────────────
    // Iterates `game.user.targets`. For burning/bonfire tiers, skips targets
    // with any natural lethal soak. For totemic, skips terrestrials only.
    // Range check is stubbed — canvas range-bands feature pending.
    const fluxBtn = el.querySelector?.(".btn-apply-flux");
    if (fluxBtn) {
      fluxBtn.addEventListener("click", async (ev) => {
        if (!game.user.isGM) return;
        const actor = game.actors.get(ev.currentTarget.dataset.actorId);
        await _applyFluxDamage(actor, ev.currentTarget.dataset.tier);
      });
    }

    // ── Flurry card attack buttons ────────────────────────────────────────
    // Each attack-typed action in a declared flurry gets its own button that
    // kicks off the normal attack roll flow. The dice penalty is applied by
    // rollAttack through the combatant's flurry flag, so nothing extra is
    // required here beyond dispatching to it.
    el.querySelectorAll?.(".btn-flurry-attack").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        const actorId   = ev.currentTarget.dataset.actorId;
        const weaponId  = ev.currentTarget.dataset.weaponId;
        const modeIndex = parseInt(ev.currentTarget.dataset.modeIndex) || 0;
        const actor     = actorId ? game.actors.get(actorId) : null;
        if (!actor?.testUserPermission(game.user, "OWNER")) {
          ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
          return;
        }
        const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
        await ExaltedRoll.rollAttack(actor, weaponId, { modeIndex });
      });
    });

    // ── Defense picker on attack cards ────────────────────────────────────
    // Target's owner (or GM) picks Dodge or Parry; writes the choice into
    // message flags and re-renders the card into its resolved state.
    el.querySelectorAll?.(".btn-defend").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        const defenseType = ev.currentTarget.dataset.defenseType;
        const attack      = message.flags?.exalted2e?.attack;
        if (!attack || attack.defense) return;

        const targetActor = attack.targetId ? game.actors.get(attack.targetId) : null;
        if (!targetActor?.testUserPermission(game.user, "OWNER")) {
          ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
          return;
        }
        const baseDV = defenseType === "dodge" ? attack.targetDodgeDV : attack.targetParryDV;

        // If the target has a sustained perfect defense AE active (from a
        // non-instant charm toggled on earlier in the scene), apply it
        // automatically — no Step 2 dialog needed.
        const sustainedPD = targetActor.effects.find(
          e => !e.disabled && e.flags?.exalted2e?.sustainedPerfectDefense
        );
        if (sustainedPD) {
          const pdt = sustainedPD.flags.exalted2e.sustainedPerfectDefense.type;
          const newAttack = {
            ...attack,
            defense:                  { type: defenseType, dv: baseDV },
            defenseCharms:            [sustainedPD.name],
            defenderHasThirdExc:      false,
            defenderExcKey:           "",
            defenderFirstExcDice:     0,
            defenderSecondExcSucc:    0,
            defenderHasCounterattack: false,
            perfectDefenseCharm:      sustainedPD.name,
            perfectDefenseType:       pdt
          };
          _tryFireAttackSuccess(newAttack);
          const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
          const content = await renderAttackCardContent(newAttack);
          await message.update({ content, flags: { exalted2e: { attack: newAttack } } });
          return;
        }

        // Filter the defender's Reflexive Step-2 Charms and pass them to the
        // dialog. The dialog opens every time the defender picks a defense —
        // it doubles as the confirmation step and renders an empty-state
        // message when no applicable charms exist.
        const allStep2 = targetActor.items.filter(i =>
          i.type === "charm" &&
          i.system.charmType === "reflexive" &&
          (i.system.steps ?? []).includes(2)
        );

        // Determine the ability key relevant to this defense so we can locate
        // matching Excellency charms. Ability-based exalts key excellencies to
        // the ability (dodge / melee / martialArts); Lunars & Alchemicals key
        // them to the attribute (dexterity).
        const tSys        = targetActor.system;
        const isAttrBased = ["lunar", "alchemical"].includes(tSys.exaltType);
        const dex         = tSys.attributes?.dexterity?.value ?? 0;
        const meleeVal    = tSys.abilities?.melee?.value       ?? 0;
        const maVal       = tSys.abilities?.martialArts?.value ?? 0;
        const abilKey     = isAttrBased ? "dexterity"
                          : defenseType === "dodge" ? "dodge"
                          : (maVal > meleeVal ? "martialArts" : "melee");
        const abilVal     = isAttrBased ? 0 : (tSys.abilities?.[abilKey]?.value ?? 0);
        const keyVal      = dex + abilVal;

        // Pull the First/Second Excellency charms keyed to this ability out of
        // the regular list so they render as input sections instead of
        // checkboxes (mirrors the Attack Dialog's pattern).
        const firstExcCharm  = allStep2.find(c => c.system.excellency === "first"  && c.system.ability === abilKey);
        const secondExcCharm = allStep2.find(c => c.system.excellency === "second" && c.system.ability === abilKey);
        const excIds         = new Set([firstExcCharm, secondExcCharm].filter(Boolean).map(c => c.id));

        // Only offer charms keyed to abilities that actually apply to this
        // defense: Dodge charms for Dodge, Melee/Martial Arts for Parry.
        // Lunars & Alchemicals key defensive charms to Dexterity.
        const relevantAbilities = isAttrBased
          ? new Set(["dexterity"])
          : defenseType === "dodge"
            ? new Set(["dodge"])
            : new Set(["melee", "martialArts"]);
        const regularCharms = allStep2.filter(c =>
          !excIds.has(c.id) && (
            relevantAbilities.has(c.system.ability) ||
            c.system.perfectDefenseType === "soak"
          )
        );

        const { Step2DefenseDialog } = await import("../dialogs/step2-defense-dialog.mjs");
        const result = await Step2DefenseDialog.prompt({
          charms:        regularCharms,
          defenseType,
          dv:            baseDV,
          targetName:    attack.targetName,
          excellency:    { first: !!firstExcCharm, second: !!secondExcCharm },
          firstExcMax:   keyVal,
          secondExcMax:  Math.ceil(keyVal / 2),
          firstExcLabel: firstExcCharm
            ? firstExcCharm.name
            : game.i18n.localize("EX2E.FirstExcellency"),
          secondExcLabel: secondExcCharm
            ? secondExcCharm.name
            : game.i18n.localize("EX2E.SecondExcellency")
        });
        if (!result) return;                          // user cancelled

        const activatedNames = [];
        // Track if the defender activated a Perfect Dodge / Perfect Parry /
        // Perfect Soak. Parry/Dodge trump everything downstream; Soak still
        // allows the attack to land but zeroes out the damage pool.
        let perfectDefenseCharm = null;
        let perfectDefenseType  = null;
        const step2Activations = result.charmActivations?.length
          ? result.charmActivations
          : (result.charmIds ?? []).map(id => ({ id, motesOverride: undefined }));
        for (const { id, motesOverride } of step2Activations) {
          const charm = targetActor.items.get(id);
          if (!charm) continue;
          const ok = await charm.activateCharm({
            explicitMotesOverride: motesOverride !== undefined ? motesOverride : null
          });
          if (!ok) continue;
          activatedNames.push(charm.name);
          if (!perfectDefenseCharm) {
            const pdt = charm.system.perfectDefenseType ?? "";
            if (pdt === "soak") {
              perfectDefenseCharm = charm.name;
              perfectDefenseType  = "soak";
            } else if (pdt === "parry" || pdt === "dodge") {
              perfectDefenseCharm = charm.name;
              perfectDefenseType  = pdt;
            }
          }
        }

        // Spend Excellency motes directly. charm.activateCharm() only pays the
        // fixed charm cost; Excellency cost is per die/success, collected from
        // the dialog inputs.
        const firstExcDice  = result.firstExcDice  ?? 0;
        const secondExcSucc = result.secondExcSucc ?? 0;
        const excMoteCost   = firstExcDice + (secondExcSucc * 2);
        if (excMoteCost > 0) {
          const spent = await targetActor.spendMotes(excMoteCost, result.moteType);
          if (!spent) return;
          if (firstExcCharm  && firstExcDice  > 0) activatedNames.push(firstExcCharm.name);
          if (secondExcCharm && secondExcSucc > 0) activatedNames.push(secondExcCharm.name);
        }

        // First Excellency adds dice to a roll — for a defensive DV, we roll
        // the purchased dice and only the resulting successes (10 = 2, 7-9 = 1)
        // bump the DV. Post the roll so the attacker can see what came up.
        let firstExcSuccesses = 0;
        if (firstExcDice > 0) {
          const excRoll = new Roll(`${firstExcDice}d10`);
          await excRoll.evaluate();
          for (const r of excRoll.terms[0].results) {
            if (r.result === 10)     firstExcSuccesses += 2;
            else if (r.result >= 7)  firstExcSuccesses += 1;
          }
        }

        // Second Excellency adds its successes directly; Third is not applied
        // to DVs here — it's used at Step 5 via the reroll button.
        const dv = baseDV + firstExcSuccesses + secondExcSucc;

        // Record defender-side Step-5 (Third Excellency reroll) eligibility.
        const defenderHasThirdExc = targetActor.items.some(c =>
          c.type === "charm" &&
          c.system.excellency === "third" &&
          c.system.ability === abilKey
        );

        // Record defender-side Step-9 (Counterattack) eligibility.
        const defenderHasCounterattack = targetActor.items.some(c =>
          c.type === "charm" &&
          (c.system.keywords ?? []).includes("Counterattack")
        );

        const newAttack = {
          ...attack,
          defense:                  { type: defenseType, dv },
          defenseCharms:            activatedNames,
          defenderHasThirdExc,
          defenderExcKey:           abilKey,
          defenderFirstExcDice:     firstExcDice,
          defenderSecondExcSucc:    secondExcSucc,
          defenderHasCounterattack,
          perfectDefenseCharm,
          perfectDefenseType
        };

        _tryFireAttackSuccess(newAttack);
        const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
        const content = await renderAttackCardContent(newAttack);
        await message.update({
          content,
          flags: { exalted2e: { attack: newAttack } }
        });
      });
    });

    // ── Manual DV resolve (no target selected) ────────────────────────────
    // GM enters a DV in the card's input and clicks Resolve; the card is
    // re-rendered against that DV.
    el.querySelector?.(".btn-resolve-manual")?.addEventListener("click", async (ev) => {
      const card    = ev.currentTarget.closest(".ex2e-attack-card");
      const input   = card?.querySelector(".manual-dv-input");
      const attack  = message.flags?.exalted2e?.attack;
      if (!attack || attack.defense) return;
      if (!ex2eCan("combatFlow")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const dv = Math.max(0, parseInt(input?.value) || 0);
      const newAttack = { ...attack, defense: { type: "manual", dv } };
      _tryFireAttackSuccess(newAttack);
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    // ── Step 4: Attacker Third-Excellency reroll ──────────────────────────
    // Attacker spends 4m to reroll the attack roll's failures (face < 7).
    // One-shot, and only when First/Second Excellency wasn't used.
    const recomputeDiceStats = (dice) => {
      const { rawSuccesses, ones, details } = countSuccesses(dice);
      // Preserve object identity in caller's array by mutating each element
      // with the fresh tally's succs/cls values.
      dice.forEach((d, i) => {
        d.succs = details[i].succs;
        d.cls   = details[i].cls;
      });
      return {
        dice,
        successes: Math.max(0, rawSuccesses),
        botch:     rawSuccesses <= 0 && ones > 0
      };
    };

    el.querySelector?.(".btn-attacker-reroll")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const attacker = game.actors.get(attack.actorId);
      if (!attacker?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }

      // Find the attacker's Third Excellency charm so we pay its actual cost
      // (motes + willpower) rather than a hard-coded value.
      const thirdExcCharm = attacker.items.find(c =>
        c.type === "charm" &&
        c.system.excellency === "third" &&
        c.system.ability === attack.attackerExcKey
      );
      if (!thirdExcCharm) return;
      const ok = await thirdExcCharm.activateCharm();
      if (!ok) return;

      const newDice = attack.dice.map(d => ({ ...d }));
      const failIdxs = newDice
        .map((d, i) => d.face < 7 ? i : -1)
        .filter(i => i >= 0);

      if (failIdxs.length > 0) {
        const roll = new Roll(`${failIdxs.length}d10`);
        await roll.evaluate();
        const faces = roll.terms[0].results.map(r => r.result);
        failIdxs.forEach((idx, i) => { newDice[idx].face = faces[i]; });
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          flavor:  `${game.i18n.localize("EX2E.ThirdExcellency")} — ${game.i18n.localize("EX2E.AttackRoll")}`,
          sound:   CONFIG.sounds.dice
        });
      }

      const { dice: finalDice, successes, botch } = recomputeDiceStats(newDice);
      const newAttack = {
        ...attack,
        dice:      finalDice,
        successes,
        botch,
        thirdExcUsedByAttacker: true
      };
      _tryFireAttackSuccess(newAttack);
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    // ── Step 5: Defender Third-Excellency DV bump ────────────────────────
    // Defender spends 4m to add floor(ability / 2) to their committed DV.
    // The ability is whichever was used to defend (dodge / melee / MA, or
    // dexterity for Lunars & Alchemicals) — stored as `defenderExcKey`.
    el.querySelector?.(".btn-defender-reroll")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const defender = game.actors.get(attack.targetId);
      if (!defender?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      // Find the defender's Third Excellency charm so we pay its actual cost
      // (motes + willpower) rather than a hard-coded value.
      const thirdExcCharm = defender.items.find(c =>
        c.type === "charm" &&
        c.system.excellency === "third" &&
        c.system.ability === attack.defenderExcKey
      );
      if (!thirdExcCharm) return;
      const ok = await thirdExcCharm.activateCharm();
      if (!ok) return;

      // Resolve the ability value from the key captured at defense-commit.
      const sys = defender.system;
      const key = attack.defenderExcKey;
      const abilityValue = sys.attributes?.[key]?.value
                        ?? sys.abilities?.[key]?.value
                        ?? 0;
      const dvBonus = Math.floor(abilityValue / 2);

      const newAttack = {
        ...attack,
        defense: { ...attack.defense, dv: (attack.defense.dv ?? 0) + dvBonus },
        thirdExcUsedByDefender: true
      };
      _tryFireAttackSuccess(newAttack);
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    // ── Skip-step buttons ────────────────────────────────────────────────
    // Attacker skips Step 4 (no Third-Exc reroll); defender skips Step 5 (no
    // DV bump). Advancing either flag lets renderAttackCardContent unlock
    // the next step or the final hit/miss/damage section.
    el.querySelector?.(".btn-attacker-pass")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const attacker = game.actors.get(attack.actorId);
      if (!attacker?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const newAttack = { ...attack, step4Passed: true };
      _tryFireAttackSuccess(newAttack);
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    el.querySelector?.(".btn-defender-pass")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const defender = game.actors.get(attack.targetId);
      if (!defender?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const newAttack = { ...attack, step5Passed: true };
      _tryFireAttackSuccess(newAttack);
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    // ── Step 9: Counterattack ────────────────────────────────────────────
    // Defender activates a Counterattack-keyword charm and fires a reflexive
    // attack back at the original attacker. The resulting attack card is
    // flagged `isCounterattack` so it doesn't offer its own Step 9.
    el.querySelector?.(".btn-counterattack")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const defender = game.actors.get(attack.targetId);
      if (!defender?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const originalAttacker = game.actors.get(attack.actorId);
      if (!originalAttacker) {
        ui.notifications.warn(game.i18n.format("EX2E.OriginalAttackerNotFound", { id: attack.actorId }));
        return;
      }

      const charms = defender.items.filter(i =>
        i.type === "charm" && (i.system.keywords ?? []).includes("Counterattack")
      );
      const equippedWeapons = defender.items.filter(i =>
        i.type === "weapon" && i.system.equipped
      );
      const weaponModes = equippedWeapons.flatMap(w =>
        (w.system.modes ?? []).map((mode, idx) => ({
          weaponId:  w.id,
          modeIndex: idx,
          label:     (w.system.modes.length > 1) ? `${w.name} — ${mode.name}` : w.name
        }))
      );

      const { CounterattackDialog } = await import("../dialogs/counterattack-dialog.mjs");
      const result = await CounterattackDialog.prompt({
        charms,
        weaponModes,
        targetName: originalAttacker.name
      });
      if (!result) return;

      const charm = defender.items.get(result.charmId);
      if (!charm) return;
      const ok = await charm.activateCharm();
      if (!ok) return;

      // Fire the counterattack. It will post its own attack card, flagged so
      // it can't recursively offer Step 9 on itself.
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const counterMessage = await ExaltedRoll.rollAttack(defender, result.weaponId, {
        modeIndex:               result.modeIndex,
        isCounterattack:         true,
        originalAttackMessageId: message.id,
        explicitTargetActor:     originalAttacker
      });

      // Mark the original attack as having triggered its counterattack so the
      // Step 9 buttons disappear and Roll Damage unlocks.
      const newAttack = {
        ...attack,
        counterattackTriggered: true,
        counterattackMessageId: counterMessage?.id ?? null,
        counterattackCharm:     charm.name
      };
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    el.querySelector?.(".btn-skip-counterattack")?.addEventListener("click", async () => {
      const attack = message.flags?.exalted2e?.attack;
      if (!attack || !attack.defense) return;
      const defender = game.actors.get(attack.targetId);
      if (!defender?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const newAttack = { ...attack, step9Passed: true };
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });

    // ── Area resist roll ─────────────────────────────────────────────────
    el.querySelector?.(".btn-roll-area-resist")?.addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const targetId  = btn.dataset.targetId;
      const messageId = btn.dataset.messageId;
      if (!targetId || !messageId) return;

      const msg = game.messages.get(messageId);
      if (!msg) return;
      const attack = msg.flags?.exalted2e?.attack;
      if (!attack?.isAreaAttack) return;

      const target = game.actors.get(targetId);
      if (!target) return;
      if (!target.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }

      const { areaResist } = attack;
      // Parse simple "ability+attribute" pool formula against target's roll data.
      const rollData = target.getRollData?.() ?? {};
      const poolStr = areaResist.pool ?? "stamina+resistance";
      let pool = 0;
      for (const part of poolStr.split("+")) {
        const key = part.trim();
        pool += rollData.attributes?.[key]?.value
             ?? rollData.abilities?.[key]?.value
             ?? (Number(rollData[key]) || 0);
      }
      pool = Math.max(1, pool);

      const { ExaltedRoll, renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const roll = new ExaltedRoll({ pool });
      const result = await roll.evaluate();
      const successes = result.successes ?? 0;
      const passed = successes >= (areaResist.difficulty ?? 1);

      // Store result and re-render the card.
      const existing = attack.areaResistResults ?? {};
      const updated  = { ...existing, [targetId]: { successes, passed } };
      const newAttackState = { ...attack, areaResistResults: updated, id: messageId };
      const content = await renderAttackCardContent(newAttackState);
      await msg.update({
        content,
        "flags.exalted2e.attack.areaResistResults": updated
      });

      // Post resist roll result to chat.
      await ChatMessage.create({
        content: `<div class="ex2e-roll-card">${target.name}: ${successes} ${game.i18n.localize("EX2E.Successes")} vs ${game.i18n.localize("EX2E.AreaResist")} (diff ${areaResist.difficulty})</div>`,
        rolls: [result.foundryRoll],
        sound: CONFIG.sounds.dice,
        speaker: ChatMessage.getSpeaker({ actor: target }),
      });
    });

    // ── Remove area template ─────────────────────────────────────────────
    el.querySelector?.(".btn-remove-area-template")?.addEventListener("click", async (ev) => {
      if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("EX2E.EffectGMOnlyRemoval"));
        return;
      }
      const regionId = ev.currentTarget.dataset.regionId;
      if (!regionId || !canvas.scene) return;
      await canvas.scene.deleteEmbeddedDocuments("Region", [regionId]);
    });

    // ── Apply area damage ────────────────────────────────────────────────
    el.querySelectorAll?.(".btn-apply-area-damage").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        const b = ev.currentTarget;
        const targetId     = b.dataset.targetId;
        const rawDamage    = parseInt(b.dataset.rawDamage)       || 0;
        const resistSucc   = parseInt(b.dataset.resistSuccesses) || 0;
        const damageType   = b.dataset.damageType   || "lethal";
        const resistEffect = b.dataset.resistEffect || "avoid";

        const target = game.actors.get(targetId);
        if (!target) return;
        if (!target.testUserPermission(game.user, "OWNER")) {
          ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
          return;
        }

        const finalDamage = resistEffect === "reduce"
          ? Math.max(0, rawDamage - resistSucc)
          : rawDamage;
        if (finalDamage > 0) await target.applyDamage(finalDamage, damageType);
      });
    });

    // "Roll Damage" button on attack result cards
    el.querySelector?.(".btn-roll-damage")?.addEventListener("click", async (event) => {
      const card       = event.currentTarget.closest(".ex2e-attack-card");
      const damagePool   = parseInt(card?.dataset.damagePool)   || 0;
      const damageType   = card?.dataset.damageType || "lethal";
      const overwhelming = parseInt(card?.dataset.overwhelming) || 0;
      const postSoakDice = parseInt(card?.dataset.postSoakDice) || 0;
      const soakEl       = card?.querySelector(".soak-input");
      const soak         = parseInt(soakEl?.value ?? soakEl?.textContent) || 0;
      const targetId     = card?.dataset.targetId || null;

      if (damagePool <= 0 && postSoakDice <= 0) return;

      // Roll the damage pool — post-soak dice bypass soak entirely
      const effectivePool = Math.max(damagePool - soak, overwhelming) + postSoakDice;
      const formula = `${effectivePool}d10`;
      const roll    = new Roll(formula);
      await roll.evaluate();

      // Fire the standard dice-roll feedback: Dice So Nice 3D animation
      // when the module is installed, and the vanilla dice sound otherwise
      // (DSN suppresses the sound automatically). Without this the damage
      // roll feels silent because the result is spliced into an existing
      // chat card rather than posted as its own roll message.
      if (game.dice3d?.showForRoll) {
        await game.dice3d.showForRoll(roll, game.user, true);
      } else {
        const audio = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
        audio?.play({
          src:      CONFIG.sounds.dice,
          volume:   game.settings.get("core", "globalInterfaceVolume") ?? 0.8,
          autoplay: true,
          loop:     false
        }, true);
      }

      const dice = roll.terms[0].results.map(r => r.result);
      let rawDamage = 0;
      const diceDetails = [];
      for (const face of dice) {
        let succs = 0;
        let cls   = "";
        if (face === 10)       { succs = 2; cls = "double-success"; rawDamage += 2; }
        else if (face >= 7)    { succs = 1; cls = "success";        rawDamage += 1; }
        else if (face === 1)   { cls = "one"; }
        else                   { cls = "miss"; }
        diceDetails.push({ face, succs, cls });
      }

      const damageTypeLabel = damageType === "lethal" ? "L" : damageType === "aggravated" ? "A" : "B";

      const autoApply    = game.settings.get("exalted2e", "autoApplyDamage");
      const showApplyBtn = rawDamage > 0 && !!targetId && !autoApply;

      // Store the damage result in the attack snapshot so re-renders from
      // renderAttackCardContent (e.g. knockback _persistAndRerender) preserve it.
      const damageResult = {
        diceDetails, rawDamage, effectivePool,
        damagePool, soak, postSoakDice,
        damageTypeLabel, damageType, targetId,
        showApplyBtn,
      };
      const attack = message.flags?.exalted2e?.attack ?? {};
      const updatedAttack = { ...attack, damageResult };
      const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(updatedAttack);
      await message.update({ content, flags: { exalted2e: { attack: updatedAttack } } });

      // Auto-apply damage to target if setting enabled
      if (rawDamage > 0 && targetId && autoApply) {
        const targetActor = game.actors.get(targetId);
        if (targetActor) {
          await targetActor.applyDamage(rawDamage, damageType);
          await _applyPerDamageLevelEffects(message, targetActor, rawDamage);
          await _applyDamageDealtMoteRecovery(message, targetActor, rawDamage);
        }
      }

      // Chain knockback resolution (auto-apply only).
      // _persistAndRerender reads attack from flags — which now includes
      // damageResult — so the damage dice survive the re-render.
      if (rawDamage > 0 && targetId && autoApply) {
        const targetActor = game.actors.get(targetId);
        if (targetActor) {
          await resolveKnockbackChain(message, { effectivePool, rawDamage }).catch(err =>
            console.error("exalted2e | knockback chain failed", err)
          );
        }
      }
    });

    el.querySelector?.(".btn-apply-damage")?.addEventListener("click", async (applyEvent) => {
      const btn = applyEvent.currentTarget;
      const dmg  = parseInt(btn.dataset.damage) || 0;
      const type = btn.dataset.damageType || "lethal";
      const tId  = btn.dataset.targetId;
      const effectivePool = parseInt(btn.dataset.effectivePool) || 0;
      const targetActor = game.actors.get(tId);
      if (targetActor && dmg > 0) {
        await targetActor.applyDamage(dmg, type);
        await _applyPerDamageLevelEffects(message, targetActor, dmg);
        await _applyDamageDealtMoteRecovery(message, targetActor, dmg);

        // Hide apply button via flags — keeps damageResult intact for re-renders.
        const attack = message.flags?.exalted2e?.attack ?? {};
        const updatedAttack = {
          ...attack,
          damageResult: { ...attack.damageResult, showApplyBtn: false },
        };
        const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
        const content = await renderAttackCardContent(updatedAttack);
        await message.update({ content, flags: { exalted2e: { attack: updatedAttack } } });

        await resolveKnockbackChain(message, { effectivePool, rawDamage: dmg }).catch(err =>
          console.error("exalted2e | knockback chain failed", err)
        );
      }
    });

    el.querySelector?.(".btn-knockdown-resist")?.addEventListener("click", async () => {
      await onKnockdownResistClick(message);
    });

    // ── Status resist roll ───────────────────────────────────────────────
    el.querySelector?.(".btn-roll-resist")?.addEventListener("click", async (ev) => {
      const btn        = ev.currentTarget;
      const targetId   = btn.dataset.targetId;
      const resistPool = btn.dataset.resistPool;
      const onFail     = btn.dataset.onFail;
      const status     = btn.dataset.status;
      const target     = game.actors.get(targetId);
      if (!target) return;
      btn.disabled = true;

      const rollData = target.getRollData() ?? {};
      const pool = evaluateCharmFormula(resistPool, rollData, 0);

      if (pool <= 0) {
        await _applyStatusEffect(target, onFail, status);
        return;
      }

      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const roll = new ExaltedRoll({ pool, flavor: `${status} ${game.i18n.localize("EX2E.ResistRoll")}` });
      await roll.evaluate();
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target }) });
      if ((roll.successes ?? 0) === 0) {
        await _applyStatusEffect(target, onFail, status);
      }
    });

    // ── Social attack: defender Step-2 ────────────────────────────────────
    el.querySelector?.(".btn-social-step2")?.addEventListener("click", async (ev) => {
      await _resolveSocialAttackStep2(message);
    });

    // ── Social attack: Spend WP to resist ─────────────────────────────────
    el.querySelector?.(".btn-social-resist")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record || record.resolution || record.reversed) return;

      const defender = game.actors.get(record.defenderId);
      if (!defender) return;
      if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
        return;
      }

      const wp = record.wpToResist;
      const current = defender.system?.willpower?.value ?? 0;
      if (current < wp) {
        ui.notifications.warn(game.i18n.localize("EX2E.InsufficientWillpower"));
        return;
      }

      await defender.update({ "system.willpower.value": current - wp });
      await message.update({
        "flags.exalted2e.socialAttack.resolution": {
          outcome:                       "resisted",
          wpSpentByDefender:             wp,
          erodedIntimacyId:              null,
          erodedIntimacyStrengthBefore:  null,
          erodedIntimacyStrengthAfter:   null,
          erodedIntimacyName:            null
        }
      });

      // Limit accrual: only for splats that use the classic Limit mechanic.
      // Other anti-virtue tracks (Resonance/Torment/Clarity) accrue from
      // their own splat-specific triggers, NOT from resisting unnatural
      // influence. Mortals have no Limit field worth ticking. The wp > 0
      // gate is intentional — a future motes-resist charm path (e.g.,
      // Solar Integrity-Protecting Prana) will set wp = 0 and skip this
      // block automatically, with no Limit accrued.
      if (record.unnaturalInfluence
          && wp > 0
          && defender.type === "character"
          && EX2E.LIMIT_ACCRUAL_SPLATS.includes(defender.system.exaltType)) {
        const sceneFlags    = defender.flags?.exalted2e?.socialScene ?? {};
        const attackerEntry = sceneFlags[record.attackerId] ?? {};
        if (!attackerEntry.unnaturalLimitGranted) {
          const currentLimit = defender.system.limit ?? 0;
          await defender.update({
            "system.limit": Math.min(10, currentLimit + 1),
            [`flags.exalted2e.socialScene.${record.attackerId}.unnaturalLimitGranted`]: true
          });
          ui.notifications.info(
            game.i18n.format("EX2E.LimitAccruedFromUnnatural", { actor: defender.name })
          );
        }
      }

      // Natural-influence WP drain counter: tracks cumulative WP this
      // attacker has drained from this defender via NON-charm social
      // attacks this scene. Once it reaches 2, future natural attacks
      // auto-fail at resolution (handled in rollSocialAttack).
      if (!record.unnaturalInfluence && wp > 0) {
        const sceneFlags = defender.flags?.exalted2e?.socialScene ?? {};
        const entry      = sceneFlags[record.attackerId] ?? {};
        const drained    = (entry.wpDrainedNatural ?? 0) + wp;
        await defender.update({
          [`flags.exalted2e.socialScene.${record.attackerId}.wpDrainedNatural`]: drained
        });
      }

      await _rerenderSocialAttackCard(message);
    });

    // ── Social attack: Accept ─────────────────────────────────────────────
    el.querySelector?.(".btn-social-accept")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record || record.resolution || record.reversed) return;

      const defender = game.actors.get(record.defenderId);
      if (!defender) return;
      if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
        return;
      }

      if (record.intent === "erode" && record.targetedIntimacyId) {
        const intimacy  = defender.items.get(record.targetedIntimacyId);
        const conviction = defender.system?.virtues?.conviction?.value ?? 1;

        if (!intimacy) {
          // Targeted intimacy no longer exists — treat as narration.
          const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
            attackerId:      record.attackerId,
            sourceByKeyword: record.attackerSourceByKeyword ?? {},
            keywords:        record.attackerCharmKeywords  ?? []
          });
          await message.update({
            "flags.exalted2e.socialAttack.resolution": {
              outcome:                      "accepted-narration",
              wpSpentByDefender:            0,
              erodedIntimacyId:             null,
              erodedIntimacyStrengthBefore: null,
              erodedIntimacyStrengthAfter:  null,
              erodedIntimacyName:           null,
              ablationDamageBefore:         null,
              ablationDamageAfter:          null,
              intimacyDeletedOnErode:       false,
              intimacySnapshot:             null
            },
            "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
          });
        } else {
          const useIntensity = game.settings.get("exalted2e", "useIntimacyIntensity");
          const currentDmg   = intimacy.system.ablationDamage ?? 0;
          const newDamage    = currentDmg + 1;
          let outcome        = "accepted-eroded";
          let deleted        = false;
          let snapshot       = null;
          let strengthBefore = useIntensity ? intimacy.system.intensity : (intimacy.system.strength ?? 0);
          let strengthAfter  = strengthBefore;

          if (newDamage < conviction) {
            // Boxes not yet full — just increment.
            await intimacy.update({ "system.ablationDamage": newDamage });
            outcome = "accepted-ablation";
          } else {
            // Full — weaken or remove.
            snapshot = intimacy.toObject();
            if (useIntensity) {
              const order = ["minor", "major", "defining"];
              const idx   = order.indexOf(intimacy.system.intensity);
              if (idx <= 0) {
                await intimacy.delete();
                deleted       = true;
                strengthAfter = null;
              } else {
                strengthAfter = order[idx - 1];
                await intimacy.update({ "system.intensity": strengthAfter, "system.ablationDamage": 0 });
              }
            } else {
              const str = intimacy.system.strength ?? 1;
              if (str <= 1) {
                await intimacy.delete();
                deleted       = true;
                strengthAfter = null;
              } else {
                strengthAfter = str - 1;
                await intimacy.update({ "system.strength": strengthAfter, "system.ablationDamage": 0 });
              }
            }
          }

          const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
            attackerId:      record.attackerId,
            sourceByKeyword: record.attackerSourceByKeyword ?? {},
            keywords:        record.attackerCharmKeywords  ?? []
          });
          await message.update({
            "flags.exalted2e.socialAttack.resolution": {
              outcome,
              wpSpentByDefender:            0,
              erodedIntimacyId:             intimacy.id,
              erodedIntimacyStrengthBefore: strengthBefore,
              erodedIntimacyStrengthAfter:  strengthAfter,
              erodedIntimacyName:           intimacy.name,
              ablationDamageBefore:         currentDmg,
              ablationDamageAfter:          deleted ? null : newDamage < conviction ? newDamage : 0,
              intimacyDeletedOnErode:       deleted,
              intimacySnapshot:             deleted ? snapshot : null
            },
            "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
          });
        }
      } else {
        // Non-erode intent, or erode with no targeted intimacy.
        const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
          attackerId:      record.attackerId,
          sourceByKeyword: record.attackerSourceByKeyword ?? {},
          keywords:        record.attackerCharmKeywords  ?? []
        });
        await message.update({
          "flags.exalted2e.socialAttack.resolution": {
            outcome:                      "accepted-narration",
            wpSpentByDefender:            0,
            erodedIntimacyId:             null,
            erodedIntimacyStrengthBefore: null,
            erodedIntimacyStrengthAfter:  null,
            erodedIntimacyName:           null,
            ablationDamageBefore:         null,
            ablationDamageAfter:          null,
            intimacyDeletedOnErode:       false,
            intimacySnapshot:             null
          },
          "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
        });
      }
      await _rerenderSocialAttackCard(message);
    });

    // ── Social attack: Reverse ────────────────────────────────────────────
    el.querySelector?.(".btn-social-reverse")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record || record.reversed) return;
      const resolution = record.resolution;
      if (!resolution) {
        ui.notifications.warn(game.i18n.localize("EX2E.NothingToReverse"));
        return;
      }

      const attacker = game.actors.get(record.attackerId);
      if (!attacker) return;
      if (!game.user.isGM && !attacker.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
        return;
      }

      const defender = game.actors.get(record.defenderId);

      // Refund defender WP (existing 3a behavior — only meaningful for the
      // "resisted" outcome; perfect-defended and resisted-via-motes both
      // store wpSpentByDefender = 0).
      if (defender && resolution.wpSpentByDefender > 0) {
        const current = defender.system?.willpower?.value ?? 0;
        const max = defender.system?.willpower?.max ?? 10;
        const restored = Math.min(max, current + resolution.wpSpentByDefender);
        await defender.update({ "system.willpower.value": restored });
      }

      // Reverse intimacy ablation damage.
      if (defender && resolution.erodedIntimacyId) {
        if (resolution.intimacyDeletedOnErode && resolution.intimacySnapshot) {
          // Intimacy was deleted — re-create from snapshot.
          await defender.createEmbeddedDocuments("Item", [resolution.intimacySnapshot]);
        } else if (resolution.ablationDamageBefore !== null) {
          const intimacy = defender.items.get(resolution.erodedIntimacyId);
          if (intimacy) {
            const useIntensity = game.settings.get("exalted2e", "useIntimacyIntensity");
            if (resolution.erodedIntimacyStrengthBefore !== resolution.erodedIntimacyStrengthAfter) {
              const patch = { "system.ablationDamage": resolution.ablationDamageBefore };
              if (useIntensity) {
                patch["system.intensity"] = resolution.erodedIntimacyStrengthBefore;
              } else {
                patch["system.strength"] = resolution.erodedIntimacyStrengthBefore;
              }
              await intimacy.update(patch);
            } else {
              await intimacy.update({ "system.ablationDamage": resolution.ablationDamageBefore });
            }
          }
        }
      }

      // 3b addition: refund defender Excellency motes back to the same pools.
      const mb = record.defenderMoteSpend;
      if (defender && mb && (mb.fromPrimary > 0 || mb.fromSecondary > 0)) {
        const primary   = defender.system.motes?.[mb.primaryPool]   ?? { value: 0, max: 0 };
        const secondary = defender.system.motes?.[mb.secondaryPool] ?? { value: 0, max: 0 };
        await defender.update({
          [`system.motes.${mb.primaryPool}.value`]:
            Math.min(primary.max ?? 0, (primary.value ?? 0) + (Number(mb.fromPrimary) || 0)),
          [`system.motes.${mb.secondaryPool}.value`]:
            Math.min(secondary.max ?? 0, (secondary.value ?? 0) + (Number(mb.fromSecondary) || 0))
        });
      }

      // 3c-1: refund attacker Excellency motes (per-pool, capped at max).
      if (record.attackerExcMoteCost > 0) {
        const pool    = record.attackerMoteType === "personal" ? "personal" : "peripheral";
        const current = attacker.system?.motes?.[pool]?.value ?? 0;
        const max     = attacker.system?.motes?.[pool]?.max   ?? current;
        const capped  = Math.min(max, current + record.attackerExcMoteCost);
        await attacker.update({ [`system.motes.${pool}.value`]: capped });
      }

      // 3c-1: clear marker AEs stamped on Accept.
      if (defender && Array.isArray(record.appliedInfluenceEffectIds) && record.appliedInfluenceEffectIds.length > 0) {
        await clearSocialInfluenceEffects(defender, record.appliedInfluenceEffectIds);
      }

      // 3c-2: refund permanent Willpower if the defender refused this attack
      if (defender && record.defenderPermWpDelta) {
        const w = defender.system?.willpower ?? { max: 0, value: 0 };
        const restored = applyRefundMath(
          w.max ?? 0,
          w.value ?? 0,
          record.defenderPermWpDelta.valueDelta ?? 0
        );
        await defender.update({
          "system.willpower.max":   restored.max,
          "system.willpower.value": restored.value
        }, { bypassPurchaseLock: true });
        // Decrement campaign successfulHits + defenderPermWpSpent
        const attackerId = record.attackerId;
        const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
        if (existing) {
          await defender.update({
            [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
              Math.max(0, (existing.successfulHits ?? 0) - 1),
            [`flags.exalted2e.motivationBreaks.${attackerId}.defenderPermWpSpent`]:
              Math.max(0, (existing.defenderPermWpSpent ?? 0) - 1)
          });
        }
      }

      // 3c-2: restore the broken motivation if this attack broke it
      if (defender && record.brokenInThisAttack) {
        await defender.update({ "system.motivation": record.brokenFromMotivation ?? "" });
        const attackerId = record.attackerId;
        const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
        if (existing) {
          await defender.update({
            [`flags.exalted2e.motivationBreaks.${attackerId}.status`]: "active",
            [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
              Math.max(0, (existing.successfulHits ?? 0) - 1)
          });
        }
      }

      // 3c-2: decrement campaign attemptCount (this attack is being unwound entirely).
      // If attemptCount reaches 0, unset the campaign flag entirely.
      if (defender && record.isMotivationBreak) {
        const attackerId = record.attackerId;
        const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
        if (existing) {
          const newCount = Math.max(0, (existing.attemptCount ?? 0) - 1);
          if (newCount === 0) {
            await defender.update({
              [`flags.exalted2e.motivationBreaks.-=${attackerId}`]: null
            });
          } else {
            await defender.update({
              [`flags.exalted2e.motivationBreaks.${attackerId}.attemptCount`]: newCount
            });
          }
        }
      }

      // Mark reversed AND reset Step-2 / resolution so the card returns to
      // step2-pending (the user can re-resolve). Per-charm activations
      // posted during Step-2 have their own Reverse buttons — NOT auto-
      // reversed here, mirroring physical Step-2 behavior.
      await message.update({
        "flags.exalted2e.socialAttack.reversed":                  true,
        "flags.exalted2e.socialAttack.step2Resolved":             false,
        "flags.exalted2e.socialAttack.step2Result":               null,
        "flags.exalted2e.socialAttack.defenderCharmIds":          [],
        "flags.exalted2e.socialAttack.defenderMoteSpend":         null,
        "flags.exalted2e.socialAttack.effectiveMDV":              null,
        "flags.exalted2e.socialAttack.hit":                       null,
        "flags.exalted2e.socialAttack.wpToResist":                null,
        "flags.exalted2e.socialAttack.perfectDefense":            false,
        "flags.exalted2e.socialAttack.motesResistApplied":        false,
        "flags.exalted2e.socialAttack.resolution":                null,
        "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": [],
        "flags.exalted2e.socialAttack.defenderPermWpDelta":       null,
        "flags.exalted2e.socialAttack.brokenInThisAttack":        false,
        "flags.exalted2e.socialAttack.brokenFromMotivation":      null
      });
      await _rerenderSocialAttackCard(message);
    });

    // ── Social attack: GM Disbelieve Illusion ──────────────────────────────
    el.querySelector?.(".btn-social-disbelieve")?.addEventListener("click", async (ev) => {
      if (!game.user.isGM) return;
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record) return;

      const defender = game.actors.get(record.defenderId);
      const attacker = game.actors.get(record.attackerId);
      if (!defender || !attacker) return;

      // Find the most-recent Illusion AE on the defender
      const illusionAEs = defender.effects
        .filter(ae => ae.flags?.exalted2e?.socialInfluence && ae.flags.exalted2e.keyword === "Illusion")
        .sort((a, b) => b.id.localeCompare(a.id));
      if (illusionAEs.length === 0) {
        ui.notifications.warn(game.i18n.localize("EX2E.NoIllusionAE"));
        return;
      }
      const targetAE = illusionAEs[0];

      // Roll Per + Investigation for the defender
      const per  = defender.system?.attributes?.perception?.value  ?? 0;
      const inv  = defender.system?.abilities?.investigation?.value ?? 0;
      const pool = Math.max(1, per + inv);
      const diff = attacker.system?.essence?.value ?? 1;

      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const roll = new ExaltedRoll({ pool, flavor: game.i18n.format("EX2E.IllusionDisbelieveRoll", {
        name: defender.name, diff
      }) });
      const result = await roll.evaluate();
      await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor: defender }) });

      const successes = result.successes ?? 0;
      if (successes >= diff) {
        await targetAE.delete();
        await ChatMessage.create({
          content:  game.i18n.format("EX2E.IllusionDisbelievedSuccess", { charm: targetAE.name }),
          speaker:  ChatMessage.getSpeaker({ actor: defender }),
        });
      } else {
        await ChatMessage.create({
          content:  game.i18n.localize("EX2E.IllusionHolds"),
          speaker:  ChatMessage.getSpeaker({ actor: defender }),
        });
      }
    });

    // ── Social attack: Refuse Motivation Break ─────────────────────────────
    el.querySelector?.(".btn-motivation-refuse")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record || !record.isMotivationBreak) return;
      if (record.resolution || record.reversed) return;

      const defender = game.actors.get(record.defenderId);
      if (!defender) return;
      if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
        return;
      }

      const w = defender.system?.willpower ?? { max: 0, value: 0 };
      if ((w.max ?? 0) <= 0) {
        ui.notifications.warn(game.i18n.localize("EX2E.MotivationBreakNoPermWp"));
        return;
      }

      const before = { max: w.max, value: w.value };
      const after  = applyRefusalMath(before.max, before.value);
      const delta  = {
        maxDelta:   after.max   - before.max,
        valueDelta: after.value - before.value
      };

      await defender.update({
        "system.willpower.max":   after.max,
        "system.willpower.value": after.value
      }, { bypassPurchaseLock: true });

      // Bump campaign tracker successfulHits + defenderPermWpSpent
      const attackerId = record.attackerId;
      const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
      if (existing) {
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
            (existing.successfulHits ?? 0) + 1,
          [`flags.exalted2e.motivationBreaks.${attackerId}.defenderPermWpSpent`]:
            (existing.defenderPermWpSpent ?? 0) + 1
        });
      }

      await message.update({
        "flags.exalted2e.socialAttack.defenderPermWpDelta": delta,
        "flags.exalted2e.socialAttack.resolution": {
          outcome:                       "break-refused",
          wpSpentByDefender:             0,
          erodedIntimacyId:              null,
          erodedIntimacyStrengthBefore:  null,
          erodedIntimacyStrengthAfter:   null,
          erodedIntimacyName:            null
        }
      });
      await _rerenderSocialAttackCard(message);
    });

    // ── Social attack: Break Motivation ────────────────────────────────────
    el.querySelector?.(".btn-motivation-break")?.addEventListener("click", async (ev) => {
      const record = message.flags?.exalted2e?.socialAttack;
      if (!record || !record.isMotivationBreak) return;
      if (record.resolution || record.reversed) return;

      const defender = game.actors.get(record.defenderId);
      if (!defender) return;
      if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
        return;
      }

      const brokenFromMotivation = defender.system?.motivation ?? "";
      const targetMotivation     = record.targetMotivation ?? "";

      // Flip the defender's motivation
      await defender.update({ "system.motivation": targetMotivation });

      // Mark campaign as broken + bump successfulHits
      const attackerId = record.attackerId;
      const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
      if (existing) {
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attackerId}.status`]:         "broken",
          [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
            (existing.successfulHits ?? 0) + 1
        });
      }

      await message.update({
        "flags.exalted2e.socialAttack.brokenInThisAttack":   true,
        "flags.exalted2e.socialAttack.brokenFromMotivation": brokenFromMotivation,
        "flags.exalted2e.socialAttack.resolution": {
          outcome:                       "broken",
          wpSpentByDefender:             0,
          erodedIntimacyId:              null,
          erodedIntimacyStrengthBefore:  null,
          erodedIntimacyStrengthAfter:   null,
          erodedIntimacyName:            null
        }
      });
      await _rerenderSocialAttackCard(message);
    });

    // ── Act of Villainy: player rolls the virtue pool ─────────────────────
    const aovCard = el.querySelector?.(".ex2e-act-of-villainy-card");
    if (aovCard) {
      const aov = message.flags?.exalted2e?.actOfVillainy;
      if (aov && !aov.rolled) {
        aovCard.querySelector("[data-action='rollActOfVillainy']")
          ?.addEventListener("click", async (ev) => {
            const btn = ev.currentTarget;
            if (btn.disabled) return;
            btn.disabled = true;

            const actor = game.actors.get(aov.actorId);
            if (!actor?.isOwner) {
              ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
              btn.disabled = false;
              return;
            }

            try {
              const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
              const roll   = new ExaltedRoll({
                pool:      aov.pool,
                stunt:     aov.stunt,
                actorName: aov.actorName,
                flavor:    game.i18n.localize("EX2E.SplatActOfVillainy")
              });
              const result = await roll.evaluate();
              await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
              await _resolveActOfVillainy(message, result.successes);
            } catch (err) {
              console.error("exalted2e | Act of Villainy roll failed", err);
              btn.disabled = false;
            }
          });
      }

      if (aov?.rolled) {
        const btn = aovCard.querySelector("[data-action='rollActOfVillainy']");
        if (btn) btn.disabled = true;
      }
    }

    // ── Oath Botch button (GM-only) ───────────────────────────────────────
    // Injects an "Oath Botch (N)" button into any roll card whose speaker
    // is an actor carrying at least one oathBotch AE. N = highest
    // bindingEssence across all oathBotch AEs on that actor.
    if (game.user.isGM) {
      const speakerActor = game.actors.get(message.speaker?.actor);
      if (speakerActor) {
        const oathAEs = speakerActor.effects.filter(
          e => e.flags?.exalted2e?.oathBotch != null
        );
        if (oathAEs.length > 0) {
          const n = Math.max(...oathAEs.map(e => e.flags.exalted2e.oathBotch.bindingEssence));
          const descriptions = oathAEs
            .map(e => e.flags.exalted2e.oathBotch.description || game.i18n.localize("EX2E.SacredOath"))
            .join("; ");

          const btn = document.createElement("button");
          btn.className = "btn-roll btn-oath-botch";
          btn.textContent = game.i18n.format("EX2E.OathBotchButton", { n });
          el.appendChild(btn);

          btn.addEventListener("click", async () => {
            const title = `${game.i18n.localize("EX2E.OathBotchCardTitle")} — ${speakerActor.name}`;
            const body  = game.i18n.format("EX2E.OathBotchCardBody", { n });
            await ChatMessage.create({
              content: `<div class="ex2e-oath-botch-card"><h3>${title}</h3><p><em>${descriptions}</em></p><p>${body}</p></div>`,
              flags: {
                exalted2e: {
                  oathBotchApplied: { actorId: speakerActor.id, bindingEssence: n, description: descriptions }
                }
              }
            });
          });
        }
      }
    }
  });

  // ── Gremlin Syndrome — Convert to Antagonist button ────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const el  = html instanceof HTMLElement ? html : html[0] ?? html;
    const btn = el?.querySelector?.("[data-action='gremlinConvert']");
    if (!btn) return;
    // Disable upfront for non-GMs and for already-resolved cards.
    if (!game.user.isGM || message.flags?.exalted2e?.gremlinSyndrome?.resolved) {
      btn.disabled = true;
      return;
    }
    btn.addEventListener("click", async () => {
      const actor = game.actors.get(btn.dataset.actorId);
      if (!actor) {
        console.warn("exalted2e | Gremlin Convert: actor not found", btn.dataset.actorId);
        return;
      }
      btn.disabled = true;   // prevent double-fire during the async work
      try {
        for (const token of actor.getActiveTokens()) {
          await token.document.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        }
        await message.setFlag("exalted2e", "gremlinSyndrome", {
          ...(message.flags?.exalted2e?.gremlinSyndrome ?? {}), resolved: true
        });
        await ChatMessage.create({
          content: game.i18n.format("EX2E.GremlinConverted", { name: actor.name }),
          speaker: ChatMessage.getSpeaker({ actor })
        });
      } catch (err) {
        console.error("exalted2e | Gremlin Convert failed:", err);
        btn.disabled = false;   // re-enable so the GM can retry
      }
    });
  });

  // ── Exhaustion button handler ─────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    html.querySelectorAll("[data-action='roll-exhaustion']").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.actorId;
        const charged = btn.dataset.charged === "true";
        const actor   = game.actors.get(actorId);
        if (!actor || !actor.isOwner) return;
        btn.disabled = true;
        try {
          await rollExhaustion(actor, { charged });
        } catch (err) {
          console.error("EX2E | rollExhaustion failed:", err);
          btn.disabled = false;
        }
      });
    });
  });

  // ── GM Roll Pool card: Roll button ────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    const btn = el.querySelector?.(".btn-gm-pool-roll");
    if (!btn) return;

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      btn.disabled = true;

      const record = message.flags?.exalted2e?.gmRollPool;
      if (!record) { btn.disabled = false; return; }

      const actor = resolveUserActor();
      if (!actor) {
        ui.notifications.warn(game.i18n.localize("EX2E.GmRollNoCharacter"));
        btn.disabled = false;
        return;
      }

      const pool = computeGmRollPool(actor, record.traits ?? []);
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const roll   = new ExaltedRoll({ pool: Math.max(1, pool), flavor: record.description ?? "", actorName: actor.name });
      const result = await roll.evaluate();
      await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });

      const successes = result.successes ?? 0;
      const pass      = successes >= (record.difficulty ?? 1);

      const updatedRolls = [...(record.rolls ?? []), { actorId: actor.id, actorName: actor.name, successes, pass }];
      const updatedRecord = { ...record, rolls: updatedRolls };

      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/gm-roll-pool-card.hbs",
        updatedRecord
      );
      await message.update({ content, "flags.exalted2e.gmRollPool": updatedRecord });
    });
  });

  // ── Hazard Resistance Roll ─────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const el   = html instanceof HTMLElement ? html : html[0] ?? html;
    const card = el.querySelector?.(".ex2e-hazard-resistance-card");
    if (!card) return;

    const btn = card.querySelector("[data-action='rollHazardResistance']");
    if (!btn) return;

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const b = ev.currentTarget;
      if (b.disabled) return;
      b.disabled = true;

      const { actorId, damagePool, traumaType, resistDifficulty } = b.dataset;
      const difficulty = Number(resistDifficulty) || 0;

      const actor = game.actors.get(actorId);
      if (!actor?.isOwner) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
        b.disabled = false;
        return;
      }

      try {
        const { ExaltedRoll }          = await import("../rolls/exalted-roll.mjs");
        const { evaluateCharmFormula } = await import("../documents/item.mjs");

        const result = await ExaltedRoll.rollAttributeAbility(actor, "stamina", "resistance");
        if (!result) { b.disabled = false; return; }

        const regionName = card.querySelector(".roll-flavor")?.textContent?.trim() ?? "Hazard";

        if (result.successes >= difficulty) {
          await ChatMessage.create({
            content: `<em>${actor.name} ${game.i18n.localize("EX2E.HazardResisted")} (${regionName}).</em>`,
            speaker: ChatMessage.getSpeaker({ actor }),
          });
        } else {
          const rollData  = actor.getRollData?.() ?? {};
          const poolSize  = Math.max(1, evaluateCharmFormula(damagePool, rollData, 5));
          const dmgRoll   = new ExaltedRoll({ pool: poolSize, flavor: regionName, actorName: actor.name });
          const dmgResult = await dmgRoll.evaluate();
          await dmgResult.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
          if (dmgResult.successes > 0) {
            await actor.applyDamage(dmgResult.successes, traumaType);
          }
          const msg = game.i18n.format("EX2E.HazardDamageMsg", {
            hits: dmgResult.successes,
            type: traumaType,
          });
          await ChatMessage.create({
            content: `<em>${actor.name} ${msg} ${regionName}.</em>`,
            speaker: ChatMessage.getSpeaker({ actor }),
          });
        }

        b.outerHTML = `<span class="ex2e-rolled">${game.i18n.localize("EX2E.Rolled")}</span>`;
      } catch (err) {
        console.error("exalted2e | hazard resistance roll failed", err);
        b.disabled = false;
      }
    });
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const el  = html instanceof HTMLElement ? html : html[0] ?? html;
    const btn = el.querySelector("[data-action='rollBlasphemySensing']");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!game.user.isGM) return;
      const infernalId = btn.dataset.infernalId;
      const essence    = parseInt(btn.dataset.essence) || 1;
      btn.disabled = true;
      try {
        const { rollBlasphemySensing } = await import("../rolls/blasphemy.mjs");
        await rollBlasphemySensing(infernalId, essence);
      } catch (err) {
        console.error("EX2E | rollBlasphemySensing failed:", err);
        btn.disabled = false;
      }
    });
  });
}

/**
 * Wire up the exalted2e.attackSuccess hook. Called from inside the ready
 * callback so the handler fires at the same phase as the original code.
 */
export function wireAttackSuccess() {
  Hooks.on("exalted2e.attackSuccess", async ({ attackerActorId, attack }) => {
    const actor = game.actors.get(attackerActorId);
    if (!actor) return;
    const targetActor = attack.targetId ? game.actors.get(attack.targetId) : null;
    await actor._fireRecoveryEvent("onAttackSuccess", targetActor);
    if (targetActor) {
      const activatedItems = (attack.attackCharms ?? [])
        .map(n => actor.items.find(i => i.name === n))
        .filter(Boolean);
      const targetPenalties = getTargetPenaltyChanges(activatedItems, actor.getRollData());
      for (const { type, value, label, duration } of targetPenalties) {
        await targetActor.createEmbeddedDocuments("ActiveEffect", [{
          name:     label,
          img:      "icons/svg/regen.svg",
          disabled: false,
          transfer: false,
          flags:    { exalted2e: { internalPenalty: { type, value }, charmDuration: duration } }
        }]);
      }

      // Offer resist roll for each statusApply charm activated in this attack.
      const statusCharms = collectStatusApplyCharms(activatedItems);
      for (const c of statusCharms) {
        const sa = c.system.statusApply;
        await _postStatusResistCard({
          targetActorId: targetActor.id,
          targetName:    targetActor.name,
          attackerName:  actor.name,
          charmName:     c.name,
          status:        sa.status,
          resistPool:    sa.resistPool,
          onFail:        sa.onFail,
        });
      }

      const teCharms = activatedItems.filter(c =>
        c.system.targetEffect?.enabled && c.system.targetEffect?.trigger === "onHit"
        && !c.system.targetEffect?.perDamageLevel);
      for (const c of teCharms) {
        await targetActor.applyCharmTargetEffect(c.system.targetEffect);
      }
    }
  });
}
