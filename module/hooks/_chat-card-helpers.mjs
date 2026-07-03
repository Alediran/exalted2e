/**
 * _chat-card-helpers.mjs — Pure computation helpers extracted from chat-cards.mjs.
 * No Foundry API calls; all functions take plain values and return plain values.
 */

/**
 * Determines the ability key used when looking up the defender's Excellency
 * for Step-2 social defense. Lunar and Alchemical exalts key on attributes;
 * all others key on abilities.
 *
 * @param {string} exaltType  e.g. "solar", "lunar", "alchemical"
 * @param {string} intent     "erode", "build", or "compel"
 * @returns {string}          ability/attribute key for Excellency lookup
 */
export function computeExcellencyKey(exaltType, intent) {
  const isAttrBased = exaltType === "lunar" || exaltType === "alchemical";
  return isAttrBased
    ? (intent === "erode" ? "manipulation" : "stamina")
    : (intent === "erode" ? "presence"     : "integrity");
}

/**
 * Returns the total mote cost for the defender's Step-2 Excellency spend.
 * First Excellency dice cost 1m each; Second Excellency successes cost 2m each.
 *
 * @param {number} firstExcDice
 * @param {number} secondExcSucc
 * @returns {number}
 */
export function computeStep2MoteCost(firstExcDice, secondExcSucc) {
  return (firstExcDice ?? 0) + (secondExcSucc ?? 0) * 2;
}

/**
 * Returns a resolution stub when a Step-2 social-defense outcome auto-resolves
 * (Perfect Mental Defense or motes-resist keyword), or null when the card still
 * needs manual player resolution (accept / break / refuse / erode intimacy).
 *
 * @param {{ perfectDefense: boolean, motesResistApplied: boolean, hit: boolean }} resolved
 * @returns {{ outcome: string, wpSpentByDefender: number, erodedIntimacyId: null,
 *             erodedIntimacyStrengthBefore: null, erodedIntimacyStrengthAfter: null,
 *             erodedIntimacyName: null } | null}
 */
export function buildStep2AutoResolution(resolved) {
  if (resolved.perfectDefense) {
    return {
      outcome:                      "perfect-defended",
      wpSpentByDefender:            0,
      erodedIntimacyId:             null,
      erodedIntimacyStrengthBefore: null,
      erodedIntimacyStrengthAfter:  null,
      erodedIntimacyName:           null,
    };
  }
  if (resolved.motesResistApplied && resolved.hit) {
    return {
      outcome:                      "resisted-via-motes",
      wpSpentByDefender:            0,
      erodedIntimacyId:             null,
      erodedIntimacyStrengthBefore: null,
      erodedIntimacyStrengthAfter:  null,
      erodedIntimacyName:           null,
    };
  }
  return null;
}

/**
 * Builds the flag-update payload that stamps Step-2 resolution onto the
 * social-attack card's ChatMessage flags. Pure — caller is responsible for
 * calling message.update() with the returned object.
 *
 * @param {object} _record            socialAttack record (unused; kept for call-site symmetry)
 * @param {object} dialogResult       Step2SocialDefenseDialog result
 * @param {object} resolved           resolveStep2() output
 * @param {string[]} activatedCharmIds charm ids activated by the defender
 * @param {object|null} defenderMoteSpend spendMotes() result or null
 * @returns {object}                  flat dot-path update object
 */
export function buildStep2FlagUpdates(_record, dialogResult, resolved, activatedCharmIds, defenderMoteSpend) {
  const resolution = buildStep2AutoResolution(resolved);
  const updates = {
    "flags.exalted2e.socialAttack.reversed":           false,
    "flags.exalted2e.socialAttack.step2Resolved":      true,
    "flags.exalted2e.socialAttack.step2Result":        dialogResult,
    "flags.exalted2e.socialAttack.defenderCharmIds":   activatedCharmIds,
    "flags.exalted2e.socialAttack.defenderMoteSpend":  defenderMoteSpend,
    "flags.exalted2e.socialAttack.effectiveMDV":       resolved.effectiveMDV,
    "flags.exalted2e.socialAttack.hit":                resolved.hit,
    "flags.exalted2e.socialAttack.wpToResist":         resolved.wpToResist,
    "flags.exalted2e.socialAttack.perfectDefense":     resolved.perfectDefense,
    "flags.exalted2e.socialAttack.motesResistApplied": resolved.motesResistApplied,
  };
  if (resolution) updates["flags.exalted2e.socialAttack.resolution"] = resolution;
  return updates;
}

/**
 * Returns whether an actor qualifies as sentient for mote-recovery effects
 * that require a sentient target (e.g. Ravening Mouth family charms).
 *
 * @param {string} type     actor.type
 * @param {string} npcType  actor.system.npcType (meaningful only for type="npc")
 * @returns {boolean}
 */
export function isActorSentient(type, npcType) {
  return type === "character" || (type === "npc" && npcType !== "beast");
}

/**
 * Returns the capped mote-recovery amount for a damage-dealt recovery effect.
 *
 * @param {{ perDamageLevel: boolean, maxRecovery?: number }} mr  moteRecovery config
 * @param {number} base     base recovery amount (from evaluateCharmFormula)
 * @param {number} rawDamage number of damage levels dealt
 * @returns {number}
 */
export function computeMoteRecoveryAmount(mr, base, rawDamage) {
  const amount = mr.perDamageLevel ? base * rawDamage : base;
  return Math.min(amount, mr.maxRecovery ?? 20);
}

/**
 * Returns a new targetEffect object with internalPenalty.amount scaled by
 * rawDamage. Used by perDamageLevel charm target effects. Does not mutate te.
 *
 * @param {object} te         targetEffect config
 * @param {number} rawDamage  damage levels dealt
 * @returns {object}
 */
export function scaleTargetEffectByDamage(te, rawDamage) {
  const scaledAmount = (te.internalPenalty?.amount ?? -1) * rawDamage;
  return {
    ...te,
    internalPenalty: { ...te.internalPenalty, amount: scaledAmount },
  };
}
