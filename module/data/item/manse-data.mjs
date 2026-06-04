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
      powers:        new fields.ArrayField(
        new fields.SchemaField({
          name:       new fields.StringField({ blank: true, initial: "" }),
          cost:       new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
          isMaterial: new fields.BooleanField({ initial: false })
        })
      ),
      description:   new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
