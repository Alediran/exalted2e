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
