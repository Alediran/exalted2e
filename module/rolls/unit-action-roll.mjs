import { ExaltedRoll } from "./exalted-roll.mjs";
import {
  computeChargePool,
  computeChargeDifficulty,
  computeChangeFormationDifficulty,
  computeDisengagePool,
  computeDisengageDifficulty,
  computeSplitParentMagnitude,
} from "./mass-combat-math.mjs";

function getCommanderStats(unitActor) {
  const cmd = unitActor.system.commanderActor;
  return {
    charisma: cmd?.system?.attributes?.charisma?.value ?? 0,
    wits:     cmd?.system?.attributes?.wits?.value     ?? 0, // used by rollDisengage
    war:      cmd?.system?.abilities?.war?.value       ?? 0,
  };
}

export async function rollCharge(unitActor) {
  const sys = unitActor.system;
  const { charisma, war } = getCommanderStats(unitActor);
  const pool = computeChargePool(charisma, war);
  const diff = computeChargeDifficulty(sys.magnitude.value, sys.drill);

  const roll = new ExaltedRoll({ pool });
  const result = await roll.evaluate();
  const success = result.successes >= diff;

  const enduranceBefore = sys.endurance;
  const armorFatigue = sys.armorFatigue ?? 0;
  const enduranceCost = success ? Math.max(0, 1 - armorFatigue) : 0;
  const enduranceAfter = Math.max(1, enduranceBefore - enduranceCost);

  const state = {
    actionKey:      "charge",
    attackerName:   unitActor.name,
    pool,
    successes:      result.successes,
    difficulty:     diff,
    diceDetails:    result.diceDetails,
    success,
    enduranceCost,
    enduranceBefore,
    enduranceAfter,
  };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/unit-action-result.hbs",
      state
    ),
  });

  if (success && enduranceCost > 0) {
    await unitActor.update({ "system.endurance": enduranceAfter });
  }

  return state;
}

export async function rollChangeFormation(unitActor, {
  newFormation,
  pool,
  successes,
  diceDetails,
  success,
  diff,
} = {}) {
  const state = {
    actionKey:    "change-formation",
    attackerName: unitActor.name,
    pool,
    successes,
    difficulty:   diff,
    diceDetails,
    success,
    newFormation: success ? newFormation : unitActor.system.formation,
  };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/unit-action-result.hbs",
      state
    ),
  });

  if (success) {
    await unitActor.update({ "system.formation": newFormation });
  }

  return state;
}

export async function rollDisengage(unitActor) {
  const target = [...game.user.targets][0];
  if (!target || !target.actor) {
    ui.notifications.warn(game.i18n.localize("EX2E.NoTargetUnit"));
    return;
  }
  const targetActor = target.actor;

  const sys = unitActor.system;
  const { wits, war } = getCommanderStats(unitActor);
  const pool = computeDisengagePool(wits, war, sys.drill, sys.magnitude.value);
  const diff = computeDisengageDifficulty(targetActor.system.drill ?? 0);

  const roll = new ExaltedRoll({ pool });
  const result = await roll.evaluate();
  const success = result.successes >= diff;

  const state = {
    actionKey:    "disengage",
    attackerName: unitActor.name,
    defenderName: targetActor.name,
    pool,
    successes:    result.successes,
    difficulty:   diff,
    diceDetails:  result.diceDetails,
    success,
  };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/unit-action-result.hbs",
      state
    ),
  });

  if (success) {
    await Promise.all([
      unitActor.update({ "system.engaged": false }),
      targetActor.update({ "system.engaged": false }),
    ]);
  }

  return state;
}

