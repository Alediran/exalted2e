import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class MeritFlawData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      meritFlawType: new fields.StringField({ initial: "merit", choices: ["merit", "flaw"] }),
      value:         new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
      description:   new fields.HTMLField({ initial: "" }),
      descriptions:  descriptionsField()
    };
  }
}
