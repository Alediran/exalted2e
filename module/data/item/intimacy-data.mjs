const fields = foundry.data.fields;

export class IntimacyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      intimacyType:    new fields.StringField({ initial: "tie",   choices: ["tie", "principle"] }),
      intensity:       new fields.StringField({ initial: "minor", choices: ["minor", "major", "defining"] }),
      description:     new fields.HTMLField({ initial: "" }),
      subject:         new fields.StringField({ initial: "", blank: true }),
      positive:        new fields.BooleanField({ initial: true }),
      strength:        new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      ablationDamage:  new fields.NumberField({ initial: 0, min: 0, integer: true })
    };
  }
}
