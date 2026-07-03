import {
  computeKnockback,
  computeKnockdownTrigger,
  computeStunTrigger
} from "./knockback-math.mjs";
import { evaluateCharmFormula } from "../documents/item.mjs";

/**
 * Resolve the knockback / knockdown / stun chain after damage applies.
 *
 * Reads attacker + target from message.flags.exalted2e.attack. Computes
 * the three thresholds via the pure math, mutates target token position
 * (knockback), stamps Foundry's Prone status (knockdown auto-fail) or sets
 * a pending flag (knockdown player-driven), and stamps a dvRefreshable AE
 * (stun). Writes the resolution to the attack flag and re-renders the card.
 *
 * No-op when targetActor.type !== "character" (NPC scope deferred).
 *
 * @param {ChatMessage} message
 * @param {{effectivePool:number, rawDamage:number}} damageInfo
 */
export async function resolveKnockbackChain(message, { effectivePool, rawDamage } = {}) {
  const attack = message?.flags?.exalted2e?.attack;
  if (!attack) return;

  const targetActor   = attack.targetId ? game.actors.get(attack.targetId) : null;
  const attackerActor = attack.actorId  ? game.actors.get(attack.actorId)  : null;
  if (!targetActor || targetActor.type !== "character") return;

  // ── Guaranteed knockback (e.g. Forceful Arrow) ────────────────────
  if (attack.guaranteedKnockback?.enabled && rawDamage > 0 && attackerActor) {
    const attackerRollData = attackerActor.getRollData?.() ?? {};
    const dist = evaluateCharmFormula(attack.guaranteedKnockback.distanceFormula, attackerRollData, 0);
    if (dist > 0) {
      const moved = await _translateTokenAlongAttackVector(attackerActor, targetActor, dist);
      const resolution = {
        fired:               true,
        distance:            dist,
        tokenMoved:          moved,
        knockdownPending:    false,
        knockdownResolution: null,
        stunFired:           false
      };
      await _persistAndRerender(message, resolution);
    }
    return;
  }

  const { sta, res, dex, ath } = _readDefenderStats(targetActor);

  // ── Knockback ─────────────────────────────────────────────────────
  const kb = computeKnockback({ effectivePool, sta, res });
  let tokenMoved = false;
  let knockdownPending = false;
  let knockdownResolution = null;

  if (kb.fired) {
    tokenMoved = await _translateTokenAlongAttackVector(attackerActor, targetActor, kb.distance);

    // ── Knockdown trigger (chained from knockback) ─────────────────
    const kd = computeKnockdownTrigger({ distance: kb.distance, dex, ath });
    if (kd.triggered) {
      const ownedByPlayer = targetActor.hasPlayerOwner;
      if (ownedByPlayer) {
        knockdownPending = true;
      } else {
        const passed = await _rollKnockdownResist(targetActor);
        if (passed) {
          knockdownResolution = "passed";
        } else {
          knockdownResolution = "auto-knocked-down";
          await _applyProneStatus(targetActor);
        }
      }
    }
  }

  // M53 — Automatic knockdown: forces knockdown on hit regardless of knockback threshold.
  if (!kb.fired && attack.automaticKnockdown && rawDamage > 0) {
    const ownedByPlayer = targetActor.hasPlayerOwner;
    if (ownedByPlayer) {
      knockdownPending = true;
    } else {
      knockdownResolution = "auto-knocked-down";
      await _applyProneStatus(targetActor);
    }
  }

  // ── Stun (independent — runs even if knockback didn't fire) ──────
  const stun = computeStunTrigger({ inflictedDamage: rawDamage, sta });
  if (stun.triggered) {
    await _applyStunPenalty(targetActor);
  }

  // ── Persist resolution to flag + re-render card ───────────────────
  const automaticKnockdownFired = !kb.fired && !!attack.automaticKnockdown && rawDamage > 0;
  if (kb.fired || stun.triggered || automaticKnockdownFired) {
    const resolution = {
      fired:               kb.fired,
      distance:            kb.distance,
      tokenMoved,
      knockdownPending,
      knockdownResolution,
      stunFired:           stun.triggered
    };
    await _persistAndRerender(message, resolution);
  }
}

/**
 * Click handler for the "Roll Knockdown Resist" chat-card button.
 * Wired in module/exalted2e.mjs alongside existing attack-card handlers.
 *
 * @param {ChatMessage} message
 */
