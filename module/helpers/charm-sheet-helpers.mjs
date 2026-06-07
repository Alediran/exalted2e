/**
 * Display string for an already-parsed charm cost (output of parseCostFormula).
 * Returns "" for a null parse and "✓" when the cost parses but is empty.
 */
export function buildCharmCostPreview(parsed) {
  if (!parsed) return "";
  const parts = [];
  if (parsed.motes > 0)                     parts.push(`${parsed.motes}m base`);
  if (parsed.moteVar?.type === "perUnit")   parts.push(`${parsed.moteVar.rate}m/${parsed.moteVar.unit}`);
  if (parsed.moteVar?.type === "openEnded") parts.push("open-ended");
  if (parsed.moteVar?.type === "tiered")    parts.push(`${parsed.moteVar.tiers.length} tiers`);
  if (parsed.willpower > 0)                 parts.push(`${parsed.willpower}wp`);
  if (parsed.lethalHealth > 0)              parts.push(`${parsed.lethalHealth}lhl`);
  if (parsed.bashingHealth > 0)             parts.push(`${parsed.bashingHealth}bhl`);
  if (parsed.aggravatedHealth > 0)          parts.push(`${parsed.aggravatedHealth}ahl`);
  if (parsed.xp > 0)                        parts.push(`${parsed.xp}xp`);
  if (parsed.permanentEssence > 0)          parts.push("perm ess");
  if (parsed.permanentWillpower > 0)        parts.push("perm wp");
  if (parsed.surcharge?.length)             parts.push(`surcharge (${parsed.surcharge.length} opt)`);
  return parts.join(" · ") || "✓";
}

/**
 * Deduplicated, name-sorted charm option list across actor items, world items,
 * and compendium index entries. Actor/world entries key by `system.charmUid`
 * and skip `currentId`; pack entries key by `_id`. Non-charms and blank uids
 * are ignored. Returns `[{ uid, name }]`.
 */
export function buildCharmOptions(actorCharms, worldCharms, packEntries, currentId) {
  const seen = new Set();
  const out  = [];
  const add  = (uid, name) => {
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    out.push({ uid, name });
  };
  for (const i of (actorCharms ?? [])) {
    if (i.type !== "charm" || i.id === currentId) continue;
    add(i.system?.charmUid ?? "", i.name);
  }
  for (const i of (worldCharms ?? [])) {
    if (i.type !== "charm" || i.id === currentId) continue;
    add(i.system?.charmUid ?? "", i.name);
  }
  for (const entry of (packEntries ?? [])) {
    if (entry.type !== "charm") continue;
    add(entry._id, entry.name);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Attribute + ability dropdown options (bare-key values). `localize` resolves label keys. */
export function buildTraitOptions(config, localize) {
  const attributeOptions = [];
  for (const group of Object.values(config.attributes)) {
    for (const [key, labelKey] of Object.entries(group)) {
      attributeOptions.push({ value: key, label: localize(labelKey) });
    }
  }
  const abilityOptions = (config.abilities ?? []).map(k => ({
    value: k, label: localize(config.abilityLabels?.[k] ?? k),
  }));
  return { attributeOptions, abilityOptions };
}

/** Stat-boost update paths (`system.attributes.X.value` / `system.abilities.X.value`) with labels. */
export function buildStatBoostPaths(config, localize) {
  const paths = [];
  for (const group of Object.values(config.attributes)) {
    for (const [k, labelKey] of Object.entries(group)) {
      paths.push({ value: `system.attributes.${k}.value`, label: localize(labelKey) });
    }
  }
  for (const k of (config.abilities ?? [])) {
    paths.push({ value: `system.abilities.${k}.value`, label: localize(config.abilityLabels?.[k] ?? k) });
  }
  return paths;
}
