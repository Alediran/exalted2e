import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class DrugData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      effect:      new fields.StringField({ initial: "", blank: true }),
      duration:    new fields.StringField({ initial: "", blank: true }),
      addiction:    new fields.BooleanField({ initial: false }),
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField()
    };
  }
}
