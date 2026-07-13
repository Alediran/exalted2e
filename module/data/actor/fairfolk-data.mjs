const fields = foundry.data.fields;

// Grace → virtue mapping (used for display only)
export const GRACE_VIRTUE_MAP = { cup: "compassion", ring: "temperance", staff: "conviction", sword: "valor" };

// Grace → ability-caste mapping
export const GRACE_CASTE_ABILITIES = {
  cup:   ["linguistics", "occult", "ride", "socialize", "thrown"],
  ring:  ["investigation", "larceny", "medicine", "performance", "stealth"],
  sword: ["archery", "martialArts", "melee", "presence", "war"],
  staff: ["bureaucracy", "craft", "integrity", "lore", "resistance"],
  heart: ["athletics", "awareness", "dodge", "sail", "survival"]
};

function attrField() {
  return new fields.SchemaField({
    value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
  });
}

function abilField(defaultAttribute = "") {
  return new fields.SchemaField({
    value:            new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
    defaultAttribute: new fields.StringField({ initial: defaultAttribute, blank: true }),
    caste:            new fields.BooleanField({ initial: false }),
    specialties: new fields.ArrayField(new fields.SchemaField({
      name:  new fields.StringField({ initial: "", blank: true }),
      value: new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true })
    }))
  });
}

