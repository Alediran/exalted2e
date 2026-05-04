const fields = foundry.data.fields;

export class UrgeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ initial: "" }),
    };
  }
}
