const fields = foundry.data.fields;

export class MansePowerData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cost:          new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      aspectFavored: new fields.ArrayField(new fields.StringField({ blank: false })),
      onlyAspect:    new fields.ArrayField(new fields.StringField({ blank: false })),
      abilityReq:    new fields.StringField({ blank: true, initial: "" }),
      multiPurchase: new fields.BooleanField({ initial: false }),
      isMaterial:    new fields.BooleanField({ initial: false }),
      description:   new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
