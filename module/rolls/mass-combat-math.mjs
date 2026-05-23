// commanderWarDice comes from commanderActor.system.commandWarDice (Command background rating)
export function computeAttackPool(commanderWarDice, drill) {
  return (commanderWarDice ?? 0) + (drill ?? 0);
}

export function computeNetDamage(mightSuccesses, enduranceSuccesses) {
  return Math.max(0, mightSuccesses - enduranceSuccesses);
}

export function computeRoutDifficulty(netDamage) {
  return netDamage;
}

export function computeIsRouted(magnitudeValue) {
  return magnitudeValue === 0;
}

export function computeMagnitudeAfterDamage(current, netDamage) {
  return Math.max(0, current - netDamage);
}

export function computeMagnitudeAfterRout(current, holds) {
  return holds ? current : Math.max(0, current - 1);
}

export function computeJoinWarPool(commanderActor, formation, magnitude) {
  if (!commanderActor) return 0;
  const sys = commanderActor.system;
  if (formation === "none") {
    return (sys.attributes?.wits?.value ?? 0) + (sys.abilities?.awareness?.value ?? 0);
  }
  const wits = sys.attributes?.wits?.value ?? 0;
  const war  = sys.abilities?.war?.value  ?? 0;
  return Math.max(0, wits + war - magnitude);
}

export function computeEffectiveCCR(closeCombatRating, warRating, formation) {
  if (formation === "close") {
    return Math.min(closeCombatRating * 2, warRating * 2);
  }
  return Math.min(closeCombatRating, warRating);
}

export function computeEffectiveRCR(rangedCombatRating, warRating) {
  return Math.min(rangedCombatRating, warRating);
}

export function computeMagnitudeDiffBonus(attackerMag, defenderMag) {
  return Math.min(3, Math.max(-3, attackerMag - defenderMag));
}

export function computeHealthTrackMagLoss(healthValue, healthMax, netDamage, currentMagnitude) {
  let health  = healthValue - netDamage;
  let magLost = 0;
  while (health <= 0 && currentMagnitude - magLost > 0) {
    health  += healthMax;
    magLost += 1;
  }
  return { newHealth: Math.max(0, health), magLost };
}

export function computeRoutPool(morale, magnitude, drill) {
  return Math.max(1, morale + (magnitude - drill));
}

export function computeFormationRoutMod(formation) {
  const mods = { close: -2, skirmish: 2, unordered: 2, relaxed: 0, none: 0 };
  return mods[formation] ?? 0;
}

export function computeRoutMagLoss(routDiff, routSuccesses) {
  return Math.max(0, routDiff - routSuccesses);
}
