/**
 * Mote spend range for a given countermagic tier countering a spell of targetCircle.
 * Tier 1 (Emerald/Iron):    10m fixed (can only counter circle 1).
 * Tier 2 (Sapphire/Onyx):   15m vs circle 1, 20m vs circle 2; max 20m.
 * Tier 3 (Adamant/Obsidian): 20m vs circles 1–2, 25m vs circle 3; max 25m.
 */
export function moteRange(tier, targetCircle = 1) {
  if (tier === 1) return { min: 10, max: 10 };
  if (tier === 2) {
    const min = targetCircle >= 2 ? 20 : 15;
    return { min, max: 20 };
  }
  if (tier === 3) {
    const min = targetCircle >= 3 ? 25 : 20;
    return { min, max: 25 };
  }
  return { min: 10, max: 10 };
}

export function isEligible(charm, targetCircle, targetTradition) {
  if (!charm?.system?.isCountermagic) return false;
  const tier = charm.system.countermagicTier ?? 1;
  if (tier < targetCircle) return false;
  const trad = charm.system.countermagicTradition ?? "sorcery";
  if (trad !== "both" && trad !== targetTradition) return false;
  return true;
}

export function buildEligibleCharms(actor, targetCircle, targetTradition) {
  return (actor?.items?.contents ?? []).filter(
    i => isEligible(i, targetCircle, targetTradition)
  );
}

export async function emitDispelSpellEffect(actorId, effectId) {
  if (game.user.isGM) {
    const actor = game.actors.get(actorId);
    const ae = actor?.effects.get(effectId);
    if (ae) await ae.delete();
    return true;
  }
  const gmUser = game.users.find(u => u.isGM && u.active);
  if (!gmUser) {
    ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoGMOnline"));
    return false;
  }
  // targetGmId ensures only one GM acts when multiple GMs are online
  game.socket.emit("system.exalted2e", { action: "dispelSpellEffect", actorId, effectId, targetGmId: gmUser.id });
  return true;
}
