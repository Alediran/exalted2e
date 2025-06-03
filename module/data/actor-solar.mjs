import { valueField } from "../template/data-schema.mjs";
import ExaltedSecondActorBase from "./base-actor.mjs";

export default class ExaltedSecondSolarCharacter extends ExaltedSecondActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    const result = {
      ...schema,
      personal: valueField(0, 0),
      peripheral: valueField(0, 0),
    };

    debugger;
    return result;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
  }

  getRollData() {
    const data = {};

    return data;
  }
}
