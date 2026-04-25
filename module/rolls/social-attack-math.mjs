/**
 * Verify each attacker claim against the defender's actual data.
 * Returns a map of { claimKey: boolean } matching the input shape.
 *
 * Per-Virtue and per-Intimacy specificity is intentionally coarse —
 * "supportingVirtue" is a single boolean even though the defender may
 * have multiple Virtues at ≥3. Refining to per-Virtue addressing is
 * a 3c-or-later concern.
 */
export function verifyClaims(claims, defender) {
  const items       = defender.items ?? [];
  const virtues     = defender.system?.virtues ?? {};
  const motivation  = defender.system?.motivation ?? "";
  const isCharacter = defender.type === "character";
  return {
    supportingIntimacy:   !!claims.supportingIntimacy &&
      items.some(i => i.type === "intimacy" && i.system?.positive === true),
    opposingIntimacy:     !!claims.opposingIntimacy &&
      items.some(i => i.type === "intimacy" && i.system?.positive === false),
    supportingVirtue:     !!claims.supportingVirtue &&
      isCharacter && Object.values(virtues).some(v => (v?.value ?? 0) >= 3),
    opposingVirtue:       !!claims.opposingVirtue &&
      isCharacter && Object.values(virtues).some(v => (v?.value ?? 0) >= 3),
    supportingMotivation: !!claims.supportingMotivation && isCharacter && !!motivation,
    opposingMotivation:   !!claims.opposingMotivation   && isCharacter && !!motivation,
    immediateThreat:      !!claims.immediateThreat
  };
}

/**
 * Net-sum stacking: best supporting modifier (most negative) +
 * best opposing modifier (most positive). They can cancel.
 */
export function computeStackingMod(verified) {
  const sup = [];
  if (verified.supportingIntimacy)   sup.push(-1);
  if (verified.supportingVirtue)     sup.push(-2);
  if (verified.supportingMotivation) sup.push(-3);

  const opp = [];
  if (verified.opposingIntimacy)   opp.push(1);
  if (verified.opposingVirtue)     opp.push(2);
  if (verified.opposingMotivation) opp.push(3);
  if (verified.immediateThreat)    opp.push(3);

  return (sup.length ? Math.min(...sup) : 0) +
         (opp.length ? Math.max(...opp) : 0);
}

/**
 * MDV shift from Appearance delta. Higher attacker App lowers
 * defender MDV (negative shift). Clamped to ±3.
 */
export function computeMdvShiftFromApp(attacker, defender) {
  const att = attacker.system?.attributes?.appearance?.value ?? 0;
  const def = defender.system?.attributes?.appearance?.value ?? 0;
  const clamped = Math.max(-3, Math.min(3, att - def));
  return clamped === 0 ? 0 : -clamped;
}

/** Erode hits Parry MDV; build/compel hit Dodge MDV. */
export function computeBaseMDV(intent, defender) {
  return intent === "erode"
    ? (defender.currentParryMDV ?? 0)
    : (defender.currentDodgeMDV ?? 0);
}

/**
 * Pre-roll natural-influence cap check. Returns true when the cap is
 * reached (>= 2 WP drained this scene from this attacker via natural
 * persuasion). UMI attacks bypass this entirely.
 */
export function checkNaturalCap(defender, attackerId, isUnnatural) {
  if (isUnnatural) return false;
  const drained = defender.flags?.exalted2e?.socialScene?.[attackerId]?.wpDrainedNatural ?? 0;
  return drained >= 2;
}

/**
 * Defender's Willpower cost to resist. Threshold-success math
 * (1 WP per 3 successes over MDV) plus a UMI base cost (hardcoded 1
 * in 3a; charm-driven 1-5 lands with A3). Capped at 5 total. Returns
 * 0 on miss.
 */
export function computeWpToResist(rollSuccesses, effectiveMDV, isUnnatural, hit) {
  if (!hit) return 0;
  const netSuccesses   = Math.max(0, rollSuccesses - effectiveMDV);
  const baseResistCost = isUnnatural ? 1 : 0;
  return Math.min(5, baseResistCost + Math.floor(netSuccesses / 3));
}
