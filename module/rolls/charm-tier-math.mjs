import { evaluateCharmFormula } from "../documents/item.mjs";

const EFFECT_SECTIONS = [
  "attackBonus", "dvBonus", "targetPenalty", "moteRecovery",
  "soakBonus", "statBoost", "healthGrant", "rateBonus", "speedModifier"
];

/**
 * Returns true when the tier's gate conditions are satisfied.
 * A tier with NO gate conditions (all zero/empty) never fires automatically.
 */
export function passesGate(tier, actor, charm) {
  const checks = [];
  if ((tier.essenceRequired ?? 0) > 0)
    checks.push((actor.system.essence?.value ?? 0) >= tier.essenceRequired);
  const charmKey = charm.system?.ability ?? "";
  if ((tier.abilityGate?.min ?? 0) > 0 && charmKey)
    checks.push((actor.system.abilities?.[charmKey]?.value ?? 0) >= tier.abilityGate.min);
  if ((tier.attributeGate?.min ?? 0) > 0 && charmKey)
    checks.push((actor.system.attributes?.[charmKey]?.value ?? 0) >= tier.attributeGate.min);
  if (!tier.autoApply)
    checks.push((charm.system.purchaseLevel ?? 1) >= (tier.purchaseLevelRequired ?? 2));

  if (checks.length === 0) return false;
  return tier.gateRequiresAll ? checks.every(Boolean) : checks.some(Boolean);
}

/** Returns { passive: Tier[], active: Tier[] } of qualifying tiers. */
export function _qualifyingTiers(actor, charm) {
  if (!actor || !(charm.system?.upgradeTiers?.length)) return { passive: [], active: [] };
  // Use toObject() to get plain objects — DataModel Proxy iterators can omit nested
  // sub-schema fields (e.g. attackBonus.accuracyDice) when enumerated via deepClone.
  const srcTiers = charm.system.toObject?.()?.upgradeTiers ?? charm.system.upgradeTiers;
  const qualifying = srcTiers.filter(t => passesGate(t, actor, charm));
  return {
    passive: qualifying.filter(t =>  t.passive),
    active:  qualifying.filter(t => !t.passive),
  };
}

