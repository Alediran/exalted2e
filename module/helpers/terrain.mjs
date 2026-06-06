/**
 * Return terrain bonuses contributed by scene regions the attacker/defender
 * tokens currently occupy.
 *
 * @param {Actor|null} attackerActor
 * @param {Actor|null} defenderActor
 * @returns {{ attackerDiceBonus: number, defenderDVBonus: number, defenderSoakBonus: number }}
 */
export function getTerrainBonuses(attackerActor, defenderActor) {
  const zero = { attackerDiceBonus: 0, defenderDVBonus: 0, defenderSoakBonus: 0 };
  if (!canvas?.scene?.regions) return zero;

  const atkToken = attackerActor?.getActiveTokens?.()?.[0] ?? null;
  const defToken = defenderActor?.getActiveTokens?.()?.[0] ?? null;
  if (!atkToken && !defToken) return zero;

  let attackerDiceBonus = 0, defenderDVBonus = 0, defenderSoakBonus = 0;

  for (const regionDoc of canvas.scene.regions) {
    const behavior = [...regionDoc.behaviors].find(
      b => b.type === "terrainModifier" && !b.disabled
    );
    if (!behavior) continue;

    const { accuracyBonus = 0, dvBonus = 0, soakBonus = 0 } = behavior.system ?? {};

    if (atkToken?.document?.regions?.has(regionDoc)) {
      attackerDiceBonus += accuracyBonus;
    }
    if (defToken?.document?.regions?.has(regionDoc)) {
      defenderDVBonus   += dvBonus;
      defenderSoakBonus += soakBonus;
    }
  }

  return { attackerDiceBonus, defenderDVBonus, defenderSoakBonus };
}
