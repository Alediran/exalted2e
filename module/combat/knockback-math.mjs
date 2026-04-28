/**
 * Pure knockback / knockdown / stun math. No Foundry dependencies.
 *
 * Mechanics (Exalted 2e errata-aligned):
 *   - Knockback fires when post-soak damage dice (effectivePool) > Sta + Res.
 *     Distance is floor(dice / 3) yards.
 *   - Knockdown fires when knockback distance > Dex + Athletics.
 *     The defender then rolls max(Dex, Sta) + max(Ath, Res) vs difficulty 2.
 *   - Stun fires when inflicted damage (HLs taken) > Stamina.
 *     Effect is a -2 external penalty until the defender's next DV refresh.
 *
 * All thresholds use strict inequality — RAW: must exceed, not match.
 */

/**
 * Knockback trigger + distance.
 * @param {object} input
 * @param {number} input.effectivePool  Post-soak damage dice count.
 * @param {number} input.sta            Target's Stamina.
 * @param {number} input.res            Target's Resistance ability.
 * @returns {{fired: boolean, distance: number}}
 */
export function computeKnockback({ effectivePool, sta, res } = {}) {
  const threshold = Math.max(0, Number(sta) || 0) + Math.max(0, Number(res) || 0);
  const dice      = Math.max(0, Number(effectivePool) || 0);
  const fired     = dice > threshold;
  const distance  = fired ? Math.floor(dice / 3) : 0;
  return { fired, distance };
}

/**
 * Whether the knockback distance forces a knockdown resist roll.
 * @param {object} input
 * @param {number} input.distance  Knockback distance in yards.
 * @param {number} input.dex       Target's Dexterity.
 * @param {number} input.ath       Target's Athletics ability.
 * @returns {{triggered: boolean, mobility: number}}
 */
export function computeKnockdownTrigger({ distance, dex, ath } = {}) {
  const mobility  = (Number(dex) || 0) + (Number(ath) || 0);
  const dist      = Math.max(0, Number(distance) || 0);
  const triggered = dist > mobility;
  return { triggered, mobility };
}

/**
 * Stun trigger.
 * @param {object} input
 * @param {number} input.inflictedDamage  Health levels actually inflicted.
 * @param {number} input.sta              Target's Stamina.
 * @returns {{triggered: boolean, threshold: number}}
 */
export function computeStunTrigger({ inflictedDamage, sta } = {}) {
  const threshold = Math.max(0, Number(sta) || 0);
  const inflicted = Math.max(0, Number(inflictedDamage) || 0);
  const triggered = inflicted > threshold;
  return { triggered, threshold };
}
