/**
 * Returns true if the actor has an active hazard immunity AE that covers the given hazard type.
 * @param {ExaltedActor} actor
 * @param {boolean} isSupernatural  Whether the hazard is supernatural
 * @returns {boolean}
 */
export function checkHazardImmunity(actor, isSupernatural) {
  const immunityAEs = actor.effects.filter(e => !e.disabled && e.flags?.exalted2e?.hazardImmunity);
  if (!immunityAEs.length) return false;
  // Only count AEs whose enhancesCharmUid base charm is currently active (or has no gate).
  const activeImmunities = immunityAEs.filter(ae => {
    const uid = ae.flags.exalted2e.enhancesCharmUid;
    if (!uid) return true;
    return actor.items.some(i => i.type === "charm" && i.system?.charmUid === uid && i.system?.active);
  });
  const hasSupernaturalImmunity = activeImmunities.some(e => e.flags.exalted2e.hazardImmunity === "supernatural");
  const hasNaturalImmunity      = activeImmunities.some(e => e.flags.exalted2e.hazardImmunity === "natural");
  return hasSupernaturalImmunity || (hasNaturalImmunity && !isSupernatural);
}
