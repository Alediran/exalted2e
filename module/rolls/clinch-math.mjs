/**
 * Pure helpers — no Foundry API dependencies; importable by unit tests.
 */

/**
 * Determine control roll outcome.
 * Attacker wins on tie (≥).
 */
export function clinchOutcome(attackerSuccesses, defenderSuccesses) {
  const attackerWins  = attackerSuccesses >= defenderSuccesses;
  const controlMargin = attackerWins ? attackerSuccesses - defenderSuccesses : 0;
  return { attackerWins, controlMargin };
}

/** Crush and Throw both deal Str + 2 dice of damage. */
export function clinchDamageDice(strength) {
  return Math.max(0, (strength ?? 0) + 2);
}

/**
 * Compute the initiative value the held combatant is pushed to
 * so they don't become active before the controller's next sub-action.
 */
export function clinchFreezeInitiative(controllerInitiative, speed = 3) {
  return (controllerInitiative ?? 0) + speed;
}
