import { ExaltedRoll } from "./exalted-roll.mjs";
import { checkAndDisband } from "./unit-action-roll.mjs";
import {
  computeEffectiveCCR,
  computeEffectiveRCR,
  computeMagnitudeDiffBonus,
  computeHealthTrackMagLoss,
  computeRoutPool,
  computeFormationRoutMod,
  computeRoutMagLoss,
  computeHeroNetDamage
} from "./mass-combat-math.mjs";

export async function rollMassCombatAttack(unitActor, { ranged = false, explicitTargetActor = null } = {}) {
  let defenderActor;
  if (explicitTargetActor) {
    defenderActor = explicitTargetActor;
  } else {
    const target = [...game.user.targets][0];
    if (!target || !target.actor) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetUnit"));
      return;
    }
    defenderActor = target.actor;
  }
  const atk         = unitActor.system;
  const def         = defenderActor.system;
  const targetIsUnit = defenderActor.type === "unit";

  const aimBonus         = atk.aimBonus ?? 0;
  if (aimBonus > 0) await unitActor.update({ "system.aimBonus": 0 });

  const fatiguePenalty      = (atk.endurance <= 0) ? -2 : 0;
  const pool                = Math.max(1, atk.attackPool + aimBonus + fatiguePenalty);
  const attackerCombatant   = game.combat?.combatants.find(c => c.actor?.id === unitActor.id);
  const attackerCharged     = attackerCombatant?.flags?.exalted2e?.chargedLastAction ?? false;
  const atkRoll   = new ExaltedRoll({ pool });
  const atkResult = await atkRoll.evaluate();

  const warRating = atk.commanderActor?.system?.abilities?.war?.value ?? 0;
  const ccrBonus  = ranged
    ? computeEffectiveRCR(atk.rangedCombatRating, warRating)
    : computeEffectiveCCR(atk.closeCombatRating, warRating, atk.formation);
  const magDiff   = targetIsUnit
    ? computeMagnitudeDiffBonus(atk.magnitude.value, def.magnitude.value)
    : 0;
  const effective = atkResult.successes + ccrBonus + atk.might + magDiff;
  const defDV     = targetIsUnit
    ? def.drill
    : (ranged ? defenderActor.currentDodgeDV : defenderActor.currentParryDV);
  const hit       = effective >= defDV;

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
    defenderDrill:      targetIsUnit ? def.drill : 0,
    defenderDV:         targetIsUnit ? 0 : defDV,
    heroAttacker:       false,
    heroDefender:       !targetIsUnit,
    hit,
    ranged,
    atkDiceDetails:     atkResult.diceDetails,
    dmgRating:          ranged ? atk.rangedDamageRating : atk.closeDamageRating,
    endurance:          targetIsUnit ? def.endurance : 0,
    armor:              targetIsUnit ? def.armor : 0,
    dmgSuccesses:       0,
    endSuccesses:       0,
    netDamage:          0,
    dmgDiceDetails:     [],
    endDiceDetails:     [],
    heroDmgPool:        0,
    soak:               0,
    minDamage:          0,
    healthBefore:       targetIsUnit ? def.health.value : 0,
    healthMax:          targetIsUnit ? def.health.max : 0,
    healthAfter:        targetIsUnit ? def.health.value : 0,
    magBefore:          targetIsUnit ? def.magnitude.value : 0,
    magAfterDamage:     targetIsUnit ? def.magnitude.value : 0,
    magLostToDamage:    0,
    routPool:           0,
    routFormMod:        0,
    routDiff:           0,
    routSuccesses:      0,
    routHolds:          true,
    routDiceDetails:    [],
    routMagLoss:        0,
    magAfterRout:       targetIsUnit ? def.magnitude.value : 0,
    hesitating:         false,
    fatiguePenalty,
    showExhaustionButtons: true,
    attackerIsUnit:        true,
    attackerActorId:       unitActor.id,
    attackerCharged,
    defenderIsUnit:        targetIsUnit,
    defenderActorId:       defenderActor.id,
    defChokepoint:         targetIsUnit ? (def.chokepoint        ?? false) : false,
    defChokeMaxAttackers:  targetIsUnit ? (def.chokeMaxAttackers ?? 1)     : 1,
    defChokepointLabel:    (targetIsUnit && def.chokepoint)
      ? game.i18n.format("EX2E.ChokepointWarning", { max: def.chokeMaxAttackers ?? 1 })
      : "",
  };

  if (hit && !ranged && targetIsUnit) {
    await Promise.all([
      unitActor.update({ "system.engaged": true }),
      defenderActor.update({ "system.engaged": true })
    ]);
  }

  if (hit) {
    if (targetIsUnit) {
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

      const { newHealth, magLost } = computeHealthTrackMagLoss(
        def.health.value, def.health.max, state.netDamage, def.magnitude.value
      );
      state.healthAfter     = newHealth;
      state.magLostToDamage = magLost;
      state.magAfterDamage  = Math.max(0, def.magnitude.value - magLost);

      if (magLost > 0) {
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
      const soak    = defenderActor.system.totalSoak?.lethal ?? 0;
      const dmgPool = Math.max(1, state.dmgRating);
      const dmgRoll = new ExaltedRoll({ pool: dmgPool });
      const dmgResult = await dmgRoll.evaluate();

      state.dmgSuccesses   = dmgResult.successes;
      state.dmgDiceDetails = dmgResult.diceDetails;
      state.soak           = soak;
      state.minDamage      = atk.magnitude.value;
      state.netDamage      = computeHeroNetDamage(dmgResult.successes, soak, atk.magnitude.value);
    }
  } else {
    state.magAfterRout = targetIsUnit ? def.magnitude.value : 0;
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
          attackPool:      pool,
          fatiguePenalty,
          heroDefender:    !targetIsUnit,
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
          magBefore:            state.magBefore,
          magAfterRout:         state.magAfterRout,
          defChokepoint:        state.defChokepoint,
          defChokeMaxAttackers: state.defChokeMaxAttackers
        }
      }
    }
  });

  if (targetIsUnit) {
    if (state.healthAfter !== state.healthBefore) {
      await defenderActor.update({ "system.health.value": state.healthAfter });
    }
    if (state.magAfterRout !== state.magBefore) {
      await checkAndDisband(defenderActor, state.magAfterRout);
    }

    if (state.hesitating && game.actors.get(defenderActor.id)) {
      const combatant = game.combat?.combatants.find(c => c.actor?.id === defenderActor.id);
      if (combatant) await combatant.setFlag("exalted2e", "hesitating", true);
      const hesEff = CONFIG.statusEffects["unitHesitating"];
      if (hesEff) {
        for (const token of defenderActor.getActiveTokens()) {
          await token.toggleEffect(hesEff, { active: true });
        }
      }
    }
  } else {
    if (state.hit && state.netDamage > 0) {
      await defenderActor.applyDamage(state.netDamage, "lethal");
    }
  }
}

