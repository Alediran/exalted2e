import { moteCostString } from "../rolls/activation-ledger.mjs";

/** A charm counts as reflexive-for-combo if it is reflexive OR carries Combo-Basic. */
export function isReflexiveForCombo(charm) {
  return charm?.system?.charmType === "reflexive" ||
         (charm?.system?.keywords ?? []).includes("Combo-Basic");
}

/** A charm is Combo-Basic if it carries the Combo-Basic keyword. */
export function isComboBasic(charm) {
  return (charm?.system?.keywords ?? []).includes("Combo-Basic");
}

/**
 * Validate adding `incoming` to a combo already containing `existing` charms.
 * Returns an i18n KEY describing the violation, or null when the add is legal.
 */
export function validateComboAdd(incoming, existing) {
  if (incoming?.system?.charmType === "form" && existing.some(c => c?.system?.charmType === "form"))
    return "EX2E.ComboOneFormType";
  if (isComboBasic(incoming) && existing.some(c => !isReflexiveForCombo(c)))
    return "EX2E.ComboBasicOnlyWithReflexive";
  if (!isReflexiveForCombo(incoming) && existing.some(c => isComboBasic(c)))
    return "EX2E.ComboBasicOnlyWithReflexive";
  return null;
}

/** One-line cost string like `5m +1wp 2b 1l 1a 3xp` for a charm cost object. */
export function charmCostMetaString(cost) {
  const c = cost ?? {};
  const parts = [];
  const mStr = moteCostString(c); if (mStr) parts.push(mStr);
  if (c.willpower)        parts.push(`+${c.willpower}wp`);
  if (c.bashingHealth)    parts.push(`${c.bashingHealth}b`);
  if (c.lethalHealth)     parts.push(`${c.lethalHealth}l`);
  if (c.aggravatedHealth) parts.push(`${c.aggravatedHealth}a`);
  if (c.xp)               parts.push(`${c.xp}xp`);
  return parts.join(" ");
}
