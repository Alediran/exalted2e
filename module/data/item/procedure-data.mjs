import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class ProcedureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      art:         new fields.StringField({ required: true, initial: "", blank: true }),
      minDegree:   new fields.NumberField({ required: true, initial: 0, min: 0, max: 3, integer: true }),
      attribute:   new fields.StringField({ required: true, initial: "intelligence" }),
      difficulty:  new fields.NumberField({ required: true, initial: 1, min: 1, integer: true }),
      castingTime: new fields.StringField({ required: true, initial: "one hour", blank: false }),
      extended:     new fields.BooleanField({ initial: false }),
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
    };
  }
}
