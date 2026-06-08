/**
 * combat-flow.mjs – Combat lifecycle / cleanup hooks.
 *
 * Registered at top-level from the entry point via registerCombatFlowHooks().
 * Covers: flux-damage ticks, multi-tick cleanup, clinch cleanup, social-scene
 * cleanup, and unit-combatant initialisation on createCombatant.
 */

import { EX2E }          from "../config.mjs";
import { _applyFluxDamage } from "./actor-lifecycle.mjs";
import { JoinWarDialog } from "../apps/join-war-dialog.mjs";

export function registerCombatFlowHooks() {

  Hooks.on("updateCombat", async (combat, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    const newTick = changes?.flags?.exalted2e?.currentTick;
    if (newTick == null) return;

    for (const combatant of combat.combatants) {
      const nextFireTick = combatant.flags?.exalted2e?.fluxNextFireTick;
      if (nextFireTick == null) continue;
      if (newTick < nextFireTick) continue;

      const actor = combatant.actor;
      if (!actor) continue;
      const tier = actor.system.anima;
      if (!EX2E.DB_FLUX[tier]) continue;

      await _applyFluxDamage(actor, tier);
      const interval = EX2E.DB_FLUX[tier].interval;
      await combatant.setFlag("exalted2e", "fluxNextFireTick", newTick + interval);
    }
  });

  // Clear multi-tick action flags whenever a combat is deleted (covers the
  // "End Encounter" → delete path as well as out-of-band deletions).
  Hooks.on("deleteCombat", async (combat) => {
    if (!combat?.combatants) return;
    const { clearAllMultiTickActions } = await import("../combat/multi-tick.mjs");
    // skipFlagUpdate: combatants are embedded in the combat being deleted,
    // so updating their flags would fail with "does not exist in combats".
    await clearAllMultiTickActions(combat, { skipFlagUpdate: true });
  });

  // Clear active clinch flags when combat ends to prevent held actors from
  // remaining in a held state after combat concludes.
  Hooks.on("deleteCombat", async (combat) => {
    if (!combat?.combatants) return;
    const { releaseClinch } = await import("../rolls/clinch.mjs");
    const controllers = combat.combatants.filter(
      c => c.flags?.exalted2e?.clinch?.role === "controller"
    );
    for (const controller of controllers) {
      const heldId        = controller.flags.exalted2e.clinch.heldCombatantId;
      const heldCombatant = combat.combatants.get(heldId);
      await releaseClinch(controller, heldCombatant);
    }
  });
  // mountedOn is stored on the actor flag and persists until explicitly dismounted.

  Hooks.on("deleteCombatant", async (combatant) => {
    const clinchFlag = combatant.flags?.exalted2e?.clinch;
    if (!clinchFlag) return;
    const combat = game.combats?.get(combatant.combatId);
    if (!combat?.combatants) return;
    const { releaseClinch } = await import("../rolls/clinch.mjs");
    if (clinchFlag.role === "controller") {
      const heldCombatant = combat.combatants.get(clinchFlag.heldCombatantId);
      await releaseClinch(combatant, heldCombatant);
    } else if (clinchFlag.role === "held") {
      const controllerCombatant = combat.combatants.get(clinchFlag.controllerCombatantId);
      await releaseClinch(controllerCombatant, combatant);
    }
  });

  // ── Auto-clear social-scene state on combat deletion ──────────────────────
  // `endCombat()` (overridden in ExaltedCombat) handles the normal "End
  // Combat" button flow. This hook covers the parallel path where a GM
  // deletes the combat document directly — both routes funnel through
  // the same `clearSocialScene` helper.
  Hooks.on("deleteCombat", async () => {
    const { clearSocialScene, clearIntimacyAblation } = await import("../ui/social-scene.mjs");
    await clearSocialScene({ silent: true });
    const { clearActorForms } = await import("../combat/form-charms.mjs");
    const { clearSceneCharms } = await import("../helpers/charm-deactivation.mjs");
    const sceneActors = canvas.scene?.tokens?.contents?.map(t => t.actor).filter(Boolean) ?? [];
    for (const actor of sceneActors) {
      await clearActorForms(actor);
      await clearSceneCharms(actor);
      await clearIntimacyAblation(actor);
    }
  });

  // ── Join War: open JoinWarDialog when a unit combatant is added ──────────────
  Hooks.on("createCombatant", (combatant) => {
    if (combatant.actor?.type !== "unit") return;
    const combat = combatant.parent;
    if (!combat) return;
    JoinWarDialog.prompt(combatant, combat).catch(err =>
      console.error("EX2E | JoinWarDialog failed:", err)
    );
  });

  // ── Unit: record starting Magnitude when a unit joins combat ─────────────────
  Hooks.on("createCombatant", async (combatant) => {
    const actor = combatant.actor;
    if (actor?.type !== "unit") return;
    await combatant.setFlag("exalted2e", "magnitudeAtJoinWar", actor.system.magnitude.value);
  });

}
