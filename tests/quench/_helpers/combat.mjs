import { register, cleanupOnAfter } from "./cleanup.mjs";

/**
 * Create a Combat with the given actors as combatants on the active scene.
 * Returns the Combat; auto-registered for cleanup. Combatants are created
 * after the Combat exists (Foundry's preferred shape).
 *
 * Each actor must already have a placed token on the active scene — pass
 * actors that came from `createTempCharacter` followed by `placeToken`.
 *
 * `rollJoinBattle: true` (default) stubs each combatant's actor join-battle
 * pool to a deterministic value, then runs `combat.rollJoinBattle()` so
 * combatants seat at known initiatives. The stub overrides `ExaltedRoll.rollPool`
 * for the duration of the JB call only — restored via `cleanupOnAfter`.
 *
 * `jbStubsByActorId` (optional) is a map `{ [actorId]: successCount }`
 * pinning specific JB outcomes per actor. Actors not in the map default to
 * `successCount = 5` (one above zero, predictable). The lower-success actor
 * lands at a higher tick (later in the order).
 */
export async function startTempCombat(actors, {
  rollJoinBattle = true,
  jbStubsByActorId = null
} = {}) {
  const combat = await Combat.create({ scene: game.scenes.active?.id });
  register(combat);

  const combatants = actors.map(a => ({
    actorId: a.id,
    tokenId: a.getActiveTokens()[0]?.id ?? null
  }));
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await combat.startCombat();

  if (rollJoinBattle) {
    const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
    const orig = ExaltedRoll.rollPool;
    // Register the restoration BEFORE installing the stub, so a thrown
    // error during stub installation still queues the cleanup. The
    // closure captures `orig` either way.
    cleanupOnAfter(() => { ExaltedRoll.rollPool = orig; });
    let callIndex = 0;
    const idsInOrder = combat.combatants.map(c => c.actorId);
    ExaltedRoll.rollPool = async (actor, _opts) => {
      const successes = jbStubsByActorId?.[actor.id]
        ?? jbStubsByActorId?.[idsInOrder[callIndex]]
        ?? 5;
      callIndex++;
      return { successes, botch: false };
    };
    await combat.rollJoinBattle();
    // Foundry's Combat tracks `turn` across re-sorts to keep pointing at
    // the same combatant. startCombat (above) seated turn=0 on whoever
    // sorted first when initiatives were null (the alphabetic tiebreaker
    // winner — often NOT the JB winner). After rollJoinBattle's
    // re-sort, that tracking pulls turn forward to follow the original
    // combatant, leaving combat.combatant pointing at the wrong actor.
    // Reset to 0 so combat.combatant lands on the post-JB index 0 (the
    // actual JB winner).
    await combat.update({ turn: 0 });
  }
  return combat;
}

/**
 * Commit the current combatant's action by calling
 * `combat.advanceCurrentByTicks(speed)`. Pre-condition: the supplied
 * `actor` matches `combat.combatant?.actorId`. Throws otherwise so a
 * test that committed against the wrong actor fails loudly.
 */
export async function commitAction(combat, actor, speed) {
  if (combat.combatant?.actorId !== actor.id) {
    throw new Error(
      `commitAction: combat.combatant is '${combat.combatant?.actorId ?? "(none)"}'`
      + ` but actor is '${actor.id}' (${actor.name}). Use advanceToActor first.`
    );
  }
  await combat.advanceCurrentByTicks(speed);
}

/**
 * Bump the wheel by one tick. Thin wrapper for symmetry with commitAction.
 */
export async function advanceWheel(combat) {
  await combat.advanceWheel();
}

/**
 * Advance the wheel until `combat.combatant?.actorId === actor.id`.
 *
 * Loop pattern: if already on the actor → return. Otherwise commit the
 * current combatant with speed=1 (a fast pass action), then advance the
 * wheel, then re-check. Bounded by `maxIters` so a misconfigured combat
 * (actor not a combatant, etc.) fails loudly instead of looping forever.
 */
export async function advanceToActor(combat, actor, { maxIters = 50 } = {}) {
  for (let i = 0; i < maxIters; i++) {
    if (combat.combatant?.actorId === actor.id) return;

    // If the target is free (free-and-unacted at or before the current
    // tick) but `combat.combatant` is pointing at someone else (a
    // tied-but-alphabetically-earlier combatant), just snap `turn` onto
    // the target. Without this, the wheel-pass-action bump in
    // `advanceWheel` keeps the target locked in lockstep with the
    // alphabetic tiebreaker winner forever.
    const target = combat.combatants.find(c => c.actorId === actor.id);
    if (target) {
      const acted   = !!target.getFlag?.("exalted2e", "actedThisTick");
      const initOk  = Number.isFinite(target.initiative)
        && target.initiative <= combat.currentTick;
      if (!acted && initOk) {
        const idx = combat.turns.findIndex(c => c.id === target.id);
        if (idx >= 0) {
          await combat.update({ turn: idx });
          continue;
        }
      }
    }

    if (combat.combatant) {
      await combat.advanceCurrentByTicks(1);
    }
    await combat.advanceWheel();
  }
  throw new Error(
    `advanceToActor: combat never landed on actor '${actor.name}' (${actor.id})`
    + ` after ${maxIters} iterations.`
  );
}
