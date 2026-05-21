/**
 * Create a temporary Item of any type embedded on the given actor.
 * No explicit cleanup registration is needed — when the parent actor is
 * deleted during sweep, Foundry cascades and deletes all embedded items
 * automatically.  Accepts a flat data object whose keys may use
 * dot-notation (e.g. `"system.keywords": [...]`).
 *
 * @param {Actor} actor  — owner
 * @param {object} data  — item creation data; `name` and `type` are required
 * @returns {Promise<Item>} the created Item
 */
export async function createTempItem(actor, data = {}) {
  // Expand dot-notation keys so Foundry receives a proper nested object.
  const expanded = foundry.utils.expandObject(data);
  const [item] = await actor.createEmbeddedDocuments("Item", [expanded]);
  return item;
}

/**
 * Create a temporary spell Item embedded on the given actor. No explicit
 * cleanup registration is needed — deleting the actor cascades to all
 * embedded items automatically.
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
  return item;
}
