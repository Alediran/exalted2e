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
