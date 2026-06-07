/**
 * Resolve a flurry's preview from its action rows (plain objects with
 * `actionKey`, `speed`, `dvMod`, and—for draws—`weaponId`).
 *
 * Quick-draw: a 2-row flurry that is a Draw plus an attack with the SAME
 * drawn weapon resolves on the MIN speed of the two rows (a Speed-5 Draw +
 * Speed-5 Punch still lands on tick 5), otherwise speed is the MAX.
 * dicePenalty = n-1; dvPenalty = maxDv + (n-1).
 *
 * @returns {{ count: number, dicePenalty: number, speed: number, dvPenalty: number }}
 */
export function computeFlurryPreview(actions) {
  const list = actions ?? [];
  const n = list.length;
  const drawWeaponId = list.find(a => a.actionKey === "draw")?.weaponId ?? "";
  const isQuickDraw = n === 2
    && list.every(a => a.actionKey === "draw" || a.actionKey?.startsWith(`weapon:${drawWeaponId}`));

  const speed = isQuickDraw
    ? list.reduce((m, a) => Math.min(m, a.speed ?? 5), Infinity)
    : list.reduce((m, a) => Math.max(m, a.speed ?? 0), 0);
  const maxDv = list.reduce((m, a) => Math.max(m, a.dvMod ?? 0), 0);

  return {
    count:       n,
    dicePenalty: Math.max(0, n - 1),
    speed:       Number.isFinite(speed) ? speed : 0,
    dvPenalty:   maxDv + Math.max(0, n - 1),
  };
}

/**
 * Reset any `weapon:<id>:<mode>` action row whose weapon is no longer
 * available (missing, or not equipped and not drawn) to the fallback action.
 * Returns a new array; does not mutate the input.
 *
 * @param {Array} actions
 * @param {Set<string>} drawnIds   weapon ids drawn elsewhere in the flurry
 * @param {Object} weaponEquipById map of `{ [weaponId]: { equipped: boolean } }`
 * @param {{key:string, speed:number, dvMod:number}} fallback
 */
export function normalizeFlurryActions(actions, drawnIds, weaponEquipById, fallback) {
  return (actions ?? []).map(a => {
    if (!a.actionKey?.startsWith("weapon:")) return { ...a };
    const wid = a.actionKey.split(":")[1];
    const weapon = weaponEquipById?.[wid];
    const available = !!weapon && (weapon.equipped || drawnIds.has(wid));
    if (available) return { ...a };
    return { ...a, actionKey: fallback.key, speed: fallback.speed, dvMod: fallback.dvMod, weaponId: "" };
  });
}

/** Per-mode attack rate after a charm rate bonus, floored at 1. */
export function effectiveModeRate(baseRate, charmRateBonus) {
  return Math.max(1, (baseRate ?? 1) + (charmRateBonus ?? 0));
}

/** Whether a weapon-mode `<option>` is selectable: (equipped or drawn) AND under its rate. */
export function isModeOptionEnabled(weaponEquipped, drawn, otherUses, rate) {
  return (weaponEquipped || drawn) && otherUses < rate;
}
