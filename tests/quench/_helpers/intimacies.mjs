import { register } from "./cleanup.mjs";

/**
 * Create an Intimacy Item embedded on the given actor. Intimacies live as
 * `item.type === "intimacy"` documents (NOT as an array on actor.system).
 * `verifyClaims` in social-attack-math.mjs reads them as items via
 * `defender.items.some(i => i.type === "intimacy" && i.system?.positive === ...)`.
 *
 * Auto-registered for cleanup via `register(item)`.
 *
 * @param {Actor} actor — owner; intimacy embedded via createEmbeddedDocuments
 * @returns {Promise<Item>} the created intimacy Item
 */
export async function addIntimacy(actor, {
  name         = "Quench Intimacy",
  intimacyType = "tie",                 // "tie" | "principle"
  intensity    = "minor",               // "minor" | "major" | "defining"
  subject      = "",
  positive     = true,
  strength     = 0,
  ablationDamage = 0,
  description  = ""
} = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "intimacy",
    system: { intimacyType, intensity, subject, positive, strength, ablationDamage, description }
  }]);
  register(item);
  return item;
}

/**
 * Set the actor's motivation field. No registration — sweep deletes the
 * actor and the field travels with it.
 */
export async function addMotivation(actor, motivation) {
  await actor.update({ "system.motivation": motivation });
}
