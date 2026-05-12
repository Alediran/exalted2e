/**
 * Returns true if the charm should contribute passive effects.
 * Permanent charms always contribute; other durations only contribute when
 * the charm is currently toggled on (system.active === true).
 * @param {object} item
 * @returns {boolean}
 */
export function isCharmPassivelyActive(item) {
  return item?.system?.duration  === "permanent"
    || item?.system?.charmType === "permanent"
    || item?.system?.active    === true;
}

/**
 * Sum health-grant bonus boxes from all enabled healthGrant charms.
 * @param {object[]} items — charm items (any iterable with .system.healthGrant)
 * @returns {{ zero: number, one: number, two: number }}
 */
export function computeHealthGrantBonus(items) {
  let zero = 0, one = 0, two = 0;
  for (const item of items) {
    const hg = item?.system?.healthGrant;
    if (!hg?.enabled) continue;
    const opts = hg.options ?? [];
    if (!opts.length) continue;
    // When multiple options exist, only the selected one applies. A single
    // option needs no selection — use it unconditionally.
    const idx = opts.length > 1
      ? Math.min(Math.max(0, hg.selectedOption ?? 0), opts.length - 1)
      : 0;
    const opt = opts[idx];
    if (!opt) continue;
    zero += opt.zero ?? 0;
    one  += opt.one  ?? 0;
    two  += opt.two  ?? 0;
  }
  return { zero, one, two };
}

/**
 * Sum mote-pool bonuses from all enabled motePoolBonus charms.
 * @param {object[]} items
 * @returns {{ personal: number, peripheral: number }}
 */
export function computeMotePoolBonus(items) {
  let personal = 0, peripheral = 0;
  for (const item of items) {
    const mpb = item?.system?.motePoolBonus;
    if (!mpb?.enabled) continue;
    if (mpb.pool === "personal")        personal   += mpb.amount ?? 0;
    else if (mpb.pool === "peripheral") peripheral += mpb.amount ?? 0;
  }
  return { personal, peripheral };
}


/**
 * Apply wound-reduction charm bonus to the base wound penalty.
 * bonusReduction is the integer accumulated in system.bonuses.woundPenaltyReduction
 * by charmSource AEs (formula="" → AE value 4, which covers the -4 max wound penalty).
 * @param {number} bonusReduction — ≥ 0
 * @param {number} baseWoundPenalty — typically ≤ 0
 * @returns {number} effective wound penalty
 */
export function computeWoundReduction(bonusReduction, baseWoundPenalty) {
  if (!bonusReduction) return baseWoundPenalty;
  return Math.min(0, baseWoundPenalty + bonusReduction);
}

/**
 * Aggregate DV bonus data from all enabled dvBonus charms.
 * @param {object[]} items
 * @returns {{ dodgeBonus:number, parryBonus:number, ignoreAllPenalties:boolean, ignorePenaltyTypes:string[] }}
 */
export function aggregateCharmDVBonus(items) {
  let dodgeBonus = 0, parryBonus = 0, ignoreAllPenalties = false;
  const typesSet = new Set();
  for (const item of items) {
    const dv = item?.system?.dvBonus;
    if (!dv?.enabled) continue;
    dodgeBonus += dv.dodgeBonus ?? 0;
    parryBonus += dv.parryBonus ?? 0;
    if (dv.ignoreAllPenalties) ignoreAllPenalties = true;
    for (const t of (dv.ignorePenaltyTypes ?? [])) typesSet.add(t);
  }
  return { dodgeBonus, parryBonus, ignoreAllPenalties, ignorePenaltyTypes: [...typesSet] };
}

