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
      // + bonus boxes. Extra boxes are tracked per penalty level so charms
      // can grow specific tiers of the track. -4 and Incapacitated always
      // stay at one box each — only -0 / -1 / -2 accept bonuses.
      health: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        bonus: new fields.SchemaField({
          zero: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
          one:  new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
          two:  new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true })
        })
      }),

      // ── Experience ─────────────────────────────────────────────────────────
      experience: new fields.SchemaField({
        // `min: 0` relaxed so Purchase Mode's overdraft path can persist
        // negative values when a GM confirms a purchase that exceeds the
        // character's current XP. `total` stays clamped since it's
        // cumulative earned XP and cannot go negative.
        value: new fields.NumberField({ initial: 0, integer: true }),
        total: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      // ── Sorcery / Necromancy Initiation ────────────────────────────────────
      // initiation: 0 = uninitiated, 1 = Terrestrial / Shadowlands,
      //             2 = Celestial / Labyrinth, 3 = Solar / Void.
      // Alchemicals have the same tiers; their display label on the sheet
      // just swaps "Sorcery" → "Procedures" at the template layer.
      sorcery: new fields.SchemaField({
        initiation: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true })
      }),
      necromancy: new fields.SchemaField({
        initiation: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true })
      }),

      // ── Biography / Notes ──────────────────────────────────────────────────
      biography:  new fields.HTMLField({ initial: "" }),
      notes:      new fields.HTMLField({ initial: "" }),
      motivation: new fields.StringField({ initial: "", blank: true }),

      // ── Purchase Mode ─────────────────────────────────────────────────────
      // Per-actor toggle managed by the GM / Assistant GM via a header
      // button on the character sheet. When true, the sheet locks: field
      // reductions and XP-costing item deletions are rejected; field
      // increases and item creations open a Purchase-confirm dialog and
      // append to `purchaseLog`.
      purchaseLocked: new fields.BooleanField({ initial: false }),

      // Append-only ledger of trait purchases made while `purchaseLocked`
      // was true. Entries are kept forever unless a GM explicitly deletes
      // one via the Experience-tab UI (which also refunds the XP).
      purchaseLog: new fields.ArrayField(new fields.SchemaField({
        timestamp:  new fields.NumberField({ integer: true, required: true }),
        userId:     new fields.StringField({ initial: "", blank: true }),
        userName:   new fields.StringField({ initial: "", blank: true }),
        traitPath:  new fields.StringField({ initial: "", blank: true }),
        traitLabel: new fields.StringField({ initial: "", blank: true }),
        // `oldValue`/`newValue` are strings so the same schema handles
        // dot counts ("3"→"4"), item adds ("—"→"Added"), and any future
        // special values uniformly.
        oldValue:   new fields.StringField({ initial: "", blank: true }),
        newValue:   new fields.StringField({ initial: "", blank: true }),
        xpCost:     new fields.NumberField({ initial: 0, integer: true }),
        note:       new fields.StringField({ initial: "", blank: true })
      }))
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
    // Per-level box counts: -0, -1, -2 accept bonuses; -4 and Incap are
    // always a single box each regardless of charm / effect bonuses.
    const b = h.bonus ?? { zero: 0, one: 0, two: 0 };
    const zeroCount = 1 + (b.zero ?? 0);
    const oneCount  = 2 + (b.one  ?? 0);
    const twoCount  = 2 + (b.two  ?? 0);
    const totalBoxes  = zeroCount + oneCount + twoCount + 1 /* -4 */ + 1 /* Incap */;
    const totalDamage = h.aggravated + h.lethal + h.bashing;
    h.totalBoxes  = totalBoxes;
    h.totalDamage = Math.min(totalDamage, totalBoxes);
    // Cumulative counts so consumers (health-track helper, wound penalty)
    // can locate which level a given filled-box index belongs to.
    h.levelCounts = { zero: zeroCount, one: oneCount, two: twoCount };

    // Wound penalty = the penalty tier of the most-recently-filled box.
    const filled = Math.min(totalDamage, totalBoxes);
    let penalty  = 0;
    if      (filled > zeroCount + oneCount + twoCount + 1) penalty = null;   // Incap
    else if (filled > zeroCount + oneCount + twoCount)     penalty = -4;
    else if (filled > zeroCount + oneCount)                penalty = -2;
    else if (filled > zeroCount)                           penalty = -1;
    h.woundPenalty   = penalty;
    h.incapacitated  = filled >= totalBoxes;
  }

  _prepareCombatStats() {
    const a  = this.attributes;
    const ab = this.abilities;
    // Essence 2+ rounds DVs up, otherwise round down.
    const halve = (n) => this.essence.value > 1 ? Math.ceil(n / 2) : Math.floor(n / 2);

    // Dodge DV = (Dex + Dodge) / 2
    this.dodgeDV = halve(a.dexterity.value + ab.dodge.value + this.essence.value);

    // Parry DV — unarmed baseline uses Martial Arts, no weapon defence bonus.
    const meleeVal = ab.melee?.value        ?? 0;
    const maVal    = ab.martialArts?.value  ?? 0;
    this.parryDVBase = halve(a.dexterity.value + maVal);

    // Best weapon parry across all equipped melee modes:
    //   (Dex + (Melee | Martial Arts) + weapon defence) / 2
    // Martial Arts is used when the mode has the Natural tag (mandatory)
    // or the Martial Arts tag and MA exceeds Melee.
    let bestWeaponParry = 0;
    for (const item of this.parent?.items ?? []) {
      if (item.type !== "weapon" || !item.system.equipped) continue;
      for (const mode of item.system.modes ?? []) {
        if ((mode.effectiveRange ?? mode.range ?? 0) !== 0) continue;
        const hasNatural = mode.tags?.includes("Natural");
        const hasMA      = mode.tags?.includes("Martial Arts");
        const abilVal    = hasNatural ? maVal
                         : (hasMA && maVal > meleeVal) ? maVal
                         : meleeVal;
        const parry = halve(a.dexterity.value + abilVal + (mode.effectiveDefense ?? 0));
        if (parry > bestWeaponParry) bestWeaponParry = parry;
      }
    }
    this.parryDV = Math.max(this.parryDVBase, bestWeaponParry);

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
