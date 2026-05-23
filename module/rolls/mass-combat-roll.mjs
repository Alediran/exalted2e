import { ExaltedRoll } from "./exalted-roll.mjs";
import {
  computeEffectiveCCR,
  computeEffectiveRCR,
  computeMagnitudeDiffBonus,
  computeHealthTrackMagLoss,
  computeRoutPool,
  computeFormationRoutMod,
  computeRoutMagLoss
} from "./mass-combat-math.mjs";

export async function rollMassCombatAttack(unitActor, { ranged = false, explicitTargetActor = null } = {}) {
  let defenderActor;
  if (explicitTargetActor) {
    defenderActor = explicitTargetActor;
  } else {
    const target = [...game.user.targets][0];
    if (!target || target.actor?.type !== "unit") {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetUnit"));
      return;
    }
    defenderActor = target.actor;
  }
  const atk = unitActor.system;
  const def = defenderActor.system;

  // Consume aim bonus before rolling
  const aimBonus = atk.aimBonus ?? 0;
  if (aimBonus > 0) await unitActor.update({ "system.aimBonus": 0 });

  // Step 1 — Attack roll
  const pool      = Math.max(1, atk.attackPool + aimBonus);
  const atkRoll   = new ExaltedRoll({ pool });
  const atkResult = await atkRoll.evaluate();

  // Post-roll bonus successes
  const warRating = atk.commanderActor?.system?.abilities?.war?.value ?? 0;
  const ccrBonus  = ranged
    ? computeEffectiveRCR(atk.rangedCombatRating, warRating)
    : computeEffectiveCCR(atk.closeCombatRating, warRating, atk.formation);
  const magDiff   = computeMagnitudeDiffBonus(atk.magnitude.value, def.magnitude.value);
  const effective = atkResult.successes + ccrBonus + atk.might + magDiff;
  const hit       = effective >= def.drill;

  const state = {
    attackerName:       unitActor.name,
    defenderName:       defenderActor.name,
    attackPool:         pool,
    aimBonus,
    attackSuccesses:    atkResult.successes,
    ccrBonus,
    might:              atk.might,
    magDiff,
    effectiveSuccesses: effective,
    defenderDrill:      def.drill,
    hit,
    ranged,
    atkDiceDetails:     atkResult.diceDetails,
    // Damage
    dmgRating:          ranged ? atk.rangedDamageRating : atk.closeDamageRating,
    endurance:          def.endurance,
    armor:              def.armor,
    dmgSuccesses:       0,
    endSuccesses:       0,
    netDamage:          0,
    dmgDiceDetails:     [],
    endDiceDetails:     [],
    // Health / Magnitude
    healthBefore:       def.health.value,
    healthMax:          def.health.max,
    healthAfter:        def.health.value,
    magBefore:          def.magnitude.value,
    magAfterDamage:     def.magnitude.value,
    magLostToDamage:    0,
    // Rout
    routPool:           0,
    routFormMod:        0,
    routDiff:           0,
    routSuccesses:      0,
    routHolds:          true,
    routDiceDetails:    [],
    routMagLoss:        0,
    magAfterRout:       def.magnitude.value,
    hesitating:         false
  };

  // Mark engaged on close hit
  if (hit && !ranged) {
    await Promise.all([
      unitActor.update({ "system.engaged": true }),
      defenderActor.update({ "system.engaged": true })
    ]);
  }

  if (hit) {
    // Step 2 — Damage roll
    const dmgPool  = Math.max(1, state.dmgRating);
    const dmgRoll  = new ExaltedRoll({ pool: dmgPool });
    const endPool  = Math.max(1, def.endurance);
    const endRoll  = new ExaltedRoll({ pool: endPool });
    const [dmgResult, endResult] = await Promise.all([dmgRoll.evaluate(), endRoll.evaluate()]);

    state.dmgSuccesses   = dmgResult.successes;
    state.endSuccesses   = endResult.successes;
    state.dmgDiceDetails = dmgResult.diceDetails;
    state.endDiceDetails = endResult.diceDetails;
    state.netDamage      = Math.max(0, dmgResult.successes - (endResult.successes + def.armor));

    // Step 3 — Health track cycling
    const { newHealth, magLost } = computeHealthTrackMagLoss(
      def.health.value, def.health.max, state.netDamage, def.magnitude.value
    );
    state.healthAfter     = newHealth;
    state.magLostToDamage = magLost;
    state.magAfterDamage  = Math.max(0, def.magnitude.value - magLost);

    if (magLost > 0) {
      // Step 4 — Rout check
      const formMod  = computeFormationRoutMod(def.formation);
      const routDiff = Math.max(1, magLost + formMod);
      const routPool = computeRoutPool(def.morale, state.magAfterDamage, def.drill);

      state.routFormMod = formMod;
      state.routDiff    = routDiff;
      state.routPool    = routPool;

      const routRoll   = new ExaltedRoll({ pool: Math.max(1, routPool) });
      const routResult = await routRoll.evaluate();
      state.routSuccesses   = routResult.successes;
      state.routDiceDetails = routResult.diceDetails;
      state.routHolds       = routResult.successes >= routDiff;

      const rml = computeRoutMagLoss(routDiff, routResult.successes);
      state.routMagLoss  = rml;
      state.magAfterRout = Math.max(0, state.magAfterDamage - rml);

      if (!state.routHolds) {
        state.hesitating  = true;
        state.healthAfter = def.health.max;
      }
    } else {
      state.magAfterRout = state.magAfterDamage;
    }
  } else {
    state.magAfterRout = def.magnitude.value;
  }

  // Post chat card first, then apply state changes
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: unitActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/mass-combat-result.hbs",
      state
    ),
    flags: {
      exalted2e: {
        massCombatAttack: {
          attackerActorId: unitActor.id,
          defenderActorId: defenderActor.id,
          hit:             state.hit,
          netDamage:       state.netDamage,
          ccrBonus:        state.ccrBonus,
          magDiff:         state.magDiff,
          healthBefore:    state.healthBefore,
          healthAfter:     state.healthAfter,
          routDiff:        state.routDiff,
          routPool:        state.routPool,
          hesitating:      state.hesitating,
          magBefore:       state.magBefore,
          magAfterRout:    state.magAfterRout
        }
      }
    }
  });

  // Apply defender state changes
  const updates = {};
  if (state.healthAfter !== state.healthBefore)  updates["system.health.value"]     = state.healthAfter;
  if (state.magAfterRout !== state.magBefore)    updates["system.magnitude.value"]  = state.magAfterRout;
  if (Object.keys(updates).length) await defenderActor.update(updates);

  // Set hesitating combatant flag
  if (state.hesitating) {
    const combatant = game.combat?.combatants.find(c => c.actor?.id === defenderActor.id);
    if (combatant) await combatant.setFlag("exalted2e", "hesitating", true);
  }
}
