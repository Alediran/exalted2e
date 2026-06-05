const fields = foundry.data.fields;

export class VirtueFlawData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      exaltType:   new fields.StringField({ initial: "solar",      blank: false }),
      baseVirtue:  new fields.StringField({ initial: "compassion", blank: false }),
      description: new fields.HTMLField({ initial: "" }),
      changes: new fields.ArrayField(new fields.SchemaField({
        key:   new fields.StringField({ initial: "", blank: true }),
        mode:  new fields.NumberField({ initial: 2, integer: true }),
        value: new fields.StringField({ initial: "", blank: true }),
      })),
    };
  }
}
