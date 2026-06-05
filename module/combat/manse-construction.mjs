import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { mansePowerDesignReqs, canDesignPower, simulateManseDamage } from "../helpers/manse-geomancy.mjs";

function _rating(manse) {
  const bg = manse.parent?.items.get(manse.system.backgroundId);
  return bg?.system.value ?? 0;
}
function _traits(actor) {
  const s = actor?.system ?? {};
  return {
    perception:   s.attributes?.perception?.value   ?? 0,
    intelligence: s.attributes?.intelligence?.value ?? 0,
    lore:         s.abilities?.lore?.value           ?? 0,
    occult:       s.abilities?.occult?.value         ?? 0,
  };
}
async function _card(actor, title, lines, warning = "") {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/manse-construction-card.hbs",
    { actorName: actor?.name ?? "", title, lines, warning }
  );
  await ChatMessage.create({ content, speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined });
}

/** Capping roll: Perception + Lore, difficulty 1; botch -> Essence buildup at full rating. */
export async function rollManseCapping(manse) {
  const actor = manse.parent;
  if (!actor) { ui.notifications.warn(game.i18n.localize("EX2E.ManseNoOwner")); return; }
  const t = _traits(actor);
  const roll = await new ExaltedRoll({
    pool: Math.max(1, t.perception + t.lore), actorName: actor.name,
    flavor: game.i18n.localize("EX2E.ManseCappingFlavor")
  }).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  const lines = []; let warning = "";
  if (roll.botch) {
    warning = game.i18n.localize("EX2E.ManseCappingBotch");
  } else if (roll.successes >= 1) {
    await manse.update({ "system.capped": true });
    lines.push(game.i18n.localize("EX2E.ManseCapped"));
  } else {
    lines.push(game.i18n.localize("EX2E.ManseCappingFailed"));
  }
  await _card(actor, game.i18n.localize("EX2E.ManseCappingTitle"), lines, warning);
}

/** Per-power design roll: Int + lowest(Occult,Lore) vs (cost+3); prereq Lore & Occult >= cost+2. */
export async function rollDesignPower(manse, index) {
  const actor = manse.parent;
  if (!actor) { ui.notifications.warn(game.i18n.localize("EX2E.ManseNoOwner")); return; }
  const powers = manse.system.powers ?? [];
  const power = powers[index];
  if (!power) return;
  const t = _traits(actor);
  const { prereq, difficulty } = mansePowerDesignReqs(power.cost);
  if (!canDesignPower(t, power.cost)) {
    ui.notifications.warn(game.i18n.format("EX2E.MansePowerDesignPrereq", { n: prereq }));
    return;
  }
  const roll = await new ExaltedRoll({
    pool: Math.max(1, t.intelligence + Math.min(t.occult, t.lore)), actorName: actor.name,
    flavor: game.i18n.format("EX2E.ManseDesignFlavor", { name: power.name })
  }).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  const next = foundry.utils.deepClone(powers);
  let line;
  if (roll.botch) { next[index].status = "damaged"; line = game.i18n.localize("EX2E.MansePowerDesignBotch"); }
  else if (roll.successes >= difficulty) { next[index].status = "designed"; line = game.i18n.localize("EX2E.MansePowerDesignSuccess"); }
  else { next[index].status = "pending"; line = game.i18n.localize("EX2E.MansePowerDesignFail"); }
  await manse.update({ "system.powers": next });
  await _card(actor, game.i18n.format("EX2E.ManseDesignTitle", { name: power.name }), [line], "");
}

/** Apply post-soak damage, cascading Power Failures; rolls the maintenance-modified buildup die per failure. */
export async function applyManseDamage(manse, amount) {
  const actor  = manse.parent;
  const rating = _rating(manse);
  const s      = manse.system;
  const sim = simulateManseDamage(
    { rating, powerFailures: s.powerFailures, damage: s.damage, fragility: s.fragility },
    amount
  );
  await manse.update({ "system.damage": sim.damage, "system.powerFailures": sim.powerFailures });
  const maint = s.maintenance ?? 0;
  for (let i = 0; i < sim.failuresThisEvent; i++) {
    const eff = Math.max(0, rating - (s.powerFailures + i + 1));
    const die = await new Roll("1d10").evaluate();
    const buildup = (die.total - maint) < 1;
    await _card(actor,
      game.i18n.localize("EX2E.MansePowerFailureTitle"),
      [ game.i18n.format("EX2E.MansePowerFailureLevel", { rating: eff }),
        game.i18n.localize("EX2E.MansePowerFailureHearthstone") ],
      buildup ? game.i18n.localize("EX2E.ManseEssenceBuildup") : "");
  }
  if (sim.destroyed) {
    await _card(actor, game.i18n.localize("EX2E.ManseDestroyedTitle"),
      [ game.i18n.localize("EX2E.ManseDestroyed") ], game.i18n.localize("EX2E.ManseEssenceBuildup"));
  }
}

/** Repair roll: Int + lowest(Occult,Lore), difficulty 3; success restores one level. */
export async function rollManseRepair(manse) {
  const actor = manse.parent;
  if (!actor) { ui.notifications.warn(game.i18n.localize("EX2E.ManseNoOwner")); return; }
  if ((manse.system.powerFailures ?? 0) <= 0) { ui.notifications.warn(game.i18n.localize("EX2E.ManseNoFailures")); return; }
  const t = _traits(actor);
  const roll = await new ExaltedRoll({
    pool: Math.max(1, t.intelligence + Math.min(t.occult, t.lore)), actorName: actor.name,
    flavor: game.i18n.localize("EX2E.ManseRepairFlavor")
  }).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  let line;
  if (roll.successes >= 3) {
    await manse.update({ "system.powerFailures": Math.max(0, manse.system.powerFailures - 1) });
    line = game.i18n.localize("EX2E.ManseRepairSuccess");
  } else {
    line = game.i18n.localize("EX2E.ManseRepairFail");
  }
  await _card(actor, game.i18n.localize("EX2E.ManseRepairTitle"), [line], "");
}
