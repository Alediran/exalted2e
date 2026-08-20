const fields = foundry.data.fields;

function attrField() {
  return new fields.SchemaField({
    value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
  });
}

function abilField() {
  return new fields.SchemaField({
    value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
    specialties: new fields.ArrayField(new fields.SchemaField({
      name:  new fields.StringField({ initial: '', blank: true }),
      value: new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true })
    }), { initial: [] })
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
      npcType:    new fields.StringField({ initial: "god", blank: false }),
      concept:    new fields.StringField({ initial: "",    blank: true }),
      motivation: new fields.StringField({ initial: "",    blank: true }),
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

      // ── Virtues ─────────────────────────────────────────────────────────────
      virtues: new fields.SchemaField({
        compassion: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
        conviction:  new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
        temperance:  new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
        valor:       new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
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
        levels: new fields.SchemaField({
          zero: new fields.NumberField({ initial: 1, min: 0, max: 100, integer: true }),
          one:  new fields.NumberField({ initial: 2, min: 0, max: 100, integer: true }),
          two:  new fields.NumberField({ initial: 2, min: 0, max: 100, integer: true }),
          four: new fields.NumberField({ initial: 1, min: 0, max: 100, integer: true })
        })
      }),

      // ── Powers / Notes ──────────────────────────────────────────────────
      powers:   new fields.HTMLField({ initial: "" }),
      notes:    new fields.HTMLField({ initial: "" }),
      biography: new fields.HTMLField({ initial: "" }),
      sanctum:   new fields.HTMLField({ initial: "" }),
      summoning: new fields.HTMLField({ initial: "" }),
      languages: new fields.ArrayField(new fields.StringField({ initial: "", blank: true }), { initial: [] }),

      // ── Attacks (structured for roll pipeline) ───────────────────────────
      attacks: new fields.ArrayField(new fields.SchemaField({
        name:    new fields.StringField({ initial: "Attack", blank: false }),
        label:   new fields.StringField({ initial: "",       blank: true  }),
        pool:    new fields.NumberField({ initial: 5,   min: 0,  max: 50,  integer: true }),
        damage:  new fields.StringField({ initial: "5L", blank: false }),
        speed:   new fields.NumberField({ initial: 5,   min: 1,  max: 10,  integer: true }),
        rate:    new fields.NumberField({ initial: 1,   min: 1,  max: 10,  integer: true }),
        parryDV: new fields.NumberField({ initial: -1,  min: -1, max: 15,  integer: true }),
        range:   new fields.NumberField({ initial: 0,   min: 0,  max: 200, integer: true })
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
      const lvl     = h.levels ?? { zero: 1, one: 2, two: 2, four: 1 };
      h.levelCounts = { zero: lvl.zero, one: lvl.one, two: lvl.two, four: lvl.four };
      h.totalBoxes  = lvl.zero + lvl.one + lvl.two + lvl.four + 1; // +1 for Inc
      h.totalDamage = Math.min(totalDamage, h.totalBoxes);
      h.incapacitated = h.totalDamage >= h.totalBoxes;
      h.woundPenalty  = this.combat?.woundPenalty || _npcWoundPenalty(h.totalDamage, lvl);
    }
  }
}

function _npcWoundPenalty(damage, levels) {
  const { zero = 1, one = 2, two = 2, four = 1 } = levels;
  const tiers = [
    { boxes: zero, penalty: 0 },
    { boxes: one,  penalty: 1 },
    { boxes: two,  penalty: 2 },
    { boxes: four, penalty: 4 },
  ];
  let filled = 0;
  for (const { boxes, penalty } of tiers) {
    filled += boxes;
    if (damage <= filled) return penalty;
  }
  return 0;
}