export class FairFolkData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      // ── Identity ─────────────────────────────────────────────────────────────
      concept:       new fields.StringField({ initial: "", blank: true }),
      motivation:    new fields.StringField({ initial: "", blank: true }),
      player:        new fields.StringField({ initial: "", blank: true }),
      rank:          new fields.StringField({ initial: "", blank: true, choices: ["", "noble", "heroicCommoner", "commoner"] }),
      caste:         new fields.StringField({ initial: "", blank: true, choices: ["", "cup", "ring", "sword", "staff", "heart"] }),
      shadowedCaste: new fields.StringField({ initial: "", blank: true, choices: ["", "cup", "ring", "sword", "staff", "heart"] }),
      court:         new fields.StringField({ initial: "", blank: true }),

      // ── Attributes ──────────────────────────────────────────────────────────
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
        // Diplomat (Cup Grace)
        linguistics:   abilField("intelligence"),
        occult:        abilField("intelligence"),
        ride:          abilField("stamina"),
        socialize:     abilField("charisma"),
        thrown:        abilField("dexterity"),
        // Entertainer (Ring Grace)
        investigation: abilField("wits"),
        larceny:       abilField("dexterity"),
        medicine:      abilField("intelligence"),
        performance:   abilField("charisma"),
        stealth:       abilField("dexterity"),
        // Warrior (Sword Grace)
        archery:       abilField("dexterity"),
        martialArts:   abilField("dexterity"),
        melee:         abilField("dexterity"),
        presence:      abilField("charisma"),
        war:           abilField("intelligence"),
        // Worker (Staff Grace)
        bureaucracy:   abilField("intelligence"),
        craft:         abilField("intelligence"),
        integrity:     abilField("manipulation"),
        lore:          abilField("intelligence"),
        resistance:    abilField("stamina"),
        // Casteless (Heart Grace)
        athletics:     abilField("stamina"),
        awareness:     abilField("perception"),
        dodge:         abilField("dexterity"),
        sail:          abilField("wits"),
        survival:      abilField("stamina")
      }),

      // ── Virtues ─────────────────────────────────────────────────────────────
      virtues: new fields.SchemaField({
        compassion: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current:   new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
          channeled: new fields.BooleanField({ initial: false })
        }),
        conviction: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current:   new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
          channeled: new fields.BooleanField({ initial: false })
        }),
        temperance: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current:   new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
          channeled: new fields.BooleanField({ initial: false })
        }),
        valor: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current:   new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true }),
          channeled: new fields.BooleanField({ initial: false })
        })
      }),

      // ── Graces ──────────────────────────────────────────────────────────────
      // Cup → Compassion, Ring → Temperance, Staff → Conviction, Sword → Valor
      // Grace soak = physical soak bonus from that Grace
      graces: new fields.SchemaField({
        cup:   new fields.SchemaField({ value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }), soak: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }) }),
        ring:  new fields.SchemaField({ value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }), soak: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }) }),
        staff: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }), soak: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }) }),
        sword: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }), soak: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }) }),
        heart: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }) })
      }),

      // ── Willpower ───────────────────────────────────────────────────────────
      willpower: new fields.SchemaField({
        value: new fields.NumberField({ initial: 5, min: 0, max: 10, integer: true }),
        max:   new fields.NumberField({ initial: 5, min: 1, max: 10, integer: true })
      }),

      // ── Essence ─────────────────────────────────────────────────────────────
      essence: new fields.SchemaField({
        value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
      }),

      // ── Motes ───────────────────────────────────────────────────────────────
      // Fair Folk have only a Personal pool (Essence × 10)
      motes: new fields.SchemaField({
        personal: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 0, min: 0, max: 200, integer: true }),
          max:       new fields.NumberField({ initial: 0, min: 0, max: 200, integer: true }),
          committed: new fields.NumberField({ initial: 0, min: 0, max: 200, integer: true })
        })
      }),

      // ── Gossamer pool ────────────────────────────────────────────────────────
      // No maximum — Fair Folk can accumulate unlimited Gossamer
      gossamer: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      // ── Soak ─────────────────────────────────────────────────────────────────
      soak: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 80, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 60, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 40, integer: true })
      }),

      // ── Health track ─────────────────────────────────────────────────────────
      health: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 500, integer: true }),
        totalBoxes: new fields.NumberField({ initial: 7,  min: 1, max: 500, integer: true })
      }),

      // ── Experience ───────────────────────────────────────────────────────────
      experience: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, integer: true }),
        total: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      purchaseLog: new fields.ArrayField(new fields.SchemaField({
        timestamp:  new fields.NumberField({ integer: true, required: true }),
        userId:     new fields.StringField({ initial: "", blank: true }),
        userName:   new fields.StringField({ initial: "", blank: true }),
        traitPath:  new fields.StringField({ initial: "", blank: true }),
        traitLabel: new fields.StringField({ initial: "", blank: true }),
        oldValue:   new fields.StringField({ initial: "", blank: true }),
        newValue:   new fields.StringField({ initial: "", blank: true }),
        xpCost:     new fields.NumberField({ initial: 0, integer: true }),
        note:       new fields.StringField({ initial: "", blank: true })
      })),

      trainingLedger: new fields.ArrayField(new fields.SchemaField({
        charmId:   new fields.StringField({ initial: "", blank: true }),
        charmName: new fields.StringField({ initial: "", blank: true }),
        img:       new fields.StringField({ initial: "", blank: true }),
        xpCost:    new fields.NumberField({ initial: 0, min: 0, integer: true }),
        startDate: new fields.NumberField({ initial: 0, integer: true })
      })),

      // ── Text ─────────────────────────────────────────────────────────────────
      biography: new fields.HTMLField({ initial: "" }),
      notes:     new fields.HTMLField({ initial: "" }),

      // ── XP / Purchase mode ───────────────────────────────────────────────────
      purchaseLocked: new fields.BooleanField({ initial: false })
    };
  }

  prepareDerivedData() {
    const ess = this.essence.value;
    this.motes.personal.max = ess * 10;

    const h = this.health;
    const totalDamage = h.aggravated + h.lethal + h.bashing;
    h.totalDamage   = Math.min(totalDamage, h.totalBoxes);
    h.incapacitated = h.totalDamage >= h.totalBoxes;
    const remaining = h.totalBoxes - totalDamage;
    h.woundPenalty  = h.incapacitated ? -4 : remaining <= 1 ? -2 : remaining <= 3 ? -1 : 0;
  }
}
