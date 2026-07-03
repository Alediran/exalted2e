import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class AnimaPowerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      exaltType:  new fields.StringField({ initial: "solar", blank: true }),
      caste:      new fields.StringField({ initial: "",      blank: true }),
      summary:    new fields.StringField({ initial: "",      blank: true }),
      active:     new fields.BooleanField({ initial: false }),

      activationCost: new fields.SchemaField({
        motes:     new fields.NumberField({ initial: 5, min: 0, integer: true }),
        willpower: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      bonfireOverride: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        motes:   new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),
      totemicOverride: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        motes:   new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      autoThreshold: new fields.StringField({ initial: "", blank: true }),
      isGreaterSign: new fields.BooleanField({ initial: false }),
      description:   new fields.HTMLField({ initial: "" }),
      descriptions:  descriptionsField()
    };
  }
}
