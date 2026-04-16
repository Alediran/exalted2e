const fields = foundry.data.fields;

export class IntimacyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      intimacyType: new fields.StringField({ initial: "tie",   choices: ["tie", "principle"] }),
      intensity:    new fields.StringField({ initial: "minor", choices: ["minor", "major", "defining"] }),
      description:  new fields.HTMLField({ initial: "" })
    };
  }
}
