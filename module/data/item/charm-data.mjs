const fields = foundry.data.fields;

export class CharmData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Identity ────────────────────────────────────────────────────────
      exaltType:    new fields.StringField({ initial: "solar", blank: true }),
      ability:      new fields.StringField({ initial: "melee", blank: true }),
      essence:      new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
      minAbility:   new fields.NumberField({ initial: 1, min: 0, max: 5,  integer: true }),

      // ── Cost ────────────────────────────────────────────────────────────
      cost: new fields.SchemaField({
        motes:      new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true }),
        willpower:  new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
        healthLevels: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
        xp:         new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true })
      }),

      // ── Type / Duration ──────────────────────────────────────────────────
      charmType:  new fields.StringField({ initial: "supplemental", blank: false }),
      duration:   new fields.StringField({ initial: "instant",      blank: false }),
      keywords:   new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Type-specific Options ────────────────────────────────────────────
      // Speed applies to Simple charms (default 6, some may be lower).
      speed:      new fields.NumberField({ initial: 6, min: 3, max: 6, integer: true }),
      // Steps apply to Reflexive charms — which attack-resolution steps (1–10)
      // the charm may be used in.
      steps:      new fields.ArrayField(
        new fields.NumberField({ min: 1, max: 9, integer: true })
      ),

      // ── Prerequisites ────────────────────────────────────────────────────
      prerequisites: new fields.StringField({ initial: "", blank: true }),

      // ── Description ──────────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" }),

      // ── Excellency ───────────────────────────────────────────────────────
      // "" = not an Excellency, "first" | "second" | "third" = which tier
      excellency: new fields.StringField({ initial: "", blank: true }),

      // ── Activation Tracking ──────────────────────────────────────────────
      active: new fields.BooleanField({ initial: false })
    };
  }
}