/** Merge one tier's section into the base section (in-place). */
function _mergeSection(key, base, tier, rollData) {
  if (!tier?.enabled) return;
  base.enabled = true;
  const ev = f => evaluateCharmFormula(f, rollData, 0) | 0;
  switch (key) {
    case "attackBonus":
      base.accuracyDice       = String(ev(base.accuracyDice)       + ev(tier.accuracyDice));
      base.accuracySuccesses  = String(ev(base.accuracySuccesses)  + ev(tier.accuracySuccesses));
      base.damageDice         = String(ev(base.damageDice)         + ev(tier.damageDice));
      base.postSoakDamageDice = String(ev(base.postSoakDamageDice) + ev(tier.postSoakDamageDice));
      base.soakPiercing       = (base.soakPiercing ?? 0) + (tier.soakPiercing ?? 0);
      base.damageDicePerMote       = base.damageDicePerMote       || tier.damageDicePerMote;
      base.postSoakDicePerMote     = base.postSoakDicePerMote     || tier.postSoakDicePerMote;
      base.ignoreAccuracyPenalties = base.ignoreAccuracyPenalties || tier.ignoreAccuracyPenalties;
      base.ignoreRangeBand         = base.ignoreRangeBand         || tier.ignoreRangeBand;
      base.ignoresArmor            = base.ignoresArmor            || tier.ignoresArmor;
      break;
    case "dvBonus":
      base.dodgeBonus = (base.dodgeBonus ?? 0) + (tier.dodgeBonus ?? 0);
      base.parryBonus = (base.parryBonus ?? 0) + (tier.parryBonus ?? 0);
      if (tier.dodgeBonusFormula) base.dodgeBonusFormula = tier.dodgeBonusFormula;
      if (tier.parryBonusFormula) base.parryBonusFormula = tier.parryBonusFormula;
      base.ignoreAllPenalties = base.ignoreAllPenalties || tier.ignoreAllPenalties;
      base.ignorePenaltyTypes = [...(base.ignorePenaltyTypes ?? []), ...(tier.ignorePenaltyTypes ?? [])];
      break;
    case "soakBonus":
      base.bashing     = (base.bashing     ?? 0) + (tier.bashing     ?? 0);
      base.lethal      = (base.lethal      ?? 0) + (tier.lethal      ?? 0);
      base.aggravated  = (base.aggravated  ?? 0) + (tier.aggravated  ?? 0);
      base.hardnessAdd = (base.hardnessAdd ?? 0) + (tier.hardnessAdd ?? 0);
      if ((tier.hardnessSetTo ?? 0) > 0)
        base.hardnessSetTo = Math.max(base.hardnessSetTo ?? 0, tier.hardnessSetTo);
      if (tier.bashingFormula)    base.bashingFormula    = tier.bashingFormula;
      if (tier.lethalFormula)     base.lethalFormula     = tier.lethalFormula;
      if (tier.aggravatedFormula) base.aggravatedFormula = tier.aggravatedFormula;
      break;
    case "statBoost":
      base.changes = [...(base.changes ?? []), ...(tier.changes ?? [])];
      break;
    case "healthGrant":
      base.options = [...(base.options ?? []), ...(tier.options ?? [])];
      break;
    case "rateBonus":
      base.formula = String(ev(base.formula) + ev(tier.formula));
      break;
    case "speedModifier":
      base.delta   = (base.delta   ?? 0) + (tier.delta   ?? 0);
      base.minimum = Math.max(base.minimum ?? 3, tier.minimum ?? 3);
      if (tier.deltaFormula) base.deltaFormula = tier.deltaFormula;
      break;
    case "moteRecovery":
      // Last-writer-wins: tiers don't stack recovery triggers; the tier's event/action/formula replaces the base.
      if (tier.event)   base.event   = tier.event;
      if (tier.action)  base.action  = tier.action;
      if (tier.formula) base.formula = tier.formula;
      if (tier.source)  base.source  = tier.source;
      break;
    case "targetPenalty":
      if ((tier.amount ?? 0) < (base.amount ?? 0)) base.amount = tier.amount;
      if (tier.amountFormula) base.amountFormula = tier.amountFormula;
      if (tier.scope && tier.scope !== "all") base.scope = tier.scope;
      break;
  }
}

/**
 * Produce a deep clone of baseSystem with qualifying tiers merged in.
 * @param {object} baseSystem — charm.system (plain data object, not a proxy)
 * @param {object[]} passiveTiers
 * @param {object|null} activeTier — the selected active tier, or null
 * @param {object} [rollData] — actor.getRollData() for formula evaluation
 * @returns {object} merged system clone
 */
export function mergeEffects(baseSystem, passiveTiers, activeTier, rollData = {}) {
  const merged = foundry.utils.deepClone(baseSystem);

  if (activeTier !== null) {
    for (const key of EFFECT_SECTIONS) {
      if (merged[key]?.modeExclusive) {
        const section = merged[key];
        for (const field of Object.keys(section)) {
          if (field === "modeExclusive") continue;
          if (field === "enabled") { section.enabled = false; continue; }
          if (typeof section[field] === "number")  section[field] = 0;
          if (typeof section[field] === "boolean") section[field] = false;
          if (typeof section[field] === "string")  section[field] = "";
          if (Array.isArray(section[field]))       section[field] = [];
        }
      }
    }
  }

  for (const tier of passiveTiers) {
    for (const key of EFFECT_SECTIONS) {
      if (tier[key]?.enabled) _mergeSection(key, merged[key], tier[key], rollData);
    }
  }

  if (activeTier !== null) {
    for (const key of EFFECT_SECTIONS) {
      if (activeTier[key]?.enabled) _mergeSection(key, merged[key], activeTier[key], rollData);
    }
  }

  return merged;
}
