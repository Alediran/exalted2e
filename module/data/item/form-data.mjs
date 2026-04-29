const fields = foundry.data.fields;

/**
 * Data model for the `form` item type — a Lunar Heart's Blood entry.
 * Stores the source creature/character's stats so the active form can
 * be applied by a future shapeshift action.
 */
export class FormData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      formType: new fields.StringField({
        initial: "animal",
        choices: ["human", "animal", "beast", "spirit", "wyldborn"]
      }),
      attributes: new fields.SchemaField({
        strength:     new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        dexterity:    new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        stamina:      new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        charisma:     new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        manipulation: new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        appearance:   new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        perception:   new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        intelligence: new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        wits:         new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true })
      }),
      tags: new fields.ArrayField(new fields.StringField({ blank: true })),
      mutations: new fields.ArrayField(new fields.SchemaField({
        name:        new fields.StringField({ blank: true }),
        category:    new fields.StringField({
          initial: "pox",
          choices: ["pox", "affliction", "blight", "abomination"]
        }),
        description: new fields.StringField({ blank: true })
      })),
      source:      new fields.StringField({ blank: true }),
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
