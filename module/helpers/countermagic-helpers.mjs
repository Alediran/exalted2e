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

/** Countermagic tier for an item — spell items use circle, charm items use countermagicTier. */
export function getCountermagicTier(item) {
  if (!item) return 1;
  return item.type === "spell"
    ? (item.system?.circle ?? 1)
    : (item.system?.countermagicTier ?? 1);
}

/**
 * Countermagic tradition for an item.
 * Charm items use countermagicTradition directly.
 * Spell items use countermagicTradition when explicitly set (cross-tradition
 * spells like Onyx/Obsidian set it to "both"), otherwise fall back to
 * the spell's own tradition field.
 */
export function getCountermagicTradition(item) {
  if (!item) return "sorcery";
  const explicit = item.system?.countermagicTradition;
  if (explicit) return explicit;
  return item.type === "spell"
    ? (item.system?.tradition ?? "sorcery")
    : "sorcery";
}

export function isEligible(item, targetCircle, targetTradition) {
  if (!item?.system?.isCountermagic) return false;
  const tier = getCountermagicTier(item);
  if (tier < targetCircle) return false;
  const trad = getCountermagicTradition(item);
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
