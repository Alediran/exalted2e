import { ExaltedRoll } from "./exalted-roll.mjs";
import { clinchOutcome, clinchDamageDice, clinchFreezeInitiative } from "./clinch-math.mjs";

// ── Async Foundry functions ───────────────────────────────────────────

/**
 * Roll control pools (Str + MA) for both parties, post a chat card,
 * and return the outcome.
 */
export async function rollClinchControl(attackerActor, targetActor) {
  const aStr = attackerActor.system.attributes?.strength?.value  ?? 0;
  const aMA  = attackerActor.system.abilities?.martialArts?.value ?? 0;
  const dStr = targetActor.system.attributes?.strength?.value    ?? 0;
  const dMA  = targetActor.system.abilities?.martialArts?.value  ?? 0;

  const [aResult, dResult] = await Promise.all([
    ExaltedRoll.rollPool(attackerActor, {
      pool:     aStr + aMA,
      flavor:   game.i18n.localize("EX2E.ClinchControlRoll"),
      category: "physical"
    }),
    ExaltedRoll.rollPool(targetActor, {
      pool:     dStr + dMA,
      flavor:   game.i18n.localize("EX2E.ClinchControlRoll"),
      category: "physical"
    }),
  ]);

  const outcome = clinchOutcome(aResult.successes, dResult.successes);

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/clinch-established.hbs",
    {
      established:       outcome.attackerWins,
      controllerName:    attackerActor.name,
      heldName:          targetActor.name,
      attackerSuccesses: aResult.successes,
      defenderSuccesses: dResult.successes,
      controlMargin:     outcome.controlMargin,
    }
  );
  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: attackerActor }) });

  return {
    attackerSuccesses: aResult.successes,
    defenderSuccesses: dResult.successes,
    controlMargin:     outcome.controlMargin,
    attackerWins:      outcome.attackerWins,
  };
}

/**
 * Stamp clinch flags on both combatants and freeze the held combatant's
 * initiative so they do not become active before the controller's first
 * sub-action.
 */
export async function stampClinchState(combat, controllerCombatant, heldCombatant, controlMargin) {
  await Promise.all([
    controllerCombatant.setFlag("exalted2e", "clinch", {
      role:             "controller",
      heldCombatantId:  heldCombatant.id,
      controlMargin,
    }),
    heldCombatant.setFlag("exalted2e", "clinch", {
      role:                  "held",
      controllerCombatantId: controllerCombatant.id,
    }),
  ]);
  const frozenTick = clinchFreezeInitiative(controllerCombatant.initiative ?? 0, 3);
  await heldCombatant.update({ initiative: frozenTick });
  await heldCombatant.actor?.toggleStatusEffect("restrain", { active: true });
}

/**
 * Execute a clinch sub-action (hold, crush, throw, release).
 * Caller is responsible for calling combat.advanceCurrentByTicks(speed) afterwards.
 */
export async function applyClinchSubAction(combat, controllerCombatant, subAction) {
  const controllerActor = controllerCombatant.actor;
  const clinchFlag      = controllerCombatant.flags?.exalted2e?.clinch;
  if (!clinchFlag || clinchFlag.role !== "controller") return;

  const heldCombatant = combat.combatants.get(clinchFlag.heldCombatantId);
  const heldActor     = heldCombatant?.actor;
  if (!heldActor) return;

  const str    = controllerActor.system.attributes?.strength?.value ?? 0;
  const damage = clinchDamageDice(str);

  switch (subAction) {
    case "hold": {
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/clinch-action.hbs",
        { subAction: "hold", controllerName: controllerActor.name, heldName: heldActor.name }
      );
      await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: controllerActor }) });
      // +4 (speed 3 + 1) so held lands one tick *behind* where the controller
      // will be after advanceCurrentByTicks(3), preventing a tick tie.
      const frozenTick = clinchFreezeInitiative(controllerCombatant.initiative ?? 0, 4);
      await heldCombatant.update({ initiative: frozenTick });
      await controllerCombatant.setFlag("exalted2e", "pendingAction", {
        actionKey: "clinchHold", label: game.i18n.localize("EX2E.ClinchHold"),
        speed: 3, dvPenalty: 0, dvEffectId: null, abortable: false
      });
      break;
    }

    case "crush": {
      await heldActor.applyDamage(damage, "bashing", { unsoakable: true });
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/clinch-action.hbs",
        { subAction: "crush", controllerName: controllerActor.name, heldName: heldActor.name, damage }
      );
      await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: controllerActor }) });
      const frozenTick = clinchFreezeInitiative(controllerCombatant.initiative ?? 0, 4);
      await heldCombatant.update({ initiative: frozenTick });
      await controllerCombatant.setFlag("exalted2e", "pendingAction", {
        actionKey: "clinchCrush", label: game.i18n.localize("EX2E.ClinchCrush"),
        speed: 3, dvPenalty: 0, dvEffectId: null, abortable: false
      });
      break;
    }

    case "throw": {
      await heldActor.applyDamage(damage, "lethal");
      await heldActor.toggleStatusEffect("prone", { active: true });
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/clinch-action.hbs",
        { subAction: "throw", controllerName: controllerActor.name, heldName: heldActor.name, damage, prone: true }
      );
      await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: controllerActor }) });
      await releaseClinch(controllerCombatant, heldCombatant);
      await controllerCombatant.setFlag("exalted2e", "pendingAction", {
        actionKey: "clinchThrow", label: game.i18n.localize("EX2E.ClinchThrow"),
        speed: 3, dvPenalty: 0, dvEffectId: null, abortable: false
      });
      break;
    }

    case "release": {
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/clinch-action.hbs",
        { subAction: "release", controllerName: controllerActor.name, heldName: heldActor.name }
      );
      await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: controllerActor }) });
      await releaseClinch(controllerCombatant, heldCombatant);
      await controllerCombatant.setFlag("exalted2e", "pendingAction", {
        actionKey: "clinchRelease", label: game.i18n.localize("EX2E.ClinchRelease"),
        speed: 0, dvPenalty: 0, dvEffectId: null, abortable: false
      });
      break;
    }
  }
}

/**
 * Delete clinch flags from both combatants.
 * Safe to call even if one flag is already absent.
 */
export async function releaseClinch(controllerCombatant, heldCombatant) {
  await Promise.all([
    controllerCombatant.unsetFlag("exalted2e", "clinch").catch(() => {}),
    heldCombatant?.unsetFlag("exalted2e", "clinch").catch(() => {}),
    heldCombatant?.actor?.toggleStatusEffect("restrain", { active: false }).catch(() => {}),
  ]);
}
