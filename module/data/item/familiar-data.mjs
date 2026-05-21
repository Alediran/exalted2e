const fields = foundry.data.fields;

export class FamiliarData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      backgroundId:  new fields.StringField({ blank: true, initial: "" }),
      linkedActorId: new fields.StringField({ blank: true, initial: "" }),
      species:       new fields.StringField({ blank: true, initial: "" }),
      description:   new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
