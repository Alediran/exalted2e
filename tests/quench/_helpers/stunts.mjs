/**
 * Read combatant.flags.exalted2e.pendingStuntRewards. Returns an array
 * (possibly empty) — never undefined. Use for assertions only; banking
 * goes through production bankStuntReward.
 */
export function getPendingStunts(combatant) {
  if (!combatant) return [];
  return combatant.getFlag("exalted2e", "pendingStuntRewards") ?? [];
}

/**
 * Locate the most recent ChatMessage carrying a stunt-reward card.
 * Match is by rendered HTML containing `ex2e-stunt-reward-card`.
 *
 * @param {ChatMessages} [messages=game.messages] — defaults to the world's
 *   ChatMessages collection.
 * @returns {ChatMessage|null}
 */
export function findStuntRewardCard(messages = game.messages) {
  const all = Array.from(messages?.contents ?? messages ?? []);
  for (let i = all.length - 1; i >= 0; i--) {
    const msg = all[i];
    if (typeof msg.content === "string" && msg.content.includes("ex2e-stunt-reward-card")) {
      return msg;
    }
  }
  return null;
}
