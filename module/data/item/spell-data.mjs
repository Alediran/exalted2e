const fields = foundry.data.fields;

/**
 * SpellData — Sorcery and Necromancy spells share this unified schema.
 *
 * The `tradition` field discriminates the two systems:
 *   • "sorcery"    — Terrestrial (1), Celestial (2), Solar (3) circles.
 *                    Alchemicals call their sorcery "Procedures"; that's
 *                    only a display-name swap on the character sheet and
 *                    lives in the sheet layer, not here.
 *   • "necromancy" — Shadowlands (1), Labyrinth (2), Void (3) circles.
 *
 * Cost + duration mirror CharmData so the chat-card and activation-
 * ledger machinery built for charms can resolve spell casts without a
 * parallel pipeline.
 */
export class SpellData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Identity ────────────────────────────────────────────────────────
      // Stable uid, paired with the same migration that back-fills charm
      // uids on world load. Handy if spells ever show up as prereqs.
      spellUid:   new fields.StringField({ initial: "", blank: true }),
      tradition:  new fields.StringField({
        initial: "sorcery",
        choices: ["sorcery", "necromancy"]
      }),
      circle:     new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true }),

      // ── Cost ────────────────────────────────────────────────────────────
      // Same shape as CharmData.cost so the shared spend-and-reverse
      // ledger handles both without branching.
      cost: new fields.SchemaField({
        motes:            new fields.NumberField({ initial: 15, min: 0, max: 100, integer: true }),
        willpower:        new fields.NumberField({ initial: 1,  min: 0, max: 5,   integer: true }),
        bashingHealth:    new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        lethalHealth:     new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        aggravatedHealth: new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        xp:               new fields.NumberField({ initial: 0,  min: 0, max: 50,  integer: true })
      }),

      // ── Duration / Target ─────────────────────────────────────────────
      duration:   new fields.StringField({ initial: "instant", blank: false }),
      target:     new fields.StringField({ initial: "", blank: true }),

      // ── Description ────────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" })
    };
  }
}