export async function onKnockdownResistClick(message) {
  const attack = message?.flags?.exalted2e?.attack;
  if (!attack?.knockback?.knockdownPending) return;

  const targetActor = attack.targetId ? game.actors.get(attack.targetId) : null;
  if (!targetActor) return;

  // Permission gate (mirrors social-attack defender pattern).
  if (!game.user.isGM && !targetActor.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
    return;
  }

  const passed = await _rollKnockdownResist(targetActor);
  const knockdownResolution = passed ? "passed" : "knocked-down";
  if (!passed) await _applyProneStatus(targetActor);

  const resolution = {
    ...attack.knockback,
    knockdownPending:    false,
    knockdownResolution
  };
  await _persistAndRerender(message, resolution);
}

// ── Internals ─────────────────────────────────────────────────────────

function _readDefenderStats(actor) {
  const sys = actor.system ?? {};
  return {
    sta: Number(sys.attributes?.stamina?.value)    || 0,
    res: Number(sys.abilities?.resistance?.value)  || 0,
    dex: Number(sys.attributes?.dexterity?.value)  || 0,
    ath: Number(sys.abilities?.athletics?.value)   || 0
  };
}

/**
 * Translate the target token along the attacker→target unit vector by
 * `yards` of scene units. Returns true on success, false if either token
 * is unplaced (no scene / no canvas presence). Naive — no wall collision.
 */
async function _translateTokenAlongAttackVector(attackerActor, targetActor, yards) {
  if (!yards || !canvas?.scene) return false;
  const attackerToken = attackerActor?.getActiveTokens?.()[0] ?? null;
  const targetToken   = targetActor?.getActiveTokens?.()[0]   ?? null;
  if (!attackerToken || !targetToken) return false;

  const ax = attackerToken.center?.x ?? 0;
  const ay = attackerToken.center?.y ?? 0;
  const tx = targetToken.center?.x   ?? 0;
  const ty = targetToken.center?.y   ?? 0;
  const dx = tx - ax;
  const dy = ty - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;  // overlapping tokens — degenerate case

  const nx = dx / len;
  const ny = dy / len;
  const gridSize     = canvas.grid?.size ?? 100;
  const gridDistance = canvas.scene?.grid?.distance ?? 1;
  const pixelsPerUnit = gridSize / gridDistance;

  const offsetX = nx * yards * pixelsPerUnit;
  const offsetY = ny * yards * pixelsPerUnit;
  const newX = (targetToken.document.x ?? 0) + offsetX;
  const newY = (targetToken.document.y ?? 0) + offsetY;

  try {
    await targetToken.document.update({ x: newX, y: newY });
    return true;
  } catch (err) {
    console.warn("exalted2e | knockback token translate failed", err);
    return false;
  }
}

async function _applyProneStatus(actor) {
  // Foundry's built-in Prone status, already enriched with the 2e
  // external penalty in module/exalted2e.mjs at init time.
  await actor.toggleStatusEffect("prone", { active: true });
}

async function _applyStunPenalty(actor) {
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: game.i18n.localize("EX2E.Stunned"),
    img:  "icons/svg/daze.svg",
    flags: { exalted2e: {
      externalPenalty: { value: 2, type: "physical" },
      dvRefreshable:   true
    }},
    disabled: false,
    transfer: false
  }]);
}

/**
 * Roll the knockdown resist pool: max(Dex, Sta) + max(Athletics, Resistance)
 * vs difficulty 2. Returns true on pass.
 */
async function _rollKnockdownResist(defender) {
  const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
  const { sta, res, dex, ath } = _readDefenderStats(defender);
  const pool = Math.max(dex, sta) + Math.max(ath, res);
  const result = await ExaltedRoll.rollPool(defender, {
    pool,
    flavor:   game.i18n.localize("EX2E.KnockdownResistRoll"),
    category: "physical"
  });
  return (result?.successes ?? 0) >= 2;
}

/**
 * Persist the resolution onto the attack flag and re-render the card by
 * delegating to renderAttackCardContent.
 */
async function _persistAndRerender(message, resolution) {
  const { renderAttackCardContent } = await import("../rolls/exalted-roll.mjs");
  const attack = message.flags?.exalted2e?.attack ?? {};
  const updatedAttack = { ...attack, knockback: resolution };
  const content = await renderAttackCardContent(updatedAttack);
  await message.update({
    "flags.exalted2e.attack.knockback": resolution,
    content
  });
}
