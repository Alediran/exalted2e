const fields = foundry.data.fields;

export class ComboData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ initial: "" }),
      // Ordered list of target charms, referenced by the stable
      // `system.charmUid` field (same convention the prereq system uses).
      // Storing UIDs instead of item ids means delete-and-recreate and
      // rename cycles don't break the Combo.
      charmUids:   new fields.ArrayField(new fields.StringField({ blank: false }))
    };
  }
}
