/**
 * Returns +2 when a combo contains both a Form-type charm and at least one
 * charm with a non-empty flawsOfInvulnerability array; 0 otherwise.
 * Pure function with no Foundry dependencies — safe for Vitest.
 *
 * @param {{ system: { keywords?: string[], flawsOfInvulnerability?: object[] } }[]} allComboCharms
 * @returns {number} 0 or 2
 */
export function computeFoiSurcharge(allComboCharms) {
  const hasFormType = allComboCharms.some(c =>
    (c.system?.keywords ?? []).includes("Form-type")
  );
  const hasFoiCharm = allComboCharms.some(c =>
    (c.system?.flawsOfInvulnerability?.length ?? 0) > 0
  );
  return (hasFormType && hasFoiCharm) ? 2 : 0;
}
