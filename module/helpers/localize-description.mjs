/** Pick the override for `lang` if non-empty, else the default. Foundry-free. */
export function localizedDescription(descDefault, descMap, lang) {
  const override = descMap?.[lang];
  return (override && override.trim()) ? override : (descDefault ?? "");
}

/** Foundry wrapper: resolve an item's description for the current UI language. */
export function itemDescription(item) {
  return localizedDescription(item?.system?.description, item?.system?.descriptions, game.i18n.lang);
}
