import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class MutationData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      mutationType: new fields.StringField({ initial: "positive", choices: ["positive", "negative", "neutral"] }),
      pointCost:    new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField()
    };
  }
}
