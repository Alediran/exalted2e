import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class PoisonData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      damage:      new fields.StringField({ initial: "", blank: true }),
      damageType:  new fields.StringField({ initial: "lethal", choices: ["bashing", "lethal", "aggravated"] }),
      interval:    new fields.StringField({ initial: "", blank: true }),
      duration:    new fields.StringField({ initial: "", blank: true }),
      vector:       new fields.StringField({ initial: "", blank: true }),
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField()
    };
  }
}
