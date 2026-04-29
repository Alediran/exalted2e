import { register } from "./cleanup.mjs";

/**
 * Create a real ChatMessage with flags.exalted2e.attack populated to the
 * shape resolveKnockbackChain expects. Tests pass `attackOverrides` to
 * stuff additional fields (e.g., damageRoll, abilityKey) for branches
 * that read more than just actorId/targetId.
 *
 * Returns the ChatMessage; auto-registered for cleanup.
 */
export async function buildAttackMessage({
  attacker,
  target,
  attackOverrides = {},
  content = "<div></div>"
} = {}) {
  const baseAttack = {
    actorId:    attacker?.id  ?? null,
    targetId:   target?.id    ?? null,
    weaponId:   null,
    abilityKey: "melee"
  };
  const attack = foundry.utils.mergeObject(baseAttack, attackOverrides, { inplace: false });

  const message = await ChatMessage.create({
    speaker: attacker
      ? ChatMessage.getSpeaker({ actor: attacker })
      : ChatMessage.getSpeaker(),
    content,
    flags: { exalted2e: { attack } }
  });
  register(message);
  return message;
}

/**
 * Return the most recently created ChatMessage in `game.messages`, or
 * `null` if the collection is empty. Auto-registers it for cleanup so
 * tests can do `const card = lastChatMessage();` without an explicit
 * `register(card)` line.
 *
 * Useful when production code creates a chat card and the test doesn't
 * have a direct handle to the new message — e.g., the spell-cast card
 * posted by `postCastChatCard`, or the activation card posted by
 * `sendToChat({ activation })`.
 */
export function lastChatMessage() {
  const msg = Array.from(game.messages.values()).at(-1) ?? null;
  if (msg) register(msg);
  return msg;
}

/**
 * Find the first ChatMessage (newest-first) whose flags satisfy a
 * predicate. `flagPath` is a dotted path under `flags.exalted2e` —
 * e.g., `"charmActivation"` looks at `msg.flags.exalted2e.charmActivation`.
 * Auto-registers the matched message for cleanup.
 *
 * Returns the ChatMessage or `null` if no match.
 *
 * @param {string}                       flagPath
 * @param {(value: any) => boolean}      predicate
 */
export function chatMessageByFlag(flagPath, predicate) {
  const messages = Array.from(game.messages.values()).reverse();
  for (const m of messages) {
    const value = foundry.utils.getProperty(
      m.flags?.exalted2e ?? {}, flagPath
    );
    if (predicate(value)) {
      register(m);
      return m;
    }
  }
  return null;
}
