import { EX2E } from "../config.mjs";

/**
 * Flatten a partial update object into an array of permanent-trait
 * changes, comparing against the actor's current (pre-update) values.
 *
 * Returns `[{ path, label, oldValue, newValue, kind }, ...]` where
 * `kind` is "reduction" or "increase".
 *
 * Paths scanned:
 *   system.attributes.<key>.value         (9 attributes)
 *   system.abilities.<key>.value          (22 abilities)
 *   system.abilities.<key>.specialties    (length delta)
 *   system.essence.value
 *   system.willpower.max
 *   system.virtues.<key>.value
 *
 * Reads `actor.system.*` for old values and uses `game.i18n.localize`
 * for label resolution. `EX2E.attributes` and `EX2E.abilityLabels` are
 * imported from config for the i18n key lookup.
 */
export function collectPermanentTraitChanges(changed, actor) {
  const flat = foundry.utils.flattenObject(changed ?? {});
  const results = [];

  const attrLabel = (key) => {
    for (const group of Object.values(EX2E.attributes)) {
      if (key in group) return game.i18n.localize(group[key]);
    }
    return key;
  };
  const abilityLabel = (key) => game.i18n.localize(EX2E.abilityLabels[key] ?? key);
  const virtueLabel  = (key) =>
    game.i18n.localize(`EX2E.Virtue${key.charAt(0).toUpperCase()}${key.slice(1)}`);

  for (const [path, rawNew] of Object.entries(flat)) {
    let match;

    if ((match = path.match(/^system\.attributes\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.attributes?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: attrLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.abilities\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.abilities?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: abilityLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.essence\.value$/))) {
      const oldVal = Number(actor.system.essence?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: game.i18n.localize("EX2E.EssencePermanent"),
        oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.willpower\.max$/))) {
      const oldVal = Number(actor.system.willpower?.max ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: game.i18n.localize("EX2E.Willpower"),
        oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }

    if ((match = path.match(/^system\.virtues\.(\w+)\.value$/))) {
      const key = match[1];
      const oldVal = Number(actor.system.virtues?.[key]?.value ?? 0);
      const newVal = Number(rawNew);
      if (newVal === oldVal) continue;
      results.push({
        path, label: virtueLabel(key), oldValue: oldVal, newValue: newVal,
        kind: newVal > oldVal ? "increase" : "reduction"
      });
      continue;
    }
  }

  // Specialties are an array; flatten doesn't produce a scalar for them.
  // Handle separately by checking the full-array path at system.abilities.<key>.specialties.
  const expanded = foundry.utils.expandObject(changed ?? {});
  const abilities = expanded.system?.abilities ?? {};
  for (const [key, ab] of Object.entries(abilities)) {
    if (!("specialties" in ab)) continue;
    const oldList = actor.system.abilities?.[key]?.specialties ?? [];
    const newList = ab.specialties ?? [];
    if (newList.length === oldList.length) continue;
    const label = `${game.i18n.localize("EX2E.Specialties")}: ${
      game.i18n.localize(EX2E.abilityLabels[key] ?? key)}`;
    results.push({
      path: `system.abilities.${key}.specialties`,
      label,
      oldValue: oldList.length,
      newValue: newList.length,
      kind: newList.length > oldList.length ? "increase" : "reduction"
    });
  }

  return results;
}
