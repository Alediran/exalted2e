/**
 * Attack dice-pool assembly.
 *
 * Regular weapon: basePool = attrVal + abilVal + accuracy.
 *
 * Instant-charm attack: basePool = accuracy only. Canon charm descriptions
 * quote the WHOLE pool (not a modifier), so adding Dex + Ability on top
 * would double-count. Damage for instant-charm weapons is likewise the full
 * pre-threshold amount (Strength NOT auto-added) — that branch lives at the
 * weapon-damage read site, not here.
 *
 * Final pool = basePool + woundPenalty - flurryPenalty - internalPenalty + aimBonus,
 * floored at 0. woundPenalty is typically negative or zero from the actor's
 * derived `health.woundPenalty`.
 *
 * @param {object} args
 * @param {number} [args.attrVal=0] - Dexterity (or Strength for clinch)
 * @param {number} [args.abilVal=0] - Ability value (Melee / MA / Thrown / etc.)
 * @param {number} [args.accuracy=0] - Weapon/charm effective accuracy
 * @param {boolean} [args.isInstantCharm=false] - True if weapon is a transient instant-duration charm
 * @param {number} [args.woundPenalty=0] - Typically ≤ 0
 * @param {number} [args.flurryPenalty=0] - Dice penalty from declared flurry
 * @param {number} [args.internalPenalty=0] - Internal penalty (e.g., aborted-aim)
 * @param {number} [args.aimBonus=0] - Ticks-since-aim, cap +3 (from computeAimBonus)
 * @returns {number} Non-negative dice pool
 */
export function computeAttackPool({
  attrVal = 0, abilVal = 0, accuracy = 0,
  isInstantCharm = false,
  woundPenalty = 0, flurryPenalty = 0, internalPenalty = 0, aimBonus = 0,
  rangePenalty = 0
} = {}) {
  const basePool = isInstantCharm ? accuracy : (attrVal + abilVal + accuracy);
  return Math.max(0, basePool + woundPenalty - flurryPenalty - internalPenalty + aimBonus - rangePenalty);
}

/**
 * Aim bonus = elapsed ticks since aim started, capped at +3.
 *
 * Reads from the new multi-tick container shape: a `multiTickAction`
 * flag with `actionKey: "aim"` and `state.targetActorId`. Returns 0
 * when the flag is missing, has a different actionKey, or targets a
 * different actor than the current attack.
 *
 * @param {object} args
 * @param {object | null} args.multiTickAction - `flags.exalted2e.multiTickAction` from the attacker's combatant
 * @param {string | null} args.targetActorId   - The current attack's target actor id
 * @param {number} [args.currentTick=0]        - `game.combat.currentTick`
 * @returns {number} Bonus dice in [0, 3]
 */
export function computeAimBonus({ multiTickAction, targetActorId, currentTick = 0 } = {}) {
  if (!multiTickAction)                                   return 0;
  if (multiTickAction.actionKey !== "aim")                return 0;
  if (multiTickAction.state?.targetActorId !== targetActorId) return 0;
  const elapsed = Math.max(0, (currentTick ?? 0) - (multiTickAction.startTick ?? 0));
  return Math.min(3, elapsed);
}

/**
 * Holy-vs-CoD damage-type upgrade.
 *
 * A charm activated for this attack carrying the Holy keyword upgrades
 * damage to aggravated against a target flagged as a Creature of Darkness —
 * bashing and lethal alike. Weapons never carry Holy in 2e; only Charms do.
 *
 * Aggravated also bypasses Hardness — that's the caller's responsibility to
 * honor; this helper just reports whether the upgrade fires.
 *
 * @param {object} args
 * @param {boolean} args.isHolyAttack - Any activated charm carried the Holy keyword
 * @param {boolean} args.targetIsCoD  - Target has an enabled CoD-flagged ActiveEffect
 * @param {"bashing"|"lethal"|"aggravated"} args.baseDamageType - Weapon/mode base damage type
 * @returns {{finalDamageType: string, holyUpgraded: boolean}}
 */
