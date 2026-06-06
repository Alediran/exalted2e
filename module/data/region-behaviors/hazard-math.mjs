/**
 * Pure decision + pool math for the hazard-damage region behavior, extracted so
 * the branching is unit-testable without Foundry. The behavior injects its own
 * `evaluate` (evaluateCharmFormula) so this module stays Foundry-free.
 */

/**
 * Which hazard outcome applies to an actor entering / starting a turn in a hazard.
 * @returns {"immune"|"resist"|"apply"}
 */
export function hazardAction({ immune, hasPlayerOwner, resistDifficulty }) {
  if (immune) return "immune";
  if (hasPlayerOwner && resistDifficulty > 0) return "resist";
  return "apply";
}

/** Damage pool size, floored at 1. `evaluate(formula, rollData, fallback)`. */
export function hazardPoolSize(damagePool, rollData, evaluate) {
  return Math.max(1, evaluate(damagePool, rollData, 5));
}
