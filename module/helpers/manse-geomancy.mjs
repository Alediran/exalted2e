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
