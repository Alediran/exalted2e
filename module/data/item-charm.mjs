import { costField } from "../template/data-schema.mjs";
import ExaltedSecondItemBase from "./base-item.mjs";

export default class ExaltedSecondItemCharm extends ExaltedSecondItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    const result = {
      ...schema,
      cost: costField(),
      requirements: [],
      type: new fields.StringField({ initial: "" }),
      keywords: [],
      duration: new fields.StringField({ initial: "" }),
      prerequisite: [],
    };
    return schema;
  }

  getRollData() {
    const data = {};

    return data;
  }
}