export async function rollSplitUnit(unitActor, { newUnitMagnitude }) {
  const sys = unitActor.system;
  const { charisma, war } = getCommanderStats(unitActor);
  const pool = computeChargePool(charisma, war); // Split uses Charisma+War, same as Charge
  const diff = Math.max(1, sys.magnitude.value - sys.drill);

  const roll = new ExaltedRoll({ pool });
  const result = await roll.evaluate();
  const success = result.successes >= diff;

  const parentMagAfter = success
    ? computeSplitParentMagnitude(sys.magnitude.value, newUnitMagnitude)
    : sys.magnitude.value;

  let newUnitName = null;
  let createdActor = null;

  if (success) {
    const newActorData = {
      name: `${unitActor.name} (Split)`,
      type: "unit",
      system: {
        formation:          "unordered",
        commanderActorId:   "",
        drill:              sys.drill,
        endurance:          sys.endurance,
        morale:             sys.morale,
        might:              sys.might,
        closeCombatRating:  sys.closeCombatRating,
        rangedCombatRating: sys.rangedCombatRating,
        closeDamageRating:  sys.closeDamageRating,
        rangedDamageRating: sys.rangedDamageRating,
        armor:              sys.armor,
        magnitude:          { value: newUnitMagnitude, max: sys.magnitude.max },
        health:             { value: 0, max: sys.health.max },
      },
    };
    createdActor = await Actor.create(newActorData);
    newUnitName = createdActor.name;
  }

  const state = {
    actionKey:    "split",
    attackerName: unitActor.name,
    pool,
    successes:    result.successes,
    difficulty:   diff,
    diceDetails:  result.diceDetails,
    success,
    parentMagAfter,
    newUnitMag:   success ? newUnitMagnitude : 0,
    newUnitName,
  };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/unit-action-result.hbs",
      state
    ),
  });

  if (success) {
    await unitActor.update({ "system.magnitude.value": parentMagAfter });
  } else {
    const combatant = game.combat?.combatants.find(c => c.actor?.id === unitActor.id);
    if (combatant) await combatant.setFlag("exalted2e", "hesitating", true);
  }

  return state;
}

export async function rollMergeUnits(unitActor, targetActor, { resultMagnitude }) {
  const sys    = unitActor.system;
  const defSys = targetActor.system;

  const { charisma, war } = getCommanderStats(unitActor);
  const pool       = computeChargePool(charisma, war); // Merge uses Charisma+War, same as Charge
  const targetPool = computeChargePool(
    targetActor.system.commanderActor?.system?.attributes?.charisma?.value ?? 0,
    targetActor.system.commanderActor?.system?.abilities?.war?.value ?? 0
  );
  const diff = Math.max(1, sys.magnitude.value - sys.drill); // same diff applies to both rolls

  const [unitRoll, targetRoll] = await Promise.all([
    new ExaltedRoll({ pool }).evaluate(),
    new ExaltedRoll({ pool: targetPool }).evaluate(),
  ]);

  const success = unitRoll.successes >= diff && targetRoll.successes >= diff;

  const survivingActor = sys.magnitude.value >= defSys.magnitude.value ? unitActor : targetActor;
  const absorbedActor  = survivingActor === unitActor ? targetActor : unitActor;

  const state = {
    actionKey:         "merge",
    attackerName:      unitActor.name,
    defenderName:      targetActor.name,
    pool,
    successes:         unitRoll.successes,
    difficulty:        diff,
    diceDetails:       unitRoll.diceDetails,
    targetPool,
    targetSuccesses:   targetRoll.successes,
    targetDiceDetails: targetRoll.diceDetails,
    success,
    resultMagnitude,
  };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/unit-action-result.hbs",
      state
    ),
  });

  if (success) {
    await survivingActor.update({ "system.magnitude.value": resultMagnitude });
    if (game.combat) {
      const absorbedCombatant = game.combat.combatants.find(c => c.actor?.id === absorbedActor.id);
      if (absorbedCombatant) await game.combat.deleteEmbeddedDocuments("Combatant", [absorbedCombatant.id]);
    }
    await absorbedActor.delete();
  } else {
    const combatants = game.combat?.combatants.filter(
      c => c.actor?.id === unitActor.id || c.actor?.id === targetActor.id
    ) ?? [];
    await Promise.all(combatants.map(c => c.setFlag("exalted2e", "hesitating", true)));
  }

  return state;
}
