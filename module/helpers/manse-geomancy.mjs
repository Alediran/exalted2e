/**
 * Compute the full Creation Point state for a manse (Oadenol's Codex).
 * Pure — no Foundry globals — so it is unit-testable.
 *
 * @param {object} sys     The manse item's system data.
 * @param {number} rating  The manse rating (from its linked Background).
 * @param {object} [opts]
 * @param {number} [opts.linkedHearthstoneRating=0]  Rating of the currently linked hearthstone, for the cap check.
 * @returns {{
 *   base:number, drawbackPoints:number, sacrificePoints:number, dblPoints:number,
 *   total:number, used:number, remaining:number, over:boolean,
 *   effectiveHearthstone:number, hearthstoneTooHigh:boolean, violations:number[]
 * }}
 */
export function manseBudgetState(sys = {}, rating = 0, { linkedHearthstoneRating = 0 } = {}) {
  const r          = Math.max(0, parseInt(rating) || 0);
  const maintenance          = Math.max(0, Math.min(5, parseInt(sys.maintenance)          || 0));
  const fragility            = Math.max(0, Math.min(3, parseInt(sys.fragility)            || 0));
  const habitabilityReduction= Math.max(0, Math.min(3, parseInt(sys.habitabilityReduction)|| 0));
  const hearthstoneReduction = Math.max(0, parseInt(sys.hearthstoneReduction) || 0);

  const base            = r * 2;
  const drawbackPoints  = maintenance * 1 + fragility * 2 + habitabilityReduction * 1;
  const sacrificePoints = Math.min(hearthstoneReduction, r);
  const dblPoints       = (sys.designBeyondLimit && r === 5) ? 10 : 0;
  const total           = base + drawbackPoints + sacrificePoints + dblPoints;

  const powers    = Array.isArray(sys.powers) ? sys.powers : [];
  const used      = powers.reduce((sum, p) => sum + (parseInt(p?.cost) || 0), 0);
  const remaining = total - used;
  const over      = used > total;

  const effectiveHearthstone = Math.max(0, r - hearthstoneReduction);
  const hearthstoneTooHigh   = (parseInt(linkedHearthstoneRating) || 0) > effectiveHearthstone;

  const violations = [];
  powers.forEach((p, i) => {
    if ((parseInt(p?.cost) || 0) > r && !p?.isMaterial) violations.push(i);
  });

  return { base, drawbackPoints, sacrificePoints, dblPoints, total, used, remaining, over,
           effectiveHearthstone, hearthstoneTooHigh, violations };
}

/** Effective point cost after the aspect-favored discount (floored at 0). */
export function mansePowerEffectiveCost(power, manseAspect) {
  const cost = Math.max(0, parseInt(power?.cost) || 0);
  const favored = Array.isArray(power?.aspectFavored) && !!manseAspect
    && power.aspectFavored.includes(manseAspect);
  return Math.max(0, cost - (favored ? 1 : 0));
}

/**
 * Eligibility of a manse-power for a manse of the given rating/aspect.
 * @returns {{ eligible:boolean, effectiveCost:number, reasons:string[] }}
 */
export function mansePowerEligible(power, { rating = 0, manseAspect = "" } = {}) {
  const effectiveCost = mansePowerEffectiveCost(power, manseAspect);
  const reasons = [];
  const only = Array.isArray(power?.onlyAspect) ? power.onlyAspect : [];
  if (only.length && !only.includes(manseAspect)) reasons.push("only-aspect");
  if (effectiveCost > (parseInt(rating) || 0) && !power?.isMaterial) reasons.push("over-rating");
  return { eligible: reasons.length === 0, effectiveCost, reasons };
}

/** Ability prerequisite (Lore & Occult) and roll difficulty to design a power of this point cost. */
export function mansePowerDesignReqs(cost) {
  const c = Math.max(0, parseInt(cost) || 0);
  return { prereq: c + 2, difficulty: c + 3 };
}

/** True when the builder's Lore AND Occult both meet the (cost+2) prerequisite. */
export function canDesignPower({ lore = 0, occult = 0 } = {}, cost = 0) {
  const p = (parseInt(cost) || 0) + 2;
  return (parseInt(lore) || 0) >= p && (parseInt(occult) || 0) >= p;
}

/** Damage a manse can absorb before another Power Failure, scaled by Fragility. */
export function manseDamageThreshold(effectiveRating, fragility = 0) {
  const r = Math.max(0, parseInt(effectiveRating) || 0);
  const f = Math.max(0, Math.min(3, parseInt(fragility) || 0));
  if (f === 3) return 1;
  return r * ({ 0: 20, 1: 10, 2: 5 }[f]);
}

/**
 * Deterministically apply `amount` post-soak damage, cascading Power Failures.
 * Pure — no dice (the Essence-buildup die is rolled by the Foundry caller).
 * @returns {{ powerFailures:number, damage:number, failuresThisEvent:number, destroyed:boolean }}
 */
export function simulateManseDamage({ rating = 0, powerFailures = 0, damage = 0, fragility = 0 } = {}, amount = 0) {
  const r = Math.max(0, parseInt(rating) || 0);
  let pf  = Math.max(0, parseInt(powerFailures) || 0);
  let dmg = Math.max(0, (parseInt(damage) || 0) + (parseInt(amount) || 0));
  let failuresThisEvent = 0;
  while (true) {
    const eff = r - pf;
    if (eff <= 0) break;
    const th = manseDamageThreshold(eff, fragility);
    if (th <= 0 || dmg < th) break;
    dmg -= th;
    pf  += 1;
    failuresThisEvent += 1;
  }
  const destroyed = r > 0 && (r - pf) <= 0;
  return { powerFailures: pf, damage: dmg, failuresThisEvent, destroyed };
}

/** Soak reference string for a manse by Fragility (Oadenol's Codex). */
export function manseSoakRef(fragility) {
  return ({ 0: "12L/18B", 1: "6L/9B", 2: "—", 3: "—" })[Math.max(0, Math.min(3, parseInt(fragility) || 0))];
}
