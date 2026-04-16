const fields = foundry.data.fields;

export class KnackData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Requirements ──────────────────────────────────────────────────
      essence:      new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
      prerequisites: new fields.StringField({ initial: "", blank: true }),

      // ── Keywords ──────────────────────────────────────────────────────
      keywords: new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Description ──────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
