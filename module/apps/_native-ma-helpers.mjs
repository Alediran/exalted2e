/**
 * Pure helpers extracted from native-ma-styles-config.mjs.
 * No Foundry API calls; all functions take plain values and return plain values.
 */

/**
 * Build the splat display list for the native MA styles config form.
 * Entries whose key is in excludedKeys are omitted.
 *
 * @param {object} splatTypes          EX2E.splatTypes — { [key]: labelKey }
 * @param {object} saved               saved nativeMartialArtsStyles setting — { [key]: string[] }
 * @param {Set<string>} excludedKeys   splat keys to omit (e.g. mortal, spirit, martialarts)
 * @param {(key: string) => string} localizeFn  game.i18n.localize or equivalent
 * @returns {{ key: string, label: string, styles: string }[]}
 */
export function buildSplatList(splatTypes, saved, excludedKeys, localizeFn) {
  return Object.entries(splatTypes)
    .filter(([key]) => !excludedKeys.has(key))
    .map(([key, labelKey]) => ({
      key,
      label:  localizeFn(labelKey),
      styles: (saved[key] ?? []).join("\n"),
    }));
}

/**
 * Parse the raw FormDataExtended object from the native MA styles config submit handler.
 * Reads keys of the form `styles.<splat>`, splits on newlines, trims, and removes blanks.
 *
 * @param {object} rawObject  formData.object from the AppV2 submit handler
 * @returns {{ [splatKey: string]: string[] }}
 */
export function parseNativeMaFormData(rawObject) {
  const result = {};
  for (const [key, value] of Object.entries(rawObject)) {
    if (key.startsWith("styles.")) {
      const splat = key.slice(7);
      result[splat] = String(value ?? "").split("\n").map(s => s.trim()).filter(Boolean);
    }
  }
  return result;
}
