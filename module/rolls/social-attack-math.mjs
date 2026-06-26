/**
 * Verify each attacker claim against the defender's actual data.
 * Returns { supportingIntimacy, opposingIntimacy, supportingVirtue, ... } booleans.
 * Intimacy claims take specific item IDs (supportingIntimacyId / opposingIntimacyId);
 * the item must exist on the defender and be of type "intimacy".
 */
export function verifyClaims(claims, defender) {
  const items       = defender.items ?? [];
  const virtues     = defender.system?.virtues ?? {};
  const motivation  = defender.system?.motivation ?? "";
  const isCharacter = defender.type === "character";
  return {
    supportingIntimacy:   !!claims.supportingIntimacyId &&
      items.some(i => i.id === claims.supportingIntimacyId && i.type === "intimacy"),
    opposingIntimacy:     !!claims.opposingIntimacyId &&
      items.some(i => i.id === claims.opposingIntimacyId && i.type === "intimacy"),
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

/**
 * Erode and break-motivation hit Parry MDV; build/compel hit Dodge MDV.
 * @param {string} intent
 * @param {object} defender
 * @param {"dodgelike"|"parrylike"|null} [resistanceOverride] - charm-sourced override
 */
export function computeBaseMDV(intent, defender, resistanceOverride = null) {
  const useParry = resistanceOverride === "parrylike"
    || (!resistanceOverride && (intent === "erode" || intent === "break-motivation"));
  return useParry
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
 * in 3a; charm-driven 1-5 lands with A3). Capped at 5 total.
 *
 * Returns 0 whenever `hit` is false — including the natural-cap-forced
 * miss case where `rollSuccesses > effectiveMDV` but the cap pushed
 * `hit` to false. The pre-refactor code stored a non-zero ledger value
 * in that branch, but the chat card and Spend-WP button both gate on
 * `hit`, so the value was never displayed or spent. Behavior the
 * player observes is unchanged.
 */
export function computeWpToResist(rollSuccesses, effectiveMDV, isUnnatural, hit, umiCostSum = 0) {
  if (!hit) return 0;
  const netSuccesses   = Math.max(0, rollSuccesses - effectiveMDV);
  const baseResistCost = isUnnatural ? (umiCostSum > 0 ? umiCostSum : 1) : 0;
  return Math.min(5, baseResistCost + Math.floor(netSuccesses / 3));
}

/**
 * Excellency caps for an MDV resistance roll. The cap mirrors only the
 * underlying MDV components an Excellency can actually augment — and which
 * ones those are depend on the exalt's keying. Per RAW (Core p.193) an
 * Excellency boost is capped by the (attribute) or (ability) it keys off
 * of; Willpower and Essence are never Excellency-eligible. Terrestrials
 * additionally fold the value of a single applicable specialty into their
 * ability cap.
 *
 *   Dodge MDV (build, compel) = (Willpower + Integrity + Essence) / 2
 *     Has Willpower + Integrity (ability) + Essence — NO attribute.
 *     - Ability-keyed exalts (Solar/Abyssal/Sidereal/Infernal):
 *       cap = integrity
 *     - Terrestrial: cap = integrity + best Integrity specialty.
 *     - Attribute-keyed exalts (Lunar/Alchemical):
 *       cap = 0 — the formula has no attribute to excel.
 *
 *   Parry MDV (erode) = (max(Cha, Man) + social ability) / 2
 *     - Ability-keyed: cap = max(Cha, Man) + presence (canonical default;
 *       performance / investigation / bureaucracy are all RAW-legal but
 *       presence is the fallback until the attack captures the chosen
 *       social ability). Terrestrials add the best presence specialty.
 *     - Attribute-keyed: cap = max(Cha, Man) — only the attribute portion
 *       is theirs to excel; the ability isn't.
 *
 * Specialty handling currently picks the highest-value specialty on the
 * relevant ability automatically. A future iteration will let the player
 * pick which specialty applies during a social-combat resolution and
 * refresh the cap accordingly.
 *
 * Returns `{ firstExcMax: 0, secondExcMax: 0 }` when defender has no system data.
 *
 * @param {"build"|"compel"|"erode"} intent
 * @param {object} defender - Foundry actor-shaped object with `.system` and `.type`
 * @returns {{firstExcMax: number, secondExcMax: number}}
 */
export function computeMdvExcellencyCaps(intent, defender) {
  const sys = defender?.system;
  if (!sys) return { firstExcMax: 0, secondExcMax: 0 };

  const exaltType     = sys.exaltType ?? "";
  const isAttrBased   = exaltType === "lunar" || exaltType === "alchemical";
  const isTerrestrial = exaltType === "terrestrial";

  // Best specialty value for an ability key — Terrestrials only fold this in.
  // Future: replace auto-max with a per-attack selector populated from the
  // ability's specialties array.
  const bestSpecialty = (abilityKey) => {
    const specs = sys.abilities?.[abilityKey]?.specialties ?? [];
    return specs.reduce((m, s) => Math.max(m, s?.value ?? 0), 0);
  };

  let cap = 0;
  if (intent === "erode") {
    // Parry MDV path — has both attribute and ability components.
    const cha = sys.attributes?.charisma?.value     ?? 0;
    const man = sys.attributes?.manipulation?.value ?? 0;
    const bestSocialAttr = Math.max(cha, man);
    if (isAttrBased) {
      cap = bestSocialAttr;                 // attribute-only — ability isn't theirs
    } else if (isTerrestrial) {
      // Terrestrial cap is ability-only + specialty (RAW). Attribute is NOT
      // included even though the underlying Parry MDV uses it. See project
      // memory `project_terrestrial_excellency_cap.md`.
      const presence = sys.abilities?.presence?.value ?? 0;
      cap = presence + bestSpecialty("presence");
    } else {
      const presence = sys.abilities?.presence?.value ?? 0;
      cap = bestSocialAttr + presence;
    }
  } else {
    // build, compel — Dodge MDV path. No attribute in the formula.
    if (isAttrBased) {
      cap = 0;                              // nothing to excel
    } else {
      const integrity = sys.abilities?.integrity?.value ?? 0;
      cap = integrity;                      // ability only — Willpower/Essence not excellency-eligible
      if (isTerrestrial) cap += bestSpecialty("integrity");
    }
  }

  return { firstExcMax: cap, secondExcMax: cap };
}

/**
 * Resolve a social-attack Step-2 phase: apply Excellency boosts to MDV,
 * detect perfect-defense / motes-resist keywords, recompute hit and
 * wpToResist.
 *
 * Inputs are flat primitives + an `activatedKeywords` Set so the function
 * stays pure and testable. Callers (the orchestrator in exalted2e.mjs)
 * gather charm activations elsewhere and pass the union of their keywords
 * here.
 *
 * Returns `{ effectiveMDV, hit, wpToResist, perfectDefense, motesResistApplied }`.
 *
 *   - perfectDefense ⇒ hit forced false, wpToResist forced 0
 *   - autoFailedByNaturalCap ⇒ hit forced false, wpToResist forced 0
 *   - motesResistApplied (UMI hit + the resist keyword) ⇒ wpToResist forced 0,
 *     hit unchanged. The 3a Limit-accrual block already gates on `wp > 0`,
 *     so a 0-WP resist skips Limit accrual without further branching.
 *
 * @param {object} args
 * @returns {{effectiveMDV: number, hit: boolean, wpToResist: number,
 *            perfectDefense: boolean, motesResistApplied: boolean}}
 */
export function resolveStep2({
  rollSuccesses,
  baseMDV,
  stackingMod,
  mdvShiftFromApp,
  halveMDV = false,         // M69: attacker charm halves defender base MDV (floor)
  isUnnatural,
  autoFailedByNaturalCap,
  firstExcDice = 0,
  secondExcSucc = 0,
  activatedKeywords = new Set(),
  umiCostSum = 0          // 3c-1: per-charm UMI cost sum
} = {}) {
  const perfectDefense     = activatedKeywords.has("Perfect Mental Defense");
  const motesResistApplied = !!isUnnatural && activatedKeywords.has("Resist Unnatural Mental Influence");

  const rawBase = (baseMDV ?? 0) + (stackingMod ?? 0) + (mdvShiftFromApp ?? 0);
  const adjustedBase = halveMDV ? Math.floor(rawBase / 2) : rawBase;
  const effectiveMDV = Math.max(0, adjustedBase + firstExcDice + secondExcSucc);

  const hit = !perfectDefense
           && !autoFailedByNaturalCap
           && (rollSuccesses ?? 0) > effectiveMDV;

  let wpToResist = 0;
  if (hit && !perfectDefense && !motesResistApplied) {
    wpToResist = computeWpToResist(rollSuccesses ?? 0, effectiveMDV, !!isUnnatural, hit, umiCostSum);
  }

  return { effectiveMDV, hit, wpToResist, perfectDefense, motesResistApplied };
}

/**
 * Aggregate keyword and UMI-cost data from a list of attacker charms picked
 * in the SocialAttackDialog. Treats undefined input as empty.
 *
 * - `keywords` is the deduped list of all keywords across the charms.
 * - `umiCostSum` is the sum of `umiCost` across charms whose keywords array
 *   contains "Unnatural Mental Influence". Charms without UMI contribute 0.
 * - `charmIds` preserves input order (callers use this for ledger
 *   traceability + Reverse).
 * - `sourceByKeyword[keyword]` is the id of the FIRST charm in input order
 *   that carries that keyword (used to attribute the marker AE to a single
 *   source charm name).
 *
 * @param {Array<object>} charms - Foundry item-shaped objects with .id, .name,
 *                                  .system.keywords[], .system.umiCost
 * @returns {{
 *   keywords:        string[],
 *   umiCostSum:      number,
 *   charmIds:        string[],
 *   sourceByKeyword: Record<string,string>
 * }}
 */
export function aggregateAttackerCharms(charms) {
  const list = Array.isArray(charms) ? charms : [];
  const keywords        = [];
  const seenKeyword     = new Set();
  const sourceByKeyword = {};
  const charmIds        = [];
  let   umiCostSum      = 0;

  for (const c of list) {
    if (!c || !c.id) continue;
    charmIds.push(c.id);
    const ks = c.system?.keywords ?? [];
    for (const k of ks) {
      if (!k) continue;
      if (!seenKeyword.has(k)) {
        seenKeyword.add(k);
        keywords.push(k);
        sourceByKeyword[k] = c.id;
      }
    }
    if (ks.includes("Unnatural Mental Influence")) {
      umiCostSum += Number(c.system?.umiCost) || 0;
    }
  }

  return { keywords, umiCostSum, charmIds, sourceByKeyword };
}

const SOCIAL_ABILITIES = ["presence", "performance", "investigation", "bureaucracy"];

/** Is a charm a social-ability supplemental / reflexive-step-1, keyed to `ability`, non-excellency? */
function isSocialAttackCharm(c, ability) {
  if (!c || c.system?.excellency) return false;
  if (c.system?.ability !== ability) return false;
  if (!SOCIAL_ABILITIES.includes(c.system?.ability)) return false;
  const ct = c.system?.charmType;
  if (ct === "supplemental") return true;
  if (ct === "reflexive" && (c.system?.steps ?? []).includes(1)) return true;
  return false;
}

/** Charm items eligible for the social-attack picker, keyed to the selected ability. */
export function filterSocialCharms(charms, ability) {
  return (charms ?? []).filter(c => isSocialAttackCharm(c, ability));
}

/**
 * For each combo, count its charmUids that resolve (via `charms`) to a
 * social-eligible charm; return `{ id, name, charmCount }` for combos with ≥1.
 */
export function buildSocialCombos(combos, charms, ability) {
  return (combos ?? []).map(combo => {
    const uids = combo.system?.charmUids ?? [];
    const charmCount = uids.filter(uid => {
      const charm = (charms ?? []).find(c => c.type === "charm" && c.system?.charmUid === uid);
      return isSocialAttackCharm(charm, ability);
    }).length;
    return charmCount > 0 ? { id: combo.id, name: combo.name, charmCount } : null;
  }).filter(Boolean);
}
