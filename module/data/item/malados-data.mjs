const fields = foundry.data.fields;

export class MaladosData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      spiritName:   new fields.StringField({ initial: "" }),
      essenceRating: new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
    };
  }
}
