import { register } from "./cleanup.mjs";

/**
 * Create a temporary spell Item embedded on the given actor. Auto-registered
 * for cleanup (deleting the actor would also delete it, but explicit
 * registration ensures sweep ordering is correct).
 *
 * @param {Actor} actor — owner; spell is created via createEmbeddedDocuments
 * @param {object} [opts]
 * @param {string} [opts.name="Quench Spell"]
 * @param {"sorcery"|"necromancy"} [opts.tradition="sorcery"]
 * @param {1|2|3} [opts.circle=1]
 * @param {number} [opts.motes=10]
 * @param {number} [opts.willpower=1]
 * @param {string} [opts.description=""]
 * @returns {Promise<Item>} the created spell Item
 */
export async function createTempSpell(actor, {
  name = "Quench Spell",
  tradition = "sorcery",
  circle = 1,
  motes = 10,
  willpower = 1,
  description = ""
} = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "spell",
    system: {
      tradition,
      circle,
      cost: { motes, willpower },
      description
    }
  }]);
  register(item);
  return item;
}
