import { ExaltedRoll } from "../rolls/exalted-roll.mjs";

/**
 * Activate a Resplendency: spend its parent destiny's Endurance, roll any
 * Paradox dice into the Sidereal's Paradox track, stamp a tracked AE for
 * stat-bonus powers, and post a chat card.
 * @returns {Promise<boolean>} true on success, false if aborted.
 */
export async function activateResplendency(resplendency, destiny) {
  const actor = destiny?.parent;
  if (!destiny || !actor) {
    ui.notifications.warn(game.i18n.localize("EX2E.ResplendencyNoParentDestiny"));
    return false;
  }
  if (destiny.system.ended) {
    ui.notifications.warn(game.i18n.localize("EX2E.ResplendencyDestinyEnded"));
    return false;
  }

  const cost = resplendency.system.enduranceCost ?? 0;
  const have = destiny.system.endurance?.value ?? 0;
  if (have < cost) {
    ui.notifications.warn(game.i18n.format("EX2E.ResplendencyNotEnoughEndurance", { need: cost, have }));
    return false;
  }

  // Spend Endurance. Reaching 0 fires the Phase 1 updateItem auto-end hook.
  await destiny.update({ "system.endurance.value": have - cost });

  // Paradox dice → Sidereal Paradox track.
  let paradoxGained = 0;
  const pdice = resplendency.system.paradoxDice ?? 0;
  if (pdice > 0) {
    const roll = await new ExaltedRoll({
      pool: pdice,
      actorName: actor.name,
      flavor: game.i18n.localize("EX2E.ResplendencyParadoxFlavor")
    }).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
    // Paradox is a straight consequence of the dice rolled — count raw successes,
    // never penalty-adjusted (no external penalty applies to a Paradox roll).
    paradoxGained = roll.rawSuccesses ?? roll.successes;
    if (paradoxGained > 0) {
      const cur = actor.system.splat?.sidereal?.paradox ?? 0;
      await actor.update({ "system.splat.sidereal.paradox": Math.min(10, cur + paradoxGained) });
    }
  }

  // Stat-bonus → tracked AE.
  if (resplendency.system.isStatBonus && (resplendency.system.changes ?? []).length) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: resplendency.name,
      img: resplendency.img ?? "icons/svg/aura.svg",
      changes: resplendency.system.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value })),
      transfer: false,
      flags: {
        exalted2e: {
          resplendencyEffect: { resplendencyId: resplendency.id, destinyId: destiny.id },
          gmOnlyRemoval: true
        }
      }
    }]);
  }

  // Chat card.
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/resplendency-activation.hbs",
    {
      actorName: actor.name,
      name: resplendency.name,
      college: game.i18n.localize(
        game.exalted2e.EX2E.siderealColleges?.[resplendency.system.college]?.labelKey
          ?? resplendency.system.college
      ),
      enduranceSpent: cost,
      enduranceLeft: have - cost,
      paradoxGained,
      keyword: resplendency.system.keyword,
      description: resplendency.system.description
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
  return true;
}
