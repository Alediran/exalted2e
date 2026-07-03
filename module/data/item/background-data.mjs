import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      value:          new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
      backgroundType: new fields.StringField({ blank: true, initial: "" }),
      description:    new fields.HTMLField({ initial: "" }),
      descriptions:   descriptionsField(),
      notes:          new fields.StringField({ initial: "", blank: true }),
      house:          new fields.StringField({ initial: "", blank: true }),
      isMonstrance:   new fields.BooleanField({ initial: false }),
      deathlord:      new fields.StringField({ initial: "", blank: true }),
      linkedActorId:  new fields.StringField({ initial: "", blank: true })
    };
  }
}
