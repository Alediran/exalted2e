/**
 * Pure stunt-reward math. No Foundry dependencies.
 *
 * Stunt reward table (RAW Exalted 2e, errata-aligned):
 *   1-die: +2 motes (no choice)
 *   2-die: +4 motes OR +1 WP (player choice)
 *   3-die: +6 motes OR +1 WP (player choice)
 *   advancesMotivation: +1 WP rider on top
 *
 * All payouts are gross — clamping against pool headroom happens in
 * splitMotePayout / splitWillpowerPayout.
 */

/**
 * Compute the gross payout for one stunt record.
 *
 * @param {object} input
 * @param {0|1|2|3}                    input.stunt
 * @param {boolean}                    input.advancesMotivation
 * @param {"motes"|"willpower"}        input.rewardKind   ignored when stunt ≤ 1
 * @returns {{motes:number, willpower:number}}
 */
export function computeStuntReward({ stunt, advancesMotivation, rewardKind } = {}) {
  let motes = 0;
  let willpower = 0;

  if (stunt === 1) {
    motes = 2;
  } else if (stunt === 2) {
    if (rewardKind === "willpower") willpower = 1;
    else motes = 4;
  } else if (stunt === 3) {
    if (rewardKind === "willpower") willpower = 1;
    else motes = 6;
  }
  // stunt 0 or out-of-range → both stay 0

  if (stunt >= 1 && advancesMotivation) {
    willpower += 1;
  }

  return { motes, willpower };
}

/**
 * Split a mote payout across Personal-first, Peripheral overflow.
 *
 * @param {object} input
 * @param {number} input.motes                gross motes to pay
 * @param {number} input.personalAvailable    headroom in Personal pool (max - value)
 * @param {number} input.peripheralAvailable  headroom in Peripheral pool
 * @returns {{toPersonal:number, toPeripheral:number, wasted:number}}
 */
export function splitMotePayout({ motes, personalAvailable, peripheralAvailable } = {}) {
  const m   = Math.max(0, Number(motes) || 0);
  const pAv = Math.max(0, Number(personalAvailable) || 0);
  const eAv = Math.max(0, Number(peripheralAvailable) || 0);

  const toPersonal   = Math.min(m, pAv);
  const remaining    = m - toPersonal;
  const toPeripheral = Math.min(remaining, eAv);
  const wasted       = remaining - toPeripheral;

  return { toPersonal, toPeripheral, wasted };
}

/**
 * Split a Willpower payout against headroom.
 *
 * @param {object} input
 * @param {number} input.willpower            gross WP to pay
 * @param {number} input.willpowerAvailable   headroom (willpower.max - willpower.value)
 * @returns {{paid:number, wasted:number}}
 */
export function splitWillpowerPayout({ willpower, willpowerAvailable } = {}) {
  const w   = Math.max(0, Number(willpower) || 0);
  const wAv = Math.max(0, Number(willpowerAvailable) || 0);
  const paid   = Math.min(w, wAv);
  const wasted = w - paid;
  return { paid, wasted };
}

/**
 * Aggregate an array of stunt records into per-pool payouts.
 *
 * Sums all gross motes and all gross WP first, then runs splitMotePayout
 * and splitWillpowerPayout once on the aggregates. Order-independent —
 * sum-then-clamp is mathematically identical to clamp-then-sum when
 * filling sequentially with the same headroom.
 *
 * The perRecord array carries stunt + gross motes/wp per input record so
 * the chat card can list each stunt individually ("2-die: +4m") even
 * though the actor.update is one batched operation.
 *
 * @param {object} input
 * @param {Array<{stunt,advancesMotivation,rewardKind}>} input.rewards
 * @param {number} input.personalAvailable
 * @param {number} input.peripheralAvailable
 * @param {number} input.willpowerAvailable
 * @returns {{
 *   toPersonal:number, toPeripheral:number, toWillpower:number,
 *   wastedMotes:number, wastedWillpower:number,
 *   perRecord: Array<{stunt:number, motes:number, willpower:number}>
 * }}
 */
export function aggregateStuntPayouts({ rewards, personalAvailable, peripheralAvailable, willpowerAvailable } = {}) {
  const list = Array.isArray(rewards) ? rewards : [];

  const perRecord = list.map(r => {
    const { motes, willpower } = computeStuntReward(r);
    return { stunt: r?.stunt ?? 0, motes, willpower };
  });

  const grossMotes = perRecord.reduce((s, r) => s + r.motes, 0);
  const grossWp    = perRecord.reduce((s, r) => s + r.willpower, 0);

  const moteSplit = splitMotePayout({
    motes: grossMotes,
    personalAvailable,
    peripheralAvailable
  });
  const wpSplit = splitWillpowerPayout({
    willpower: grossWp,
    willpowerAvailable
  });

  return {
    toPersonal:      moteSplit.toPersonal,
    toPeripheral:    moteSplit.toPeripheral,
    toWillpower:     wpSplit.paid,
    wastedMotes:     moteSplit.wasted,
    wastedWillpower: wpSplit.wasted,
    perRecord
  };
}
