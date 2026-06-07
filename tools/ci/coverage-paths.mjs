/**
 * Normalize a coverage file key from either runtime to a common repo-relative
 * form so istanbul can merge the two maps:
 *   - Quench (browser):  http://host/systems/exalted2e/module/x.mjs  -> module/x.mjs
 *   - Vitest (node):     /abs/workspace/module/x.mjs                 -> module/x.mjs
 *   - already relative:  module/x.mjs                                -> module/x.mjs
 * Drops ?query/#hash and normalizes Windows separators. Non-module or non-string
 * inputs are returned unchanged.
 */
export function normalizeCoverageKey(key) {
  if (typeof key !== "string" || !key) return key;
  const cleaned = key.split(/[?#]/)[0].replace(/\\/g, "/");
  const i = cleaned.indexOf("/module/");
  if (i !== -1) return cleaned.slice(i + 1);
  if (cleaned.startsWith("module/")) return cleaned;
  return key;
}
