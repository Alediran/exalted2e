const fields = foundry.data.fields;

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      resourcesCost: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
      quantity:      new fields.NumberField({ initial: 1, min: 1, max: 999, integer: true }),
      description:   new fields.HTMLField({ initial: "" }),
      equipped:      new fields.BooleanField({ initial: false })
    };
  }
}
