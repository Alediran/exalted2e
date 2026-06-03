/**
 * Gremlin Syndrome — the low-Clarity / high-Dissonance failure path for
 * Alchemical Exalted. At Dissonance 10 the character succumbs: a
 * creatureOfVoid-flagged ActiveEffect is stamped (plugging into the
 * existing Axiomatic aggravated-damage pipeline) and a GM-whisper alert
 * card offers token conversion to hostile.
 *
 * The pending Set guards against double-fire when several field writes land
 * in the same tick (mirrors `_limitBreakPending`). It is cleared whenever
 * Dissonance drops below 10.
 */
export const _gremlinPending = new Set();

/** Stamp the Gremlin Syndrome AE if the actor does not already have one. */
export async function stampGremlinAE(actor) {
  const has = actor.effects.some(e => e.flags?.exalted2e?.gremlinSyndrome === true);
  if (has) return;
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name:  game.i18n.localize("EX2E.GremlinSyndrome"),
    img:   "icons/svg/ice-aura.svg",
    flags: { exalted2e: { gremlinSyndrome: true, creatureOfVoid: true, gmOnlyRemoval: true } },
    description: game.i18n.localize("EX2E.GremlinSyndromeDesc")
  }]);
}

/** Remove any Gremlin Syndrome AE (recovery path — Dissonance dropped below 10). */
export async function removeGremlinAE(actor) {
  const aes = actor.effects.filter(e => e.flags?.exalted2e?.gremlinSyndrome === true);
  for (const ae of aes) await ae.delete();
}

/** Post a GM-whisper alert card with a Convert-to-Antagonist button. */
export async function postGremlinAlert(actor) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/gremlin-syndrome-alert.hbs",
    {
      actorName: actor.name,
      actorId:   actor.id,
      // Foundry's built-in {{localize}} helper does not interpolate hash args,
      // so the formatted body string is built here and passed in directly.
      bodyText:  game.i18n.format("EX2E.GremlinSyndromeAlertBody", { name: actor.name }),
    }
  );
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  await ChatMessage.create({
    content,
    whisper: gmIds,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { exalted2e: { gremlinSyndrome: { actorId: actor.id, resolved: false } } }
  });
}
