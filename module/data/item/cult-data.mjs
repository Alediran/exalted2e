const fields = foundry.data.fields;

export class CultData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      backgroundId: new fields.StringField({ blank: true, initial: "" }),
      description:  new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
