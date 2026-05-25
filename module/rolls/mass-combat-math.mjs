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

export function computeUnitParryDV(commanderParryDV, closeCombatRating) {
  return Math.floor(commanderParryDV + closeCombatRating / 2);
}

// Minimum damage equals the attacking unit's Magnitude (Exalted 2e rules).
export function computeHeroNetDamage(dmgSuccesses, soak, unitMagnitude) {
  return Math.max(unitMagnitude, dmgSuccesses - soak);
}

export function computeChargePool(charisma, war) {
  return Math.max(1, (charisma ?? 0) + (war ?? 0));
}

export function computeChargeDifficulty(magnitude, drill) {
  return Math.max(1, magnitude - drill);
}

export function computeChangeFormationDifficulty(magnitude, drill, { engaged, attackedSinceLastAction }) {
  const base = Math.max(1, magnitude - drill);
  const mod = engaged ? 2 : (attackedSinceLastAction ? 1 : 0); // engaged subsumes attacked; modifiers don't stack
  return base + mod;
}

export function computeDisengagePool(wits, war, drill, magnitude) {
  return Math.max(1, (wits ?? 0) + (war ?? 0) + (drill ?? 0) - (magnitude ?? 0));
}

export function computeDisengageDifficulty(opposingDrill) {
  return (opposingDrill ?? 0) + 3;
}

export function computeSplitParentMagnitude(parentMag, newUnitMag) {
  return Math.max(0, parentMag - Math.max(1, newUnitMag));
}

export function computeMergeMagnitude(mag1, mag2) {
  const larger = Math.max(mag1, mag2);
  const smaller = Math.min(mag1, mag2);
  return Math.min(5, larger + Math.ceil(smaller / 2));
}

export function computeRallyPool(charisma, war, performance) {
  return Math.max(1, (charisma ?? 0) + Math.max((war ?? 0), (performance ?? 0)));
}

export function computeSecondWindEndurance(currentEndurance, drill, magnitude) {
  const restored = Math.max(1, drill ?? 0);
  return Math.min(magnitude ?? 1, currentEndurance + restored);
}

export function computeExhaustionDifficulty(armorFatigue, morale, engaged, charged) {
  let diff = Math.max(1, armorFatigue ?? 0);
  if (morale >= 5)      diff -= 2;
  else if (morale >= 3) diff -= 1;
  if (engaged)           diff += 2;
  if (charged)           diff += 1;
  return Math.max(1, diff);
}

export function applyRelayBonus(commanderPool, relayCommandPool) {
  return Math.max(commanderPool ?? 0, relayCommandPool ?? 0);
}
