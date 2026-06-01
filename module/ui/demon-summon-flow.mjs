import { ExaltedRoll } from "../rolls/exalted-roll.mjs";

/**
 * Entry point called by _createSpellEffectAe when spellSubtype === "demon-summoning".
 * Shows a setup dialog, rolls binding, and posts a result chat card.
 */
export async function demonSummonFlow(actor, spell) {
  if (!actor) return;
  const setup = await _showDemonSetupDialog();
  if (!setup) return;

  const { demonName, circle, bonusDice } = setup;

  const cha    = actor.system.attributes?.charisma?.value ?? 0;
  const occult = actor.system.abilities?.occult?.value    ?? 0;
  const pool   = Math.max(1, cha + occult + bonusDice);

  // Difficulty scales with circle: 1→3, 2→5, 3→7
  const difficulty = circle === 1 ? 3 : circle === 2 ? 5 : 7;

  const result = await new ExaltedRoll({ pool }).evaluate();
  const net    = result.successes - difficulty;

  let bindingDuration;
  if (result.botch || net < 0) {
    bindingDuration = null;
  } else if (net === 0) {
    bindingDuration = `${circle} week${circle !== 1 ? "s" : ""}`;
  } else if (net === 1) {
    bindingDuration = `${circle} month${circle !== 1 ? "s" : ""}`;
  } else {
    bindingDuration = `${circle} year${circle !== 1 ? "s" : ""}`;
  }

  const circleLabel = game.i18n.localize(`EX2E.DemonSummonCircle${circle}`);
  const outcomeText = bindingDuration
    ? game.i18n.format("EX2E.DemonSummonResultBound",  { demon: demonName, duration: bindingDuration })
    : game.i18n.format("EX2E.DemonSummonResultFailed", { demon: demonName });

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/demon-summon-result.hbs",
    {
      actorName:    actor.name,
      spellName:    spell?.name ?? "",
      demonName,
      circleLabel,
      pool,
      successes:    result.successes,
      difficulty,
      outcomeText,
      bound:        !!bindingDuration,
    }
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  });
}

async function _showDemonSetupDialog() {
  const content = `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.DemonSummonDemonName")}</label>
  <input type="text" name="demonName" value="" style="flex:1">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.DemonSummonCircle")}</label>
  <select name="circle" style="flex:1">
    <option value="1">${game.i18n.localize("EX2E.DemonSummonCircle1")}</option>
    <option value="2">${game.i18n.localize("EX2E.DemonSummonCircle2")}</option>
    <option value="3">${game.i18n.localize("EX2E.DemonSummonCircle3")}</option>
  </select>
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.DemonSummonBonusDice")}</label>
  <input type="number" name="bonusDice" value="0" min="0" max="20" style="width:5em">
</div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("EX2E.DemonSummonSetupTitle") },
    content,
    ok: {
      label: game.i18n.localize("EX2E.Confirm"),
      callback: (_ev, button) => {
        const form = button.form;
        const demonName = form.elements.demonName?.value?.trim();
        if (!demonName) return null;
        return {
          demonName,
          circle:    parseInt(form.elements.circle?.value)    || 1,
          bonusDice: parseInt(form.elements.bonusDice?.value) || 0,
        };
      }
    }
  });
}
