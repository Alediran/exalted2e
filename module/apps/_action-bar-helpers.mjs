/**
 * Pure helpers extracted from action-bar-config.mjs.
 * No Foundry API calls; all functions take plain values and return plain values.
 */

/**
 * Build the ordered list of rows that can be pinned on the radial action bar.
 * "cast" is always prepended as a special-cased spellcasting entry.
 * Actions flagged clinchOnly are excluded.
 *
 * @param {object} actionsConfig  EX2E.actions or equivalent { [key]: { labelKey, icon?, clinchOnly? } }
 * @returns {{ key: string, labelKey: string, icon: string }[]}
 */
export function buildPinnableRows(actionsConfig) {
  const rows = [
    { key: "cast", labelKey: "EX2E.ActionCast", icon: "fa-solid fa-hat-wizard" },
  ];
  for (const [key, cfg] of Object.entries(actionsConfig)) {
    if (cfg.clinchOnly) continue;
    rows.push({ key, labelKey: cfg.labelKey, icon: cfg.icon ?? "fa-solid fa-circle" });
  }
  return rows;
}

/**
 * Order action rows for the config form display.
 * Pinned rows appear first in their saved order (checked: true),
 * then remaining rows follow in default pinnableRows order (checked: false).
 *
 * @param {string[]} pinned       saved list of pinned action keys
 * @param {{ key: string, labelKey: string, icon: string }[]} pinnableRows  from buildPinnableRows()
 * @returns {{ key: string, labelKey: string, icon: string, checked: boolean }[]}
 */
export function orderActionRows(pinned, pinnableRows) {
  const byKey = new Map(pinnableRows.map(r => [r.key, r]));
  const rows = [];
  for (const key of pinned) {
    const r = byKey.get(key);
    if (r) { rows.push({ ...r, checked: true }); byKey.delete(key); }
  }
  for (const r of pinnableRows) {
    if (byKey.has(r.key)) rows.push({ ...r, checked: false });
  }
  return rows;
}
