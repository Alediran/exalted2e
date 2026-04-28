import { register } from "./cleanup.mjs";

/**
 * Create a Combat with the given actors as combatants on the active scene.
 * Returns the Combat; auto-registered for cleanup. Combatants are created
 * after the Combat exists (Foundry's preferred shape).
 *
 * Each actor must already have a placed token on the active scene — pass
 * actors that came from `createTempCharacter` followed by `placeToken`.
 *
 * IMPORTANT: callers must roll Join Battle (e.g., `await combat.rollJoinBattle()`)
 * before expecting `combat.combatant` to populate. `combat.startCombat()` seats
 * the wheel at tick 0 but does NOT auto-roll JB; combatants without JB rolled
 * have `initiative === null` and won't appear as the current combatant.
 */
export async function startTempCombat(actors) {
  const combat = await Combat.create({ scene: game.scenes.active?.id });
  register(combat);

  const combatants = actors.map(a => ({
    actorId: a.id,
    tokenId: a.getActiveTokens()[0]?.id ?? null
  }));
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await combat.startCombat();
  return combat;
}

/**
 * Advance the wheel until `combat.combatant?.actorId === actor.id`.
 *
 * NOT IMPLEMENTED YET — the follow-up combat-tracker test session must fill
 * this in against ExaltedCombat's tick-based wheel API
 * (`advanceCurrentByTicks(speed)` to commit the current combatant + a pass
 * action, then `advanceWheel()` to bump the tick) rather than vanilla
 * Foundry's `nextTurn()`. The vanilla call doesn't understand this project's
 * tick-based initiative and would desynchronise the wheel from the sort
 * order. See `module/documents/combat.mjs` for the wheel API.
 */
export async function advanceToActor(combat, actor, { maxIters = 50 } = {}) {
  void combat; void actor; void maxIters;
  throw new Error(
    "advanceToActor is not yet implemented for ExaltedCombat's tick-based wheel. " +
    "Implement in the follow-up combat-tracker test session using " +
    "advanceCurrentByTicks() + advanceWheel() from module/documents/combat.mjs."
  );
}
