// ── Pure helper (importable by unit tests, no Foundry API) ─────────────────

/**
 * Compute the thaumaturgy roll pool.
 * @param {number} attrVal   — value of the procedure's attribute
 * @param {number} occultVal — actor's Occult ability value
 * @param {number} artDeg    — character's degree in the matching Art
 * @returns {number}
 */
export function computeThaumPool(attrVal, occultVal, artDeg) {
  return (attrVal ?? 0) + (occultVal ?? 0) + (artDeg ?? 0);
}

// ── Async Foundry function ─────────────────────────────────────────────────

import { ExaltedRoll } from "./exalted-roll.mjs";

/**
 * Perform a thaumaturgy procedure roll for the given actor.
 * @param {ExaltedActor}  actor         — the performing character
 * @param {ExaltedItem}   procedureItem — a "procedure" type item owned by actor
 * @returns {Promise<ExaltedRollResult|null>}
 */
export async function rollProcedure(actor, procedureItem) {
  const sys = procedureItem.system;

  // 1. Find the matching Art knowledge item.
  const artItem = actor.items.find(
    i => i.type === "thaum-art"
      && i.system.artName === sys.art
      && i.system.degree  >= sys.minDegree
  );
  if (!artItem) {
    ui.notifications.warn(game.i18n.localize("EX2E.ThaummNoArt"));
    return null;
  }

  // 2. Build pool.
  const attrVal   = actor.system.attributes?.[sys.attribute]?.value ?? 0;
  const occultVal = actor.system.abilities?.occult?.value            ?? 0;
  const artDeg    = artItem.system.degree;
  const pool      = computeThaumPool(attrVal, occultVal, artDeg);

  // 3. Roll.
  const result = await ExaltedRoll.rollPool(actor, {
    pool,
    flavor:   procedureItem.name,
    category: "mental",
  });
  if (!result) return null;

  // 4. Determine outcome.
  const success = result.successes >= sys.difficulty;
  const botch   = !success && !!result.botch;

  // 5. Post chat card.
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/thaumaturgy-result.hbs",
    {
      procedureName: procedureItem.name,
      art:           sys.art,
      artDegree:     artDeg,
      attribute:     sys.attribute,
      difficulty:    sys.difficulty,
      successes:     result.successes,
      success,
      botch,
      effectText:    sys.description,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });

  // 6. In-combat instant: stamp pendingAction so Finish Turn advances by Speed 3.
  if (game.combat?.started && sys.castingTime.toLowerCase() === "instant") {
    const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
    if (combatant) {
      await combatant.setFlag("exalted2e", "pendingAction", {
        actionKey:  "thaumaturgy",
        label:      procedureItem.name,
        speed:      3,
        dvPenalty:  0,
        dvEffectId: null,
        abortable:  false,
      });
    }
  }

  return result;
}
