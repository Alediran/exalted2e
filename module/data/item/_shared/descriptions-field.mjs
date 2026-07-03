/**
 * Per-language description override map: { <langCode>: "<html>" }.
 * Paired with the item's existing `description` HTMLField, which stays the
 * default/fallback. Empty by default, so no migration is needed.
 */
export function descriptionsField() {
  const f = foundry.data.fields;
  return f.TypedObjectField
    ? new f.TypedObjectField(new f.HTMLField())
    : new f.ObjectField();
}
