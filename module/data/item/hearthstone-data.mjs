const fields = foundry.data.fields;

export class HearthstoneData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      hearthstoneType: new fields.StringField({ initial: "", blank: true }),
      rating:          new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
      description:     new fields.HTMLField({ initial: "" })
    };
  }
}
