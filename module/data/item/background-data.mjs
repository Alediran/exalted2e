const fields = foundry.data.fields;

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      value:       new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
      description: new fields.HTMLField({ initial: "" }),
      notes:       new fields.StringField({ initial: "", blank: true })
    };
  }
}