export function computeHolyUpgrade({ isHolyAttack, targetIsCoD, baseDamageType }) {
  if (isHolyAttack && targetIsCoD) {
    return { finalDamageType: "aggravated", holyUpgraded: true };
  }
  return { finalDamageType: baseDamageType, holyUpgraded: false };
}

/**
 * Compute the full template data object for the attack-result chat card.
 *
 * When `attack.defense` is NOT present (defense-pending state), returns
 * `{ ...attack, defenseChosen: false }` — the pre-defense card shape.
 *
 * When `attack.defense` IS present, computes:
 *   - threshold, hit, perfectDefense, targetDV, rawDamagePool
 *   - hardnessStops
 *   - defenseLabelKey ("EX2E.DodgeDV" / "EX2E.ParryDV" / "EX2E.TargetDV")
 *   - showAttackerReroll / showDefenderReroll / showResolution (steps 4/5)
 *   - showCounterattack / showRollDamage (step 9)
 *
 * Perfect dodge / parry charms short-circuit hit to false and skip every
 * downstream step (reroll, counterattack, damage).
 *
 * @param {object} attack - Attack snapshot stored in flags.exalted2e.attack
 * @returns {object} Template data
 */
export function computeAttackOutcome(attack) {
  const data = { ...attack, defenseChosen: !!attack.defense };
  if (!attack.defense) return data;

  const perfectSoak    = !!attack.perfectDefenseCharm && attack.perfectDefenseType === "soak";
  const perfectDefense = !!attack.perfectDefenseCharm && !perfectSoak;
  const threshold = Math.max(0, attack.successes - attack.defense.dv);
  const hit       = !perfectDefense && threshold > 0;
  data.threshold      = threshold;
  data.hit            = hit;
  data.perfectDefense = perfectDefense;
  data.perfectSoak    = perfectSoak;
  data.targetDV       = attack.defense.dv;
  data.rawDamagePool  = (hit && !perfectSoak)
    ? threshold + attack.weaponDamage + (attack.addStrength ? attack.strengthValue : 0)
    : 0;
  data.hardnessStops = hit && !perfectSoak && (attack.targetHardness ?? 0) > data.rawDamagePool;
  data.defenseLabelKey = {
    dodge:  "EX2E.DodgeDV",
    parry:  "EX2E.ParryDV",
    manual: "EX2E.TargetDV"
  }[attack.defense.type] ?? "EX2E.TargetDV";

  // Step 4 / 5 gating (Third Excellency reroll)
  const attackerEligible = !perfectDefense
    && !!attack.attackerHasThirdExc
    && (attack.firstExcDice       ?? 0) === 0
    && (attack.secondExcSuccesses ?? 0) === 0;
  const defenderEligible = !perfectDefense
    && !!attack.defenderHasThirdExc
    && (attack.defenderFirstExcDice ?? 0) === 0
    && (attack.defenderSecondExcSucc ?? 0) === 0;

  const step4Complete = !attackerEligible
    || !!attack.thirdExcUsedByAttacker
    || !!attack.step4Passed;
  const step5Complete = step4Complete && (
    !defenderEligible
    || !!attack.thirdExcUsedByDefender
    || !!attack.step5Passed
  );

  data.showAttackerReroll = !step4Complete;
  data.showDefenderReroll = step4Complete && !step5Complete;
  data.showResolution     = step4Complete && step5Complete;

  // Step 9 counterattack
  const step9Applicable = step5Complete
    && !perfectDefense
    && (data.hit ?? false)
    && !data.hardnessStops
    && !attack.isCounterattack
    && !!attack.defenderHasCounterattack;
  const step9Complete = !step9Applicable
    || !!attack.counterattackTriggered
    || !!attack.step9Passed;
  data.showCounterattack = step9Applicable && !step9Complete;
  data.showRollDamage    = (data.hit ?? false) && !data.hardnessStops && !data.perfectSoak && step9Complete;

  return data;
}
