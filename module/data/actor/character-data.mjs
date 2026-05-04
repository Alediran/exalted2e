import { EX2E } from "../../config.mjs";
import { computeWoundPenalty } from "../../rolls/health-math.mjs";
import { computeTotalClarity, computePermanentClarity } from "../../combat/clarity-math.mjs";

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
      anima:           new fields.StringField({ initial: "none",  blank: false }),
      scenePeripheral: new fields.NumberField({ initial: 0, min: 0, integer: true }),

      // ── Attributes ─────────────────────────────────────────────────────────
      attributes: new fields.SchemaField({
        // Physical
        strength:     this.#attributeField(),
        dexterity:    this.#attributeField(),
        stamina:      this.#attributeField(),
        // Social
        charisma:     this.#attributeField(),
        manipulation: this.#attributeField(),
        appearance:   this.#attributeField(),
        // Mental
        perception:   this.#attributeField(),
        intelligence: this.#attributeField(),
        wits:         this.#attributeField()
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
      limit: new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),

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

      // ── Splat-specific traits ──────────────────────────────────────────────
      // Solar sub-namespace is intentionally empty: Limit is already on
      // CharacterData and Solars carry no other splat-level scalars.
      splat: new fields.SchemaField({
        solar:       new fields.SchemaField({}),
        lunar:       new fields.SchemaField({
          tell:               new fields.StringField({ initial: "", blank: true }),
          tellHidden:         new fields.BooleanField({ initial: false }),
          activeFormId:       new fields.StringField({ initial: "", blank: true }),
          spiritShapeFormId:  new fields.StringField({ initial: "", blank: true })
        }),
        terrestrial: new fields.SchemaField({}),
        sidereal:    new fields.SchemaField({
          paradox:    new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
          arcaneFate: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true })
        }),
        abyssal:     new fields.SchemaField({
          whispers: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true })
        }),
        infernal:    new fields.SchemaField({
          patron:        new fields.StringField({ initial: "", blank: true }),
          favoredYozi:   new fields.StringField({ initial: "", blank: true }),
          urge:          new fields.StringField({ initial: "", blank: true })
        }),
        alchemical: new fields.SchemaField({
          clarity: new fields.SchemaField({
            permanent: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
            total:     new fields.NumberField({ integer: true, min: 0, initial: 0 })
          }),
          dedicatedSlots: new fields.NumberField({ integer: true, min: 0, initial: 4 }),
          generalSlots:   new fields.NumberField({ integer: true, min: 0, initial: 4 })
        })
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

  /** Helper: schema for a single attribute (mirrors #abilityField shape, minus specialties / defaultAttribute). */
  static #attributeField(min = 1, max = 5) {
    return new fields.SchemaField({
      value:   new fields.NumberField({ initial: 1, min, max, integer: true }),
      caste:   new fields.BooleanField({ initial: false }),
      favored: new fields.BooleanField({ initial: false })
    });
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

  static #PERSONAL_BONUS   = [0, 1, 2, 3, 4, 5];
  static #PERIPHERAL_BONUS = [0, 2, 3, 5, 7, 9];
  static #ANIMA_REDUCTION  = [0, 0, 0, 0, 1, 2];

  // ── Derived Data ──────────────────────────────────────────────────────────

  prepareDerivedData() {
    this._applyActiveFormSubstitution(this);
    this._prepareWillpowerMinimum();
    this._prepareHealthData();
    this._prepareBreedingBonus();
    this._prepareCombatStats();
    this._prepareMoteMaxima();
    this._prepareIntimacies();
    this._prepareAlchemicalClarity();
    this._prepareAnimaLevel();
  }

  /**
   * Lunar shapeshift substitution: when an active Heart's Blood form is set,
   * the form's Strength / Dexterity / Stamina replace the Lunar's in-memory
   * values. Mental and social attributes are unchanged. Caste/favored flags
   * are preserved (only `value` is rewritten). RAW per Lunar splatbook:
   * direct replacement, no caps.
   *
   * Persisted `_source.system.attributes.<k>.value` keeps the human-guise
   * value; only the derived view shows the form's stats.
   */
  _applyActiveFormSubstitution(systemData) {
    if (this.exaltType !== "lunar") return;
    const formId = systemData.splat?.lunar?.activeFormId;
    if (!formId) return;
    const form = this.parent?.items?.get?.(formId);
    if (!form || form.type !== "form") return;
    const f = form.system?.attributes ?? {};
    for (const k of ["strength", "dexterity", "stamina"]) {
      const v = f[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        systemData.attributes[k].value = v;
      }
    }
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

  _prepareBreedingBonus() {
    if (this.exaltType !== "terrestrial") {
      this.breedingBonus = { rating: 0, personal: 0, peripheral: 0, animaReduction: 0 };
      return;
    }
    const bg = (this.parent?.items ?? []).find(
      i => i.type === "background" && i.flags?.exalted2e?.isBreeding === true
    );
    const rating = bg ? Math.max(0, Math.min(5, bg.system?.value ?? 0)) : 0;
    this.breedingBonus = {
      rating,
      personal:       CharacterData.#PERSONAL_BONUS[rating],
      peripheral:     CharacterData.#PERIPHERAL_BONUS[rating],
      animaReduction: CharacterData.#ANIMA_REDUCTION[rating]
    };
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
    h.woundPenalty   = computeWoundPenalty(filled, h.levelCounts);
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

    // MDVs always round DOWN — no Essence-2+ round-up, no errata variant.
    // The `halve` closure above branches on Essence for physical-DV
    // rules; do not reuse it here.
    const halveDown = (n) => Math.floor(n / 2);

    // Dodge MDV = (Willpower.max + Integrity + Essence) / 2, floored.
    // Integrity specialty is NOT baked in — it applies only when a
    // matching specialty fits the attack's context, handled at roll
    // time in a later session. Same convention as Dodge DV.
    this.dodgeMDV = halveDown(
      this.willpower.max + ab.integrity.value + this.essence.value
    );

    // Parry MDV: (max(Charisma, Manipulation) + social ability) / 2,
    // floored. Precomputed across the four valid social abilities so a
    // future Step-2 dialog can surface all choices; `best` is the
    // number the sheet shows today.
    const bestSocialAttr = Math.max(a.charisma.value, a.manipulation.value);
    this.parryMDV = {
      best:            0,
      byPresence:      halveDown(bestSocialAttr + (ab.presence?.value      ?? 0)),
      byPerformance:   halveDown(bestSocialAttr + (ab.performance?.value   ?? 0)),
      byInvestigation: halveDown(bestSocialAttr + (ab.investigation?.value ?? 0)),
      byBureaucracy:   halveDown(bestSocialAttr + (ab.bureaucracy?.value   ?? 0))
    };
    this.parryMDV.best = Math.max(
      this.parryMDV.byPresence,
      this.parryMDV.byPerformance,
      this.parryMDV.byInvestigation,
      this.parryMDV.byBureaucracy
    );
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
      case "terrestrial": {
        const virtues = [
          this.virtues.compassion.value,
          this.virtues.conviction.value,
          this.virtues.temperance.value,
          this.virtues.valor.value
        ].sort((a, b) => b - a);
        const highestVirtue = virtues[0];
        const twoHighest    = virtues[0] + virtues[1];
        const bp            = this.breedingBonus;
        personal   = ess + wp + highestVirtue + bp.personal;
        peripheral = (ess * 4) + wp + twoHighest + bp.peripheral;
        break;
      }
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

  _prepareIntimacies() {
    const parent = this.parent;
    if (!parent) return;
    // Principles don't count toward the Tie cap — canonical in 2.5e and a
    // defensible read of Classic 2e since Principles are long-term
    // self-conceptions rather than relationships.
    const all   = parent.items.filter(i => i.type === "intimacy");
    const ties  = all.filter(i => i.system?.intimacyType !== "principle");
    const count = ties.length;
    const cap   = (this.willpower?.max ?? 0) + (this.virtues?.compassion?.value ?? 0);

    this.intimacies = {
      count,
      cap,
      overCapacity: count > cap,
      maxStrength:  this.virtues?.conviction?.value ?? 0,
      useIntensity: game.settings.get("exalted2e", "useIntimacyIntensity")
    };
  }

  _prepareAlchemicalClarity() {
    if (this.exaltType !== "alchemical") return;
    if (!this.parent) return;
    const exemplarCount = this.parent.items.filter(
      i => i.type === "charm" && i.system.installed && i.system.keywords?.includes("Exemplar")
    ).length;
    const permanent = computePermanentClarity(this.essence.value, exemplarCount);
    this.splat.alchemical.clarity.permanent = permanent;
    this.splat.alchemical.clarity.total     = computeTotalClarity(permanent, this.limit);
  }

  _prepareAnimaLevel() {
    if (this.exaltType === "mortal") { this.anima = "none"; return; }
    const sp = this.scenePeripheral ?? 0;
    const T  = EX2E.ANIMA_THRESHOLDS;
    if      (sp >= T.totemic) this.anima = "totemic";
    else if (sp >= T.bonfire) this.anima = "bonfire";
    else if (sp >= T.burning) this.anima = "burning";
    else if (sp >= T.glowing) this.anima = "glowing";
    else if (sp >= T.dim)     this.anima = "dim";
    else                      this.anima = "none";
  }
}
