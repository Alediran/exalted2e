const fields = foundry.data.fields;

/**
 * Data model for the "character" actor type (full Exalt / Mortal PC).
 */
export class CharacterData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {

      // ── Identity ───────────────────────────────────────────────────────────
      exaltType: new fields.StringField({ initial: "solar", blank: false }),
      caste:     new fields.StringField({ initial: "dawn",  blank: true  }),
      concept:   new fields.StringField({ initial: "",      blank: true  }),
      anima:     new fields.StringField({ initial: "none",  blank: false }),

      // ── Attributes ─────────────────────────────────────────────────────────
      attributes: new fields.SchemaField({
        // Physical
        strength:     new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        dexterity:    new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        stamina:      new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        // Social
        charisma:     new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        manipulation: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        appearance:   new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        // Mental
        perception:   new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        intelligence: new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) }),
        wits:         new fields.SchemaField({ value: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }) })
      }),

      // ── Abilities ──────────────────────────────────────────────────────────
      abilities: new fields.SchemaField({
        archery:       this.#abilityField("dexterity"),
        athletics:     this.#abilityField("stamina"),
        awareness:     this.#abilityField("perception"),
        bureaucracy:   this.#abilityField("intelligence"),
        craft:         this.#abilityField("intelligence"),
        dodge:         this.#abilityField("dexterity"),
        integrity:     this.#abilityField("manipulation"),
        investigation: this.#abilityField("wits"),
        larceny:       this.#abilityField("dexterity"),
        linguistics:   this.#abilityField("intelligence"),
        lore:          this.#abilityField("intelligence"),
        martialArts:   this.#abilityField("dexterity"),
        medicine:      this.#abilityField("intelligence"),
        melee:         this.#abilityField("dexterity"),
        occult:        this.#abilityField("intelligence"),
        performance:   this.#abilityField("charisma"),
        presence:      this.#abilityField("charisma"),
        resistance:    this.#abilityField("stamina"),
        ride:          this.#abilityField("stamina"),
        sail:          this.#abilityField("wits"),
        socialize:     this.#abilityField("charisma"),
        stealth:       this.#abilityField("dexterity"),
        survival:      this.#abilityField("stamina"),
        thrown:        this.#abilityField("dexterity"),
        war:           this.#abilityField("intelligence")
      }),

      // ── Virtues ────────────────────────────────────────────────────────────
      // value = permanent rating (round pips), current = temporal resource (square boxes)
      virtues: new fields.SchemaField({
        compassion: new fields.SchemaField({
          value:   new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current: new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true })
        }),
        conviction: new fields.SchemaField({
          value:   new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current: new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true })
        }),
        temperance: new fields.SchemaField({
          value:   new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current: new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true })
        }),
        valor: new fields.SchemaField({
          value:   new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          current: new fields.NumberField({ initial: 1, min: 0, max: 5, integer: true })
        })
      }),

      // ── Essence & Willpower ────────────────────────────────────────────────
      essence: new fields.SchemaField({
        value:    new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
        max:      new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true })
      }),
      willpower: new fields.SchemaField({
        value:    new fields.NumberField({ initial: 5, min: 0, max: 10, integer: true }),
        max:      new fields.NumberField({ initial: 10, min: 1, max: 10, integer: true })
      }),

      // ── Motes ─────────────────────────────────────────────────────────────
      motes: new fields.SchemaField({
        personal: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 13, min: 0, max: 100, integer: true }),
          max:       new fields.NumberField({ initial: 13, min: 0, max: 100, integer: true }),
          committed: new fields.NumberField({ initial: 0,  min: 0, max: 100, integer: true })
        }),
        peripheral: new fields.SchemaField({
          value:     new fields.NumberField({ initial: 33, min: 0, max: 100, integer: true }),
          max:       new fields.NumberField({ initial: 33, min: 0, max: 100, integer: true }),
          committed: new fields.NumberField({ initial: 0,  min: 0, max: 100, integer: true })
        })
      }),

      // ── Limit (for Solars / applicable Exalts) ─────────────────────────────
      limit: new fields.SchemaField({
        value:   new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
        trigger: new fields.StringField({ initial: "", blank: true })
      }),

      // ── Health ─────────────────────────────────────────────────────────────
      // damage: bashing (b), lethal (l), aggravated (a) – total boxes = 7 base
      health: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        bonus:      new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true })
      }),

      // ── Experience ─────────────────────────────────────────────────────────
      experience: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        total: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      // ── Biography / Notes ──────────────────────────────────────────────────
      biography:  new fields.HTMLField({ initial: "" }),
      notes:      new fields.HTMLField({ initial: "" }),
      motivation: new fields.StringField({ initial: "", blank: true })
    };
  }

  /** Helper: schema for a single ability */
  static #abilityField(defaultAttribute = "", min = 0, max = 5) {
    return new fields.SchemaField({
      value:            new fields.NumberField({ initial: 0, min: min, max: max, integer: true }),
      defaultAttribute: new fields.StringField({ initial: defaultAttribute, blank: true }),
      caste:            new fields.BooleanField({ initial: false }),
      favored:          new fields.BooleanField({ initial: false }),
      specialties:      new fields.ArrayField(new fields.SchemaField({
        name:  new fields.StringField({ initial: "", blank: true }),
        value: new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true })
      }))
    });
  }

  // ── Derived Data ──────────────────────────────────────────────────────────

  prepareDerivedData() {
    this._prepareWillpowerMinimum();
    this._prepareHealthData();
    this._prepareCombatStats();
    this._prepareMoteMaxima();
  }

  _prepareWillpowerMinimum() {
    // Permanent willpower minimum = sum of the two highest virtues
    const virts = [
      this.virtues.compassion.value,
      this.virtues.conviction.value,
      this.virtues.temperance.value,
      this.virtues.valor.value
    ].sort((a, b) => b - a);
    this.willpower.minPermanent = virts[0] + virts[1];
  }

  _prepareHealthData() {
    const h = this.health;
    const totalBoxes = 7 + h.bonus;
    const totalDamage = h.aggravated + h.lethal + h.bashing;
    h.totalBoxes = totalBoxes;
    h.totalDamage = Math.min(totalDamage, totalBoxes);

    // Wound penalty based on first filled box index
    const filled = Math.min(totalDamage, totalBoxes);
    const woundPenalties = [0, -1, -1, -2, -2, -4, null]; // null = incapacitated
    h.woundPenalty = woundPenalties[Math.min(filled, 6)] ?? null;
    h.incapacitated = filled >= totalBoxes;
  }

  _prepareCombatStats() {
    const a = this.attributes;
    const ab = this.abilities;
    // Dodge DV = (Dex + Dodge) / 2, round up
    this.dodgeDV    = Math.ceil((a.dexterity.value + ab.dodge.value) / 2);
    // Parry DV = (Dex + Ability + weapon defence) / 2 — base without weapon
    this.parryDVBase = Math.ceil(a.dexterity.value / 2);
    // Join Battle = Wits + Awareness
    this.joinBattle  = a.wits.value + ab.awareness.value;
    // Movement = Dex
    this.movement    = a.dexterity.value;
    // Dash = Dex + 3
    this.dash        = a.dexterity.value + 3;
    // Soak: natural soak = Stamina (bashing) / Stamina/2 round down (lethal)
    this.naturalSoak = {
      bashing: a.stamina.value,
      lethal:  Math.floor(a.stamina.value / 2),
      aggravated: 0
    };
  }

  _prepareMoteMaxima() {
    const ess  = this.essence.value;
    const wp   = this.willpower.max;
    const virtueSum = this.virtues.compassion.value
                    + this.virtues.conviction.value
                    + this.virtues.temperance.value
                    + this.virtues.valor.value;
    const maxVirtue = Math.max(
      this.virtues.compassion.value,
      this.virtues.conviction.value,
      this.virtues.temperance.value,
      this.virtues.valor.value
    );

    let personal, peripheral;

    switch (this.exaltType) {
      case "alchemical":
        personal   = (ess * 3) + wp;
        peripheral = (ess * 5) + (wp * 3) + (maxVirtue * 2);
        break;
      case "lunar":
        personal = ess + (wp * 2);
        peripheral = (ess * 4) + (wp * 2) + (maxVirtue * 4);
        break;
      case "terrestrial":        
        personal   = ess + wp;
        peripheral = (ess * 4) + wp + virtueSum;
        break;
      case "sidereal":
        personal   = (ess * 2) + wp;
        peripheral = (ess * 6) + wp + virtueSum;
        break;
      case "mortal":
        personal   = ess;
        peripheral = ess * 2;
        break;
      default:
        // Solar, Abyssal, Infernal
        personal   = (ess * 3) + wp;
        peripheral = (ess * 7) + wp + virtueSum;
        break;
    }

    this.motes.personal.max   = personal;
    this.motes.peripheral.max = peripheral;
  }
}
