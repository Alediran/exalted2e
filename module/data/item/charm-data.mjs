const fields = foundry.data.fields;

export class CharmData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Identity ────────────────────────────────────────────────────────
      // Stable internal identifier assigned on creation (preCreateItem
      // hook in exalted2e.mjs) and via ready-time migration for
      // pre-existing charms. Used by the prereq-matching machinery so
      // renames don't break prerequisites.
      charmUid:     new fields.StringField({ initial: "", blank: true }),
      exaltType:    new fields.StringField({ initial: "solar", blank: true }),
      ability:      new fields.StringField({ initial: "melee", blank: true }),
      essence:      new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
      minAbility:   new fields.NumberField({ initial: 1, min: 0, max: 5,  integer: true }),

      // ── Cost ────────────────────────────────────────────────────────────
      cost: new fields.SchemaField({
        motes:            new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true }),
        willpower:        new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
        // Per-type health-level costs — each one inflicts that many damage
        // boxes of its kind on the caster when the charm activates. Some
        // charms (e.g. thaumaturgic rites, dark pacts) explicitly choose
        // which kind of wound they deal.
        bashingHealth:    new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
        lethalHealth:     new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
        aggravatedHealth: new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
        xp:               new fields.NumberField({ initial: 0, min: 0, max: 50, integer: true })
      }),

      // ── Type / Duration ──────────────────────────────────────────────────
      charmType:  new fields.StringField({ initial: "supplemental", blank: false }),
      duration:   new fields.StringField({ initial: "instant",      blank: false }),
      keywords:   new fields.ArrayField(new fields.StringField({ blank: true })),

      // Per-charm Unnatural Mental Influence base cost (RAW: 1–5 WP). Only
      // meaningful when keywords includes "Unnatural Mental Influence".
      // Aggregated across activated UMI charms in rollSocialAttack.
      umiCost: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),

      // ── Type-specific Options ────────────────────────────────────────────
      // Speed applies to Simple charms (default 6, some may be lower).
      speed:      new fields.NumberField({ initial: 6, min: 3, max: 6, integer: true }),
      // Steps apply to Reflexive charms — which attack-resolution steps (1–10)
      // the charm may be used in.
      steps:      new fields.ArrayField(
        new fields.NumberField({ min: 1, max: 9, integer: true })
      ),

      // ── Prerequisites ────────────────────────────────────────────────────
      // Each group is an AND; within a group, alternatives OR together. So
      // "X and Y" is two groups of one alt each; "X or Y" is one group with
      // two alts; "Any Excellency plus X" is two groups (an anyExcellency
      // group + a charm group). Matching is name-based, case-insensitive,
      // trimmed. `anyExcellency` alternatives are auto-scoped to the
      // hosting charm's own `ability` field.
      prereqGroups: new fields.ArrayField(new fields.SchemaField({
        alternatives: new fields.ArrayField(new fields.SchemaField({
          type:      new fields.StringField({
            initial: "charm",
            choices: ["charm", "anyExcellency"]
          }),
          // Canonical reference: the target charm's `system.charmUid`.
          // `charmName` is kept as a display label and as a name-based
          // fallback for prereqs authored before UIDs were in place.
          charmUid:  new fields.StringField({ initial: "", blank: true }),
          charmName: new fields.StringField({ initial: "", blank: true })
        }))
      })),

      // ── Description ──────────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" }),

      // ── Excellency ───────────────────────────────────────────────────────
      // "" = not an Excellency, "first" | "second" | "third" = which tier
      excellency: new fields.StringField({ initial: "", blank: true }),

      // ── Activation Tracking ──────────────────────────────────────────────
      active: new fields.BooleanField({ initial: false }),

      // ── Weapon-like Attack ────────────────────────────────────────────────
      // A few charms spawn weapon-ish effects (e.g. Glorious Solar Saber).
      // When `enabled` is true the charm carries its own attack stat line.
      // At activation time:
      //   - Instant duration   → roll the attack immediately; no item is left behind.
      //   - Longer durations   → create a weapon item on the actor + an AE that
      //                          tracks the lifetime; both vanish when the AE
      //                          is deleted (via charm deactivation, sheet
      //                          action, or Foundry's duration expiry).
      // Stat values are stored as strings so they can hold either a plain
      // integer ("3") or a formula ("@str + @essence / 2"). They get
      // resolved to integers in ExaltedItem#_buildCharmWeaponData using
      // the actor's roll data.
      attack: new fields.SchemaField({
        enabled:        new fields.BooleanField({ initial: false }),
        name:           new fields.StringField({ initial: "" }),
        speed:          new fields.StringField({ initial: "5" }),
        accuracy:       new fields.StringField({ initial: "0" }),
        damage:         new fields.StringField({ initial: "1" }),
        damageType:     new fields.StringField({ initial: "lethal", choices: ["bashing","lethal","aggravated"] }),
        overwhelming:   new fields.StringField({ initial: "1" }),
        defense:        new fields.StringField({ initial: "0" }),
        rate:           new fields.StringField({ initial: "1" }),
        range:          new fields.StringField({ initial: "0" }),
        minStrength:    new fields.StringField({ initial: "0" }),
        minDexterity:   new fields.StringField({ initial: "0" }),
        minMartialArts: new fields.StringField({ initial: "0" }),
        tags:           new fields.ArrayField(new fields.StringField({ blank: true }))
      })
    };
  }
}
