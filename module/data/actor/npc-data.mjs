const fields = foundry.data.fields;

/**
 * Data model for the "npc" actor type – simplified stats for antagonists,
 * spirits, demons, and supporting characters.
 */
export class NpcData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      // ── Identity ────────────────────────────────────────────────────────
      npcType:    new fields.StringField({ initial: "mortal", blank: false }),
      concept:    new fields.StringField({ initial: "",       blank: true  }),

      // ── Core Stats ──────────────────────────────────────────────────────
      essence: new fields.SchemaField({
        value: new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true })
      }),
      willpower: new fields.SchemaField({
        value: new fields.NumberField({ initial: 3, min: 0, max: 10, integer: true }),
        max:   new fields.NumberField({ initial: 3, min: 1, max: 10, integer: true })
      }),
      motes: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, max: 200, integer: true }),
        max:   new fields.NumberField({ initial: 0, min: 0, max: 200, integer: true })
      }),

      // ── Pools (simplified: just the final dice pool values) ──────────────
      pools: new fields.SchemaField({
        combat:   new fields.NumberField({ initial: 5, min: 0, max: 30, integer: true }),
        social:   new fields.NumberField({ initial: 3, min: 0, max: 30, integer: true }),
        physical: new fields.NumberField({ initial: 4, min: 0, max: 30, integer: true })
      }),

      // ── Combat ──────────────────────────────────────────────────────────
      combat: new fields.SchemaField({
        joinBattle: new fields.NumberField({ initial: 4, min: 0, max: 20, integer: true }),
        dodgeDV:    new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        parryDV:    new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        dodgeMDV:   new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        parryMDV:   new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        soak: new fields.SchemaField({
          bashing:    new fields.NumberField({ initial: 3, min: 0, max: 20, integer: true }),
          lethal:     new fields.NumberField({ initial: 1, min: 0, max: 20, integer: true }),
          aggravated: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true })
        }),
        hardness:   new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true })
      }),

      // ── Health ──────────────────────────────────────────────────────────
      health: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true }),
        totalBoxes: new fields.NumberField({ initial: 7, min: 1, max: 50, integer: true })
      }),

      // ── Powers / Notes ──────────────────────────────────────────────────
      powers:   new fields.HTMLField({ initial: "" }),
      notes:    new fields.HTMLField({ initial: "" }),
      biography: new fields.HTMLField({ initial: "" }),

      // ── XP / Purchase Mode ──────────────────────────────────────────────
      purchaseLocked: new fields.BooleanField({ initial: false })
    };
  }

  prepareDerivedData() {
    const h = this.health;
    const totalDamage = h.aggravated + h.lethal + h.bashing;
    h.totalDamage = Math.min(totalDamage, h.totalBoxes);
    h.incapacitated = h.totalDamage >= h.totalBoxes;
  }
}
