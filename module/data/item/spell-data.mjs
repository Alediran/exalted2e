import { descriptionsField } from "./_shared/descriptions-field.mjs";

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
        choices: ["sorcery", "necromancy", "weaving"]
      }),
      circle:     new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true }),
      minimumClarity: new fields.NumberField({ initial: 0, min: 0, integer: true }),

      // ── Cost ────────────────────────────────────────────────────────────
      // Same shape as CharmData.cost so the shared spend-and-reverse
      // ledger handles both without branching.
      // cost.motes is a StringField so it can hold either a plain number
      // ("15") or a display formula ("15m" / "Essence × 5"). The numeric
      // value is extracted via parseMotesFormula() before spending.
      cost: new fields.SchemaField({
        motes:            new fields.StringField({ initial: "15m", blank: false }),
        willpower:        new fields.NumberField({ initial: 1,  min: 0, max: 5,   integer: true }),
        bashingHealth:    new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        lethalHealth:     new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        aggravatedHealth: new fields.NumberField({ initial: 0,  min: 0, max: 5,   integer: true }),
        xp:               new fields.NumberField({ initial: 0,  min: 0, max: 50,  integer: true })
      }),

      // ── Duration / Target / Range ────────────────────────────────────
      duration:   new fields.StringField({ initial: "instant", blank: false }),
      target:     new fields.StringField({ initial: "", blank: true }),
      range:      new fields.StringField({ initial: "", blank: true }),

      // ── Description ────────────────────────────────────────────────────
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
      countermagicImmune: new fields.BooleanField({ initial: false }),
      // Set true on the countermagic spells (Emerald/Sapphire/Adamant,
      // Iron/Onyx/Obsidian) so buildEligibleCharms can find them.
      // Tier is derived from system.circle; tradition from system.tradition.
      // countermagicTradition overrides the eligibility tradition when the
      // spell crosses traditions (e.g. Onyx/Obsidian → "both").
      isCountermagic:        new fields.BooleanField({ initial: false }),
      countermagicTradition: new fields.StringField({ initial: "", blank: true }),
      // "" = normal spell; "ghost-summoning" / "demon-summoning" = special cast flow
      spellSubtype:          new fields.StringField({ initial: "", blank: true, choices: ["", "ghost-summoning", "demon-summoning"] }),

      // ── Spell Attack ──────────────────────────────────────────────────────
      // Configuration for direct-damage spells (e.g. Death of Obsidian
      // Butterflies). When enabled, a Roll Attack button appears in the header
      // and the Effects tab shows the attack configuration panel.
      spellAttack: new fields.SchemaField({
        enabled:      new fields.BooleanField({ initial: false }),
        pool:         new fields.StringField({ initial: "@wits + @occult", blank: false }),
        accuracy:     new fields.NumberField({ initial: 0, integer: true }),
        damage:       new fields.StringField({ initial: "@ess", blank: false }),
        damageType:   new fields.StringField({ initial: "lethal", choices: ["bashing","lethal","aggravated"] }),
        ignoresArmor: new fields.BooleanField({ initial: false }),
        overwhelming: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        tags:         new fields.ArrayField(new fields.StringField()),
        area: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          shape:   new fields.StringField({ initial: "circle", choices: ["circle","ring","emanation","cone","rect","ray"] }),
          size:    new fields.StringField({ initial: "5", blank: false }),
        })
      }),
    };
  }
}
