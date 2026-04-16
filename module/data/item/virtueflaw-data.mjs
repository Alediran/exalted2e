const fields = foundry.data.fields;

export class VirtueFlawData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      exaltType:   new fields.StringField({ initial: "solar",      blank: false }),
      baseVirtue:  new fields.StringField({ initial: "compassion", blank: false }),
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
