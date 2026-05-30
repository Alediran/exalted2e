const fields = foundry.data.fields;

export class ThaummArtData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      artName:     new fields.StringField({ required: true, initial: "", blank: true }),
      degree:      new fields.NumberField({ required: true, initial: 1, min: 1, max: 3, integer: true }),
      description: new fields.HTMLField({ initial: "" }),
    };
  }
}
