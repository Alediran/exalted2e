const fields = foundry.data.fields;

export class ManseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      backgroundId:  new fields.StringField({ blank: true, initial: "" }),
      hearthstoneId: new fields.StringField({ blank: true, initial: "" }),
      powers:        new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ blank: true, initial: "" }),
          cost: new fields.NumberField({ integer: true, min: 0, max: 3, initial: 1 })
        })
      ),
      description:   new fields.HTMLField({ blank: true, initial: "" })
    };
  }
}
