const fields = foundry.data.fields;

export class DiseaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      morbidity:   new fields.NumberField({ initial: 1, min: 0, max: 10, integer: true }),
      trauma:      new fields.StringField({ initial: "", blank: true }),
      duration:    new fields.StringField({ initial: "", blank: true }),
      vector:      new fields.StringField({ initial: "", blank: true }),
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