export async function rollHeroAttacksUnit(heroActor, unitActor, weapon, { ranged = false } = {}) {
  const def = unitActor.system;

  const dex      = heroActor.system.attributes?.dexterity?.value ?? 0;
  const ability  = heroActor.system.abilities?.[weapon.system.ability]?.value ?? 0;
  const accuracy = weapon.system.accuracy ?? 0;
  const aimBonus = heroActor.system.aimBonus ?? 0;
  if (aimBonus > 0) await heroActor.update({ "system.aimBonus": 0 });

  const pool      = Math.max(1, dex + ability + accuracy + aimBonus);
  const atkRoll   = new ExaltedRoll({ pool });
  const atkResult = await atkRoll.evaluate();

  const unitDV = ranged ? def.unitDodgeDV : def.unitParryDV;
  const hit    = atkResult.successes >= unitDV;

  const state = {
    heroAttacker:       true,
    attackerName:       heroActor.name,
    defenderName:       unitActor.name,
    attackPool:         pool,
    aimBonus,
    attackSuccesses:    atkResult.successes,
    ccrBonus:           0,
    might:              0,
    magDiff:            0,
    effectiveSuccesses: atkResult.successes,
    defenderDrill:      0,
    defenderDV:         unitDV,
    hit,
    ranged,
    atkDiceDetails:     atkResult.diceDetails,
    heroDmgPool:        0,
    dmgRating:          0,
    dmgSuccesses:       0,
    netDamage:          0,
    dmgDiceDetails:     [],
    endDiceDetails:     [],
    endSuccesses:       0,
    endurance:          def.endurance,
    armor:              def.armor,
    soak:               0,
    minDamage:          0,
    healthBefore:       def.health.value,
    healthMax:          def.health.max,
    healthAfter:        def.health.value,
    magBefore:          def.magnitude.value,
    magAfterDamage:     def.magnitude.value,
    magLostToDamage:    0,
    routPool:           0,
    routFormMod:        0,
    routDiff:           0,
    routSuccesses:      0,
    routHolds:          true,
    routDiceDetails:    [],
    routMagLoss:        0,
    magAfterRout:       def.magnitude.value,
    hesitating:         false,
    showExhaustionButtons: true,
    attackerIsUnit:        false,
    attackerCharged:       false,
    defenderIsUnit:        true,
    defenderActorId:       unitActor.id,
    defChokepoint:         def.chokepoint        ?? false,
    defChokeMaxAttackers:  def.chokeMaxAttackers ?? 1,
    defChokepointLabel:    def.chokepoint
      ? game.i18n.format("EX2E.ChokepointWarning", { max: def.chokeMaxAttackers ?? 1 })
      : "",
  };

  if (hit) {
    const str     = heroActor.system.attributes?.strength?.value ?? 0;
    const dmgBase = weapon.system.damage ?? 0;
    const dmgPool = Math.max(1, str + dmgBase);
    const dmgRoll = new ExaltedRoll({ pool: dmgPool });
    const dmgResult = await dmgRoll.evaluate();

    state.heroDmgPool    = dmgPool;
    state.dmgSuccesses   = dmgResult.successes;
    state.dmgDiceDetails = dmgResult.diceDetails;
    state.netDamage      = Math.max(0, dmgResult.successes - def.armor);

    const { newHealth, magLost } = computeHealthTrackMagLoss(
      def.health.value, def.health.max, state.netDamage, def.magnitude.value
    );
    state.healthAfter     = newHealth;
    state.magLostToDamage = magLost;
    state.magAfterDamage  = Math.max(0, def.magnitude.value - magLost);

    if (magLost > 0) {
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

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: heroActor }),
    content: await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/mass-combat-result.hbs",
      state
    ),
    flags: {
      exalted2e: {
        massCombatAttack: {
          heroAttacker:    true,
          attackerActorId: heroActor.id,
          defenderActorId: unitActor.id,
          hit:             state.hit,
          netDamage:       state.netDamage,
          magBefore:       state.magBefore,
          magAfterRout:    state.magAfterRout,
          healthBefore:         state.healthBefore,
          healthAfter:          state.healthAfter,
          defChokepoint:        state.defChokepoint,
          defChokeMaxAttackers: state.defChokeMaxAttackers
        }
      }
    }
  });

  if (state.healthAfter !== state.healthBefore) {
    await unitActor.update({ "system.health.value": state.healthAfter });
  }
  if (state.magAfterRout !== state.magBefore) {
    await checkAndDisband(unitActor, state.magAfterRout);
  }

  if (state.hesitating && game.actors.get(unitActor.id)) {
    const combatant = game.combat?.combatants.find(c => c.actor?.id === unitActor.id);
    if (combatant) await combatant.setFlag("exalted2e", "hesitating", true);
    const hesEff = CONFIG.statusEffects["unitHesitating"];
    if (hesEff) {
      for (const token of unitActor.getActiveTokens()) {
        await token.toggleEffect(hesEff, { active: true });
      }
    }
  }
}
