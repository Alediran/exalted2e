import { ExaltedRoll } from "./exalted-roll.mjs";
import {
  computeNetDamage,
  computeRoutDifficulty,
  computeMagnitudeAfterDamage,
  computeMagnitudeAfterRout
} from "./mass-combat-math.mjs";

export async function rollMassCombatAttack(unitActor) {
  const target = [...game.user.targets][0];
  if (!target || target.actor?.type !== "unit") {
    ui.notifications.warn(game.i18n.localize("EX2E.NoTargetUnit"));
    return;
  }
  const defenderActor = target.actor;
  const atk = unitActor.system;
  const def = defenderActor.system;

  // Step 1 — Attack roll
  const atkRoll   = new ExaltedRoll({ pool: atk.attackPool });
  const atkResult = await atkRoll.evaluate();
  const hit = atkResult.successes >= def.drill;

  const state = {
    attackerName:        unitActor.name,
    defenderName:        defenderActor.name,
    attackPool:          atk.attackPool,
    attackSuccesses:     atkResult.successes,
    defenderDrill:       def.drill,
    hit,
    atkDiceDetails:      atkResult.diceDetails,
    might:               atk.might,
    endurance:           def.endurance,
    mightSuccesses:      0,
    enduranceSuccesses:  0,
    mightDiceDetails:    [],
    enduranceDiceDetails:[],
    netDamage:           0,
    morale:              def.morale,
    moraleSuccesses:     0,
    routDiceDetails:     [],
    holds:               true,
    magBefore:           def.magnitude.value,
    magAfterDamage:      def.magnitude.value,
    magAfterRout:        def.magnitude.value
  };

  if (hit) {
    // Step 2 — Damage roll
    let mightResult, endResult;
    if (atk.might === 0) {
      mightResult = { successes: 0, diceDetails: [] };
      endResult   = await new ExaltedRoll({ pool: def.endurance }).evaluate();
    } else {
      [mightResult, endResult] = await Promise.all([
        new ExaltedRoll({ pool: atk.might }).evaluate(),
        new ExaltedRoll({ pool: def.endurance }).evaluate()
      ]);
    }
    state.mightSuccesses       = mightResult.successes;
    state.enduranceSuccesses   = endResult.successes;
    state.mightDiceDetails     = mightResult.diceDetails;
    state.enduranceDiceDetails = endResult.diceDetails;
    state.netDamage            = computeNetDamage(state.mightSuccesses, state.enduranceSuccesses);
    state.magAfterDamage       = computeMagnitudeAfterDamage(state.magBefore, state.netDamage);

    if (state.netDamage > 0) {
      // Step 3 — Rout check (rolls only, no update yet)
      const routRoll   = new ExaltedRoll({ pool: def.morale });
      const routResult = await routRoll.evaluate();
      state.moraleSuccesses = routResult.successes;
      state.routDiceDetails = routResult.diceDetails;
      state.holds           = routResult.successes >= computeRoutDifficulty(state.netDamage);
      state.magAfterRout    = computeMagnitudeAfterRout(state.magAfterDamage, state.holds);
    } else {
      state.magAfterRout = state.magBefore;
    }
  }

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
          holds:           state.holds,
          magBefore:       state.magBefore,
          magAfterRout:    state.magAfterRout
        }
      }
    }
  });

  // Single magnitude write after all dice resolved and chat message created
  if (state.magAfterRout !== state.magBefore) {
    await defenderActor.update({ "system.magnitude.value": state.magAfterRout });
  }
}
