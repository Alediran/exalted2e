import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class MartialArtsStyleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier:            new fields.StringField({ initial: "terrestrial", blank: false, choices: ["terrestrial", "celestial", "sidereal"] }),
      nativeExaltType: new fields.StringField({ initial: "", blank: true }),
      weapons:         new fields.ArrayField(new fields.StringField({ blank: false })),
      allowsArmor:     new fields.BooleanField({ initial: true }),
      description:     new fields.HTMLField({ initial: "" }),
      descriptions:    descriptionsField()
    };
  }
}
