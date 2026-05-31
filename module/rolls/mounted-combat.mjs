/**
 * Pure helpers — no Foundry API; importable by unit tests.
 */

/**
 * Apply the Ride cap: when mounted, no combat ability may exceed the
 * rider's Ride rating. Returns the lower of ability and ride.
 * @param {number} abilVal — base ability value
 * @param {number} rideVal — Ride ability value
 * @returns {number}
 */
export function computeRideCappedAbility(abilVal, rideVal) {
  return Math.min(abilVal ?? 0, rideVal ?? 0);
}
