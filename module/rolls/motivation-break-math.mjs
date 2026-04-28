/**
 * Pure helpers for the Motivation-break long-form tracker.
 *
 * Per RAW Errata, breaking a Motivation requires a series of social attacks
 * over in-game days. Each successful hit triggers a defender choice:
 *   - Refuse: spend 1 permanent Willpower (reduces willpower.max by 1).
 *   - Break: Motivation flips to the attacker's stated target.
 *
 * State lives on the defender's actor flag, indexed by attackerId so multiple
 * attackers can independently campaign against the same defender.
 */

/**
 * Find the campaign one attacker is running against the given defender.
 * @param {object} defender - actor-shaped { flags: ... }
 * @param {string} attackerId
 * @returns {object|null}
 */
export function findCampaign(defender, attackerId) {
  return defender?.flags?.exalted2e?.motivationBreaks?.[attackerId] ?? null;
}

/**
 * Validate whether a new Motivation-break campaign can be started.
 *
 * Rejection reasons:
 *   - "npc-defender-unsupported" - NpcData lacks a motivation field
 *   - "self-attack" - attacker is the defender
 *   - "blank-target" - empty/whitespace targetMotivation
 *   - "target-equals-current" - targetMotivation matches defender's current motivation
 *   - "already-broken" - existing campaign for this (attacker, defender) pair has
 *                       status='broken' AND defender's motivation still equals the
 *                       broken target (i.e. nothing has reset since the break)
 *
 * @param {object} args
 * @param {object} args.attacker
 * @param {object} args.defender
 * @param {string} args.targetMotivation
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateNewCampaign({ attacker, defender, targetMotivation }) {
  if (defender?.type !== "character")          return { ok: false, reason: "npc-defender-unsupported" };
  if (attacker?.id && attacker.id === defender?.id) return { ok: false, reason: "self-attack" };
  const target = (targetMotivation ?? "").trim();
  if (!target) return { ok: false, reason: "blank-target" };
  const current = (defender?.system?.motivation ?? "").trim();
  if (target === current) return { ok: false, reason: "target-equals-current" };

  const existing = findCampaign(defender, attacker?.id);
  if (existing?.status === "broken" && existing?.targetMotivation === current) {
    return { ok: false, reason: "already-broken" };
  }

  return { ok: true };
}

/**
 * Apply a Refusal: defender spends 1 permanent WP. Decrement max (floor 0)
 * and clamp value to the new max.
 *
 * @param {number} currentMax
 * @param {number} currentValue
 * @returns {{max: number, value: number}}
 */
export function applyRefusalMath(currentMax, currentValue) {
  const newMax   = Math.max(0, (currentMax ?? 0) - 1);
  const newValue = Math.min(currentValue ?? 0, newMax);
  return { max: newMax, value: newValue };
}

/**
 * Apply a Refund (Reverse undoing a refusal): increment max by 1; restore
 * the original value delta within the new cap.
 *
 * @param {number} currentMax
 * @param {number} currentValue
 * @param {number} valueDelta - the negative delta the refusal applied (e.g. -1 or 0)
 * @returns {{max: number, value: number}}
 */
export function applyRefundMath(currentMax, currentValue, valueDelta) {
  const newMax   = (currentMax ?? 0) + 1;
  const restored = (currentValue ?? 0) - (valueDelta ?? 0);
  const newValue = Math.min(newMax, restored);
  return { max: newMax, value: newValue };
}
