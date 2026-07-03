import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class ManseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      backgroundId:  new fields.StringField({ blank: true, initial: "" }),
      hearthstoneId: new fields.StringField({ blank: true, initial: "" }),
      maintenance:           new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
      fragility:             new fields.NumberField({ integer: true, min: 0, max: 3, initial: 0 }),
      habitabilityReduction: new fields.NumberField({ integer: true, min: 0, max: 3, initial: 0 }),
      hearthstoneReduction:  new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      designBeyondLimit:     new fields.BooleanField({ initial: false }),
      capped:        new fields.BooleanField({ initial: false }),
      damage:        new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      powerFailures: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      powers:        new fields.ArrayField(
        new fields.SchemaField({
          name:       new fields.StringField({ blank: true, initial: "" }),
          cost:       new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
          isMaterial: new fields.BooleanField({ initial: false }),
          status:     new fields.StringField({ choices: ["pending", "designed", "damaged"], initial: "pending", blank: false })
        })
      ),
      description:   new fields.HTMLField({ blank: true, initial: "" }),
      descriptions:  descriptionsField()
    };
  }
}
