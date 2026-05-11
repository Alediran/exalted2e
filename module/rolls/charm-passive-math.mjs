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
 * Sum soak bonuses from pre-evaluated charm entries.
 * hardnessSetTo uses max() rather than sum (a single source sets hardness to N).
 * @param {{ bashing:number, lethal:number, aggravated:number, hardnessAdd:number, hardnessSetTo:number }[]} entries
 * @returns same shape
 */
export function computeSoakBonus(entries) {
  let bashing = 0, lethal = 0, aggravated = 0, hardnessAdd = 0, hardnessSetTo = 0;
  for (const e of entries) {
    bashing      += e.bashing      ?? 0;
    lethal       += e.lethal       ?? 0;
    aggravated   += e.aggravated   ?? 0;
    hardnessAdd  += e.hardnessAdd  ?? 0;
    hardnessSetTo = Math.max(hardnessSetTo, e.hardnessSetTo ?? 0);
  }
  return { bashing, lethal, aggravated, hardnessAdd, hardnessSetTo };
}

/**
 * Apply wound-reduction charms to the base wound penalty.
 * formula=""  → negate all penalties (return 0).
 * formula="-N" → reduce magnitude by N.  Result is clamped to [penalty, 0].
 * @param {object[]} items
 * @param {number} baseWoundPenalty — typically ≤ 0
 * @returns {number} effective wound penalty
 */
export function computeWoundReduction(items, baseWoundPenalty) {
  let totalReduction = 0;
  for (const item of items) {
    const wr = item?.system?.woundReduction;
    if (!wr?.enabled) continue;
    // Full negation (formula="") outranks any partial reduction — one such charm wins.
    if (wr.formula === "" || wr.formula == null) return 0;
    const r = Math.abs(parseInt(wr.formula, 10)) || 0;
    totalReduction += r;
  }
  return Math.min(0, baseWoundPenalty + totalReduction);
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

/**
 * Apply pre-evaluated stat-boost deltas to a systemData object.
 * Uses simple property-path splitting rather than foundry.utils so
 * the function stays testable without Foundry globals.
 * @param {object} systemData
 * @param {{ path:string, delta:number }[]} deltas
 */
export function applyStatBoostDeltas(systemData, deltas) {
  for (const { path, delta } of deltas) {
    const parts = path.split(".");
    let obj = systemData;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof obj[parts[i]] !== "object" || obj[parts[i]] === null) {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }
    const last = parts[parts.length - 1];
    obj[last] = (obj[last] ?? 0) + delta;
  }
}
