import { resourceField } from "../template/data-schema.mjs";
import ExaltedSecondActorBase from "./base-actor.mjs";

export default class ExaltedSecondSolarCharacter extends ExaltedSecondActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    const result = {
      ...schema,
      limit: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        max: new fields.NumberField({ initial: 10 }),
        flaw: new fields.StringField({ initial: "" }),
      }),
      personal: resourceField(0, 0),
      peripheral: resourceField(0, 0),
    };

    return result;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    if (this.personal.max === 0) {
      //Calculates Solar Personal Pool Max
      const personal = this.essence.current * 3 + this.willpower.current;
      this.personal.max = personal;
    }

    if (this.peripheral.max === 0) {
      //Calculates Solar Peripheral Pool Max
      const peripheral =
        this.essence.current * 7 +
        this.willpower.current +
        this.virtues.compassion.current +
        this.virtues.conviction.current +
        this.virtues.temperance.current +
        this.virtues.valor.current;

      this.peripheral.max = peripheral;
    }
  }

  getRollData() {
    const data = {};

    return data;
  }
}
