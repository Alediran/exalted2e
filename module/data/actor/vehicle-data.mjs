const fields = foundry.data.fields;

/**
 * Data model for the "vehicle" actor type — mounts, warstriders, ships, and
 * other conveyances used in mounted combat.
 */
export class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      vehicleType: new fields.StringField({
        initial: "mount",
        blank:   false,
        choices: ["mount", "warstrider", "ship", "other"],
      }),

      speed:           new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      maneuverability: new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),

      soak: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      }),
      hardness: new fields.NumberField({ initial: 0, min: 0, integer: true }),

      health: new fields.SchemaField({
        value: new fields.NumberField({ initial: 7, min: 0, integer: true }),
        max:   new fields.NumberField({ initial: 7, min: 1, integer: true }),
      }),

      essence: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
      }),

      attunement: new fields.SchemaField({
        cost:    new fields.NumberField({ initial: 0, min: 0, integer: true }),
        attuned: new fields.BooleanField({ initial: false }),
      }),

      description: new fields.HTMLField({ initial: "" }),
    };
  }
}
