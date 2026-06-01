import { ExaltedRoll } from "./exalted-roll.mjs";

/**
 * Post a GM-whisper Blasphemy alert card to chat.
 * Called from activateCharm when an Infernal activates a Blasphemy charm.
 *
 * @param {ExaltedActor}  actor — the Infernal actor
 * @param {ExaltedItem}   charm — the activated charm item
 */
export async function postBlasphemyAlert(actor, charm) {
  const essence    = actor.system.essence?.value ?? 1;
  const difficulty = Math.max(1, 10 - essence);
  const content    = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/blasphemy-alert.hbs",
    {
      infernalName: actor.name,
      essence,
      charmName:    charm.name,
      charmImg:     charm.img,
      sceneName:    canvas.scene?.name ?? "",
      infernalId:   actor.id,
      difficulty,
    }
  );
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: gmIds,
  });
}

/**
 * Fire Perception+Occult sensing rolls for Celestial Exalted in the current scene.
 * Called when the GM clicks "Roll Sensing" on a Blasphemy alert card.
 *
 * @param {string}  infernalId — id of the Infernal actor (excluded from rolls)
 * @param {number}  essence    — Infernal's Essence rating (determines difficulty)
 */
export async function rollBlasphemySensing(infernalId, essence) {
  const CELESTIAL_TYPES = new Set(["solar", "lunar", "sidereal", "abyssal"]);
  const difficulty      = Math.max(1, 10 - Number(essence));

  const celestials = (canvas.scene?.tokens?.contents ?? [])
    .map(t => t.actor)
    .filter(a => a?.type === "character"
      && CELESTIAL_TYPES.has(a.system?.exaltType)
      && a.id !== infernalId);

  if (!celestials.length) {
    await ChatMessage.create({
      content: `<p class="blasphemy-no-sensers">${game.i18n.localize("EX2E.BlasphemyNoCelestials")}</p>`,
    });
    return;
  }

  for (const actor of celestials) {
    const perVal    = actor.system.attributes?.perception?.value ?? 0;
    const occultVal = actor.system.abilities?.occult?.value      ?? 0;
    const pool      = perVal + occultVal;

    const result = await ExaltedRoll.rollPool(actor, {
      pool,
      flavor:   game.i18n.format("EX2E.BlasphemySensingFlavor", { difficulty }),
      category: "mental",
    });

    const success = result.successes >= difficulty;
    const key     = success ? "EX2E.BlasphemySensingSuccess" : "EX2E.BlasphemySensingFailure";
    await ChatMessage.create({
      content: `<p class="blasphemy-sensing-result">${game.i18n.format(key, { name: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }
}
