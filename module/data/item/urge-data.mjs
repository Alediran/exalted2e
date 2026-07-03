import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class UrgeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
    };
  }
}
