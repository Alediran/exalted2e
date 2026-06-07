/**
 * Pure display/derivation helpers extracted from the character sheet so they are
 * unit-testable (the sheet module itself isn't Vitest-loadable — it builds a
 * sheet class at load). Foundry-free: i18n-dependent builders take an injected
 * `localize`, config is passed in as plain objects.
 */

/** Greater-sign gate: Essence >= 4 AND the caste's college dots sum >= 15. */
export function _greaterSignPrereqMet(actor, caste) {
  if ((actor.system.essence?.value ?? 0) < 4) return false;
  const colleges = actor.system.splat?.sidereal?.colleges?.[caste] ?? {};
  return Object.values(colleges).reduce((s, v) => s + (v ?? 0), 0) >= 15;
}

/**
 * Collapse permanent + Stackable charms with the same name into one
 * representative + count. Returns `{ stackCounts: { repId: count }, stackHidden: Set<id> }`.
 */
export function dedupStackableCharms(charms) {
  const stackCounts = {};
  const stackHidden = new Set();
  const seen = new Map(); // name → first id
  for (const c of (charms ?? [])) {
    if (c.system?.duration !== "permanent") continue;
    if (!(c.system?.keywords ?? []).includes("Stackable")) continue;
    if (seen.has(c.name)) {
      const repId = seen.get(c.name);
      stackCounts[repId] = (stackCounts[repId] ?? 1) + 1;
      stackHidden.add(c.id);
    } else {
      seen.set(c.name, c.id);
    }
  }
  return { stackCounts, stackHidden };
}

const _ANIMA_ORDER = { none: 0, glowing: 1, burning: 2, bonfire: 3, totemic: 4 };
const _animaLevel = (key) => _ANIMA_ORDER[key] ?? 0;

/**
 * Effective activation cost for an anima power given the current anima level.
 * Order of precedence: autoThreshold (free) → totemic override (at totemic) →
 * bonfire override (at >= bonfire) → base cost.
 * @returns {{ motes: number, willpower: number }}
 */
export function animaPowerCost(powerSys, animaLevel) {
  let motes = powerSys.activationCost.motes;
  let willpower = powerSys.activationCost.willpower;
  if (powerSys.autoThreshold && _animaLevel(animaLevel) >= _animaLevel(powerSys.autoThreshold)) {
    motes = 0; willpower = 0;
  } else if (powerSys.totemicOverride.enabled && animaLevel === "totemic") {
    motes = powerSys.totemicOverride.motes; willpower = 0;
  } else if (powerSys.bonfireOverride.enabled && _animaLevel(animaLevel) >= _animaLevel("bonfire")) {
    motes = powerSys.bonfireOverride.motes; willpower = 0;
  }
  return { motes, willpower };
}

/**
 * Build newest-first purchase-log display rows with a running-sum `overdraft`
 * flag (true once cumulative spend exceeds `totalEarned`). Preserves each
 * entry's original index. `dateText` is the localized timestamp.
 */
export function buildPurchaseLogRows(rawLog, totalEarned) {
  let runningSum = 0;
  return (rawLog ?? []).map((e, i) => {
    runningSum += Number(e.xpCost) || 0;
    return {
      index:      i,
      dateText:   new Date(e.timestamp || 0).toLocaleString(),
      traitLabel: e.traitLabel,
      oldValue:   e.oldValue,
      newValue:   e.newValue,
      xpCost:     e.xpCost,
      note:       e.note,
      overdraft:  runningSum > totalEarned,
    };
  }).reverse();
}

/**
 * Split an effects iterable into `{ temporal, permanent }` display buckets
 * (temporal = dvRefreshable OR isTemporary OR a non-permanent charmDuration),
 * grouping permanent Stackable effects by name with an `xN` suffix. `durations`
 * maps a charmDuration key → an i18n key; `localize` resolves labels.
 */
export function buildEffectsData(effects, durations, localize) {
  const temporal = [];
  const permanent = [];
  const stackGroups = new Map();
  for (const eff of effects) {
    const refreshable    = !!eff.flags?.exalted2e?.dvRefreshable;
    const charmDuration  = eff.flags?.exalted2e?.charmDuration;
    const charmStackable = !!eff.flags?.exalted2e?.charmStackable;
    const durationLabelKey = charmDuration ? (durations[charmDuration] ?? null) : null;
    const isTemporal = refreshable || eff.isTemporary
      || (charmDuration && charmDuration !== "permanent");

    if (!isTemporal && charmStackable) {
      if (stackGroups.has(eff.name)) { stackGroups.get(eff.name).count++; continue; }
      const entry = { id: eff.id, name: eff.name, img: eff.img || "icons/svg/aura.svg", disabled: eff.disabled, durationLabel: "", isSpellEffect: !!(eff.flags?.exalted2e?.spellEffect) };
      stackGroups.set(eff.name, { entry, count: 1 });
      permanent.push(entry);
      continue;
    }

    const entry = {
      id:           eff.id,
      name:         eff.name,
      img:          eff.img || "icons/svg/aura.svg",
      disabled:     eff.disabled,
      durationLabel: refreshable
        ? localize("EX2E.EffectUntilNextTurn")
        : (durationLabelKey ? localize(durationLabelKey) : (eff.duration?.label ?? "")),
      isSpellEffect: !!(eff.flags?.exalted2e?.spellEffect),
    };
    (isTemporal ? temporal : permanent).push(entry);
  }
  for (const { entry, count } of stackGroups.values()) {
    if (count > 1) entry.name = `${entry.name} x${count}`;
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  temporal.sort(byName);
  permanent.sort(byName);
  return { temporal, permanent };
}

/**
 * Build the ability-group display array for the current exalt type.
 * `config` provides `abilityLabels`, `abilities` (all keys), and `abilityGroups`
 * (per-exalt display groupings; falls back to `.mortal`). `localize` resolves labels.
 * Ungrouped abilities collect into an "other" group. Each group:
 * `{ key, label, abilities[], isCurrentCaste }`.
 */
export function buildAbilityGroups(sys, config, localize) {
  const mapAbilities = keys => keys.map(key => {
    const ab = sys.abilities[key] ?? { value: 0, caste: false, favored: false, specialties: [] };
    return {
      key,
      label:       localize(config.abilityLabels[key] ?? key),
      value:       ab.value,
      caste:       ab.caste,
      favored:     ab.favored,
      specialties: ab.specialties ?? [],
      fieldBase:   `system.abilities.${key}`,
    };
  });

  const groupDefs   = config.abilityGroups[sys.exaltType] ?? config.abilityGroups.mortal;
  const groupedKeys = new Set(groupDefs.flatMap(g => g.abilities));
  const ungrouped   = config.abilities.filter(k => !groupedKeys.has(k));

  const groups = groupDefs.map(g => ({
    key:            g.key,
    label:          localize(g.label),
    abilities:      mapAbilities(g.abilities),
    isCurrentCaste: sys.caste === g.key,
  }));

  if (ungrouped.length) {
    groups.push({
      key:            "other",
      label:          localize("EX2E.AbilityGroupOther"),
      abilities:      mapAbilities(ungrouped),
      isCurrentCaste: false,
    });
  }
  return groups;
}
