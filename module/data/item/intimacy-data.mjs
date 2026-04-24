const fields = foundry.data.fields;

export class IntimacyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Existing
      intimacyType: new fields.StringField({ initial: "tie",   choices: ["tie", "principle"] }),
      intensity:    new fields.StringField({ initial: "minor", choices: ["minor", "major", "defining"] }),
      description:  new fields.HTMLField({ initial: "" }),

      // New — common to both variant rules
      subject:  new fields.StringField({ initial: "", blank: true }),
      positive: new fields.BooleanField({ initial: true }),

      // New — Classic 2e only (ignored by derived math when useIntimacyIntensity is true).
      // Both kept so toggling the world setting never loses data.
      strength: new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true })
    };
  }
}
