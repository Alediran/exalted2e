/**
 * Build combo display rows. For each combo, resolve its charmUids against
 * `charmsByUid` (a Map<uid, charmItem>), sum the resolved charms' raw cost
 * fields, and produce a `costPreview` string + icon strip. Foundry-free.
 *
 * @param {Array} combos        combo items with `system.charmUids`
 * @param {Map}   charmsByUid   uid → charm item (`system.cost.*`, name, img, id)
 * @returns {Array<{ id, name, img, iconStrip, totalCount, missingCount, costPreview, canActivate }>}
 */
export function buildComboPreviewRows(combos, charmsByUid) {
  return (combos ?? []).map(combo => {
    const uids = combo.system?.charmUids ?? [];
    const resolved = [];
    let missingCount = 0;
    for (const uid of uids) {
      const charm = charmsByUid.get(uid);
      if (charm) resolved.push(charm);
      else missingCount++;
    }
    const preview = { motes: 0, willpower: 0, bashing: 0, lethal: 0, aggravated: 0, xp: 0 };
    for (const charm of resolved) {
      const c = charm.system?.cost ?? {};
      preview.motes      += Number(c.motes)            || 0;
      preview.willpower  += Number(c.willpower)        || 0;
      preview.bashing    += Number(c.bashingHealth)    || 0;
      preview.lethal     += Number(c.lethalHealth)     || 0;
      preview.aggravated += Number(c.aggravatedHealth) || 0;
      preview.xp         += Number(c.xp)               || 0;
    }
    const bits = [];
    if (preview.motes)      bits.push(`${preview.motes}m`);
    if (preview.willpower)  bits.push(`${preview.willpower}wp`);
    if (preview.bashing)    bits.push(`${preview.bashing}b`);
    if (preview.lethal)     bits.push(`${preview.lethal}l`);
    if (preview.aggravated) bits.push(`${preview.aggravated}a`);
    if (preview.xp)         bits.push(`${preview.xp}xp`);
    return {
      id:          combo.id,
      name:        combo.name,
      img:         combo.img,
      iconStrip:   resolved.slice(0, 6).map(c => ({ id: c.id, name: c.name, img: c.img })),
      totalCount:  uids.length,
      missingCount,
      costPreview: bits.join(" "),
      canActivate: resolved.length > 0,
    };
  });
}
