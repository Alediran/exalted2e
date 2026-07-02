const fields = foundry.data.fields;

export class AmmoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ammoType:    new fields.StringField({ initial: "arrows", choices: ["arrows", "firedust"] }),
      quantity:    new fields.NumberField({ initial: 0, min: 0, integer: true }),
      damageBonus: new fields.NumberField({ initial: 0, integer: true }),
      damageType:  new fields.StringField({ initial: "lethal", choices: ["lethal", "bashing", "aggravated"] }),
      soakMod:     new fields.StringField({ initial: "normal", choices: ["normal", "doubled", "halved"] }),
    };
  }
}
