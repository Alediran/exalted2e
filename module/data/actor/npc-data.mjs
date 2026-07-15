const fields = foundry.data.fields;

function attrField() {
  return new fields.SchemaField({
    value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
  });
}

function abilField() {
  return new fields.SchemaField({
    value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true })
  });
}

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
      isExtra:    new fields.BooleanField({ initial: false }),

      // ── Attributes ─────────────────────────────────────────────────────────
      attributes: new fields.SchemaField({
        strength:     attrField(),
        dexterity:    attrField(),
        stamina:      attrField(),
        charisma:     attrField(),
        manipulation: attrField(),
        appearance:   attrField(),
        perception:   attrField(),
        intelligence: attrField(),
        wits:         attrField()
      }),

      // ── Abilities ───────────────────────────────────────────────────────────
      abilities: new fields.SchemaField({
        archery:       abilField(),
        athletics:     abilField(),
        awareness:     abilField(),
        bureaucracy:   abilField(),
        craft:         abilField(),
        dodge:         abilField(),
        integrity:     abilField(),
        investigation: abilField(),
        larceny:       abilField(),
        linguistics:   abilField(),
        lore:          abilField(),
        martialArts:   abilField(),
        medicine:      abilField(),
        melee:         abilField(),
        occult:        abilField(),
        performance:   abilField(),
        presence:      abilField(),
        resistance:    abilField(),
        ride:          abilField(),
        sail:          abilField(),
        socialize:     abilField(),
        stealth:       abilField(),
        survival:      abilField(),
        thrown:        abilField(),
        war:           abilField()
      }),

      // ── Core Stats ──────────────────────────────────────────────────────
      essence: new fields.SchemaField({
        value: new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true })
      }),
      willpower: new fields.SchemaField({
        value: new fields.NumberField({ initial: 5, min: 0, max: 10, integer: true }),
        max:   new fields.NumberField({ initial: 5, min: 1, max: 10, integer: true })
      }),
      motes: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, max: 2000, integer: true }),
        max:   new fields.NumberField({ initial: 0, min: 0, max: 2000, integer: true })
      }),

      // ── Pools (simplified: just the final dice pool values) ──────────────
      pools: new fields.SchemaField({
        combat:   new fields.NumberField({ initial: 5, min: 0, max: 50, integer: true }),
        social:   new fields.NumberField({ initial: 3, min: 0, max: 50, integer: true }),
        physical: new fields.NumberField({ initial: 4, min: 0, max: 50, integer: true })
      }),

      // ── Combat ──────────────────────────────────────────────────────────
      combat: new fields.SchemaField({
        joinBattle:   new fields.NumberField({ initial: 4, min: 0, max: 40, integer: true }),
        dodgeDV:      new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        parryDV:      new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        dodgeMDV:     new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        parryMDV:     new fields.NumberField({ initial: 2, min: 0, max: 15, integer: true }),
        soak: new fields.SchemaField({
          bashing:    new fields.NumberField({ initial: 3, min: 0, max: 80, integer: true }),
          lethal:     new fields.NumberField({ initial: 1, min: 0, max: 60, integer: true }),
          aggravated: new fields.NumberField({ initial: 0, min: 0, max: 40, integer: true })
        }),
        hardness:     new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        woundPenalty: new fields.NumberField({ initial: 0, min: 0, max: 4,  integer: true })
      }),

      // ── Health ──────────────────────────────────────────────────────────
      health: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        totalBoxes: new fields.NumberField({ initial: 7, min: 1, max: 500, integer: true })
      }),

      // ── Powers / Notes ──────────────────────────────────────────────────
      powers:   new fields.HTMLField({ initial: "" }),
      notes:    new fields.HTMLField({ initial: "" }),
      biography: new fields.HTMLField({ initial: "" }),

      // ── Attacks (structured for roll pipeline) ───────────────────────────
      attacks: new fields.ArrayField(new fields.SchemaField({
        name:   new fields.StringField({ initial: "Attack", blank: false }),
        pool:   new fields.NumberField({ initial: 5,   min: 0, max: 50, integer: true }),
        damage: new fields.StringField({ initial: "5L", blank: false }),
        speed:  new fields.NumberField({ initial: 5,   min: 1, max: 10, integer: true }),
        rate:   new fields.NumberField({ initial: 1,   min: 1, max: 10, integer: true })
      })),

      // ── XP / Purchase Mode ──────────────────────────────────────────────
      purchaseLocked: new fields.BooleanField({ initial: false })
    };
  }

  prepareDerivedData() {
    const h = this.health;
    const totalDamage = h.aggravated + h.lethal + h.bashing;

    if (this.isExtra) {
      // Extras have 3 health levels: −0, −1, −3 / Inc
      h.totalBoxes    = 3;
      h.totalDamage   = Math.min(totalDamage, 3);
      h.incapacitated = totalDamage >= 3;
      h.woundPenalty  = totalDamage >= 3 ? 3 : totalDamage >= 2 ? 1 : 0;
    } else {
      h.totalDamage   = Math.min(totalDamage, h.totalBoxes);
      h.incapacitated = h.totalDamage >= h.totalBoxes;
      h.woundPenalty  = this.combat?.woundPenalty ?? 0;
    }
  }
}
