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
      // charmUids of the other versions of this charm in alternate ability trees.
      // Purchasing any one version grants all others automatically.
      mergedIds:    new fields.ArrayField(new fields.StringField({ blank: true }), { initial: [] }),
      exaltType:    new fields.StringField({ initial: "solar", blank: true }),
      ability:         new fields.StringField({ initial: "melee", blank: true }),
      yoziPatron:      new fields.StringField({ initial: "", blank: true }),
      martialArtsTier: new fields.StringField({ initial: "", blank: true }),
      essence:         new fields.NumberField({ initial: 1, min: 1, max: 10, integer: true }),
      minAbility:   new fields.NumberField({ initial: 1, min: 0, max: 5,  integer: true }),

      // ── Cost ────────────────────────────────────────────────────────────
      // Single DSL formula string encodes all activation costs.
      // See docs/superpowers/specs/2026-05-15-cost-formula-dsl-design.md
      cost: new fields.SchemaField({
        formula:      new fields.StringField({ initial: "", blank: true }),
        // Non-formula metadata (not part of activation cost)
        resonance:    new fields.NumberField({ initial: 0, min: 0, max: 10, integer: true }),
        limitTrigger: new fields.NumberField({ initial: 0, min: 0, max: 3,  integer: true })
      }),

      // ── Type / Duration ──────────────────────────────────────────────────
      charmType:  new fields.StringField({ initial: "supplemental", blank: false }),
      duration:   new fields.StringField({ initial: "instant",      blank: false }),
      keywords:   new fields.ArrayField(new fields.StringField({ blank: true })),

      // Per-charm Unnatural Mental Influence base cost (RAW: 1–5 WP). Only
      // meaningful when keywords includes "Unnatural Mental Influence".
      // Aggregated across activated UMI charms in rollSocialAttack.
      umiCost: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),

      // Per-supporter bonus dice for Cooperative charms. Set to 0 for area/utility
      // charms whose cooperation bonus isn't a simple dice addition.
      cooperationBonusDice: new fields.NumberField({ initial: 0, integer: true, min: 0 }),

      // ── Type-specific Options ────────────────────────────────────────────
      // Speed applies to Simple charms (default 6, some may be lower).
      speed:      new fields.NumberField({ initial: 6, min: 3, max: 6, integer: true }),
      // Steps apply to Reflexive charms — which attack-resolution steps (1–10)
      // the charm may be used in.
      steps:      new fields.ArrayField(
        new fields.NumberField({ min: 1, max: 9, integer: true })
      ),

      dvPenalty:            new fields.NumberField({ initial: -1, min: -3, max: 0, integer: true }),
      maidenAffiliation:    new fields.StringField({ initial: "", blank: true }),
      martialArtsStyleName: new fields.StringField({ initial: "", blank: true }),
      martialArtsElement:   new fields.StringField({ initial: "", blank: true }),
      grantsMastery:        new fields.BooleanField({ initial: false }),
      durationFormula:      new fields.StringField({ initial: "", blank: true }),
      // charmUid of the Solar charm this Abyssal (or other splat) charm mirrors.
      // The Mirror keyword indicates it exists; this field provides the stable link.
      mirrorId:             new fields.StringField({ initial: "", blank: true }),
      stackCount:           new fields.NumberField({ initial: 0, min: 0, integer: true }),

      // ── Prerequisites ────────────────────────────────────────────────────
      // Each group is an AND; within a group, alternatives OR together. So
      // "X and Y" is two groups of one alt each; "X or Y" is one group with
      // two alts; "Any Excellency plus X" is two groups (an anyExcellency
      // group + a charm group). Matching is name-based, case-insensitive,
      // trimmed. `anyExcellency` alternatives are auto-scoped to the
      // hosting charm's own `ability` field.
      prereqGroups: new fields.ArrayField(new fields.SchemaField({
        alternatives: new fields.ArrayField(new fields.SchemaField({
          type: new fields.StringField({
            initial: "charm",
            choices: ["charm", "anyExcellency", "virtue"]
          }),
          // Canonical reference: the target charm's `system.charmUid`.
          // `charmName` is kept as a display label and as a name-based
          // fallback for prereqs authored before UIDs were in place.
          charmUid:  new fields.StringField({ initial: "", blank: true }),
          charmName: new fields.StringField({ initial: "", blank: true }),
          // For anyExcellency alts: when non-empty, checks this ability instead
          // of the hosting charm's own ability. Used for cross-ability prereqs
          // (e.g. "Any Perception Excellency" on a Lore charm).
          abilityKey: new fields.StringField({ initial: "", blank: true }),
          virtueKey: new fields.StringField({ initial: "valor", blank: true }),
          virtueMin: new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true })
        }))
      })),

      // ── Description / Source ─────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" }),
      source:      new fields.StringField({ initial: "", blank: true }),

      // ── Excellency ───────────────────────────────────────────────────────
      // "" = not an Excellency, "first" | "second" | "third" = which tier
      excellency: new fields.StringField({ initial: "", blank: true }),

      // "" = not a perfect defense; "dodge" | "parry" | "soak" = which type
      perfectDefenseType: new fields.StringField({ initial: "", blank: true }),

      hasFoi: new fields.BooleanField({ initial: false }),
      flawsOfInvulnerability: new fields.ArrayField(
        new fields.SchemaField({
          type:  new fields.StringField({ initial: "" }),
          label: new fields.StringField({ initial: "" }),
        }),
        { initial: [] }
      ),

      // ── Activation Tracking ──────────────────────────────────────────────
      active: new fields.BooleanField({ initial: false }),

      // ── Alchemical Module Installation ────────────────────────────────────
      essenceCommitment: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      installed:         new fields.BooleanField({ initial: false }),
      installedSlotType: new fields.StringField({ initial: "", blank: true }),

      isSubmodule:   new fields.BooleanField({ initial: false }),
      parentCharmId: new fields.StringField({ initial: "", blank: true }),
      purchaseXp:    new fields.NumberField({ integer: true, min: 0, initial: 0 }),

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
        tags:              new fields.ArrayField(new fields.StringField({ blank: true })),
        areaAttack:        new fields.BooleanField({ initial: false }),
        areaShape:         new fields.StringField({ initial: "circle" }),
        areaSize:          new fields.StringField({ initial: "3" }),
        areaResistPool:    new fields.StringField({ initial: "stamina+resistance" }),
        areaResistDifficulty: new fields.StringField({ initial: "1" }),
        areaResistEffect:  new fields.StringField({ initial: "avoid" })
      }),

      // ── Activation Resolution ────────────────────────────────────────────────
      // Number of units resolved during the last per-unit mote activation dialog
      // (e.g. how many dice the player bought). Stored so attackBonus effects can
      // scale their values by motes-spent without opening a second picker.
      resolvedUnits: new fields.NumberField({ initial: 0, min: 0, integer: true }),

      // ── Mechanical Payload Schemas ──────────────────────────────────────────
      // All `enabled` flags default false — existing charms are unaffected.

      // M1 — Permanent health level grants (Ox-Body family)
      healthGrant: new fields.SchemaField({
        enabled:        new fields.BooleanField({ initial: false }),
        selectedOption: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        options: new fields.ArrayField(new fields.SchemaField({
          label: new fields.StringField({ initial: "", blank: true }),
          zero:  new fields.NumberField({ initial: 0, min: 0, integer: true }),
          one:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
          two:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
          dying: new fields.NumberField({ initial: 0, min: 0, integer: true })
        }))
      }),

      // M2 — Scene-long / per-attack soak and hardness bonus
      soakBonus: new fields.SchemaField({
        enabled:           new fields.BooleanField({ initial: false }),
        bashing:           new fields.NumberField({ initial: 0, min: 0, integer: true }),
        lethal:            new fields.NumberField({ initial: 0, min: 0, integer: true }),
        aggravated:        new fields.NumberField({ initial: 0, min: 0, integer: true }),
        hardnessAdd:       new fields.NumberField({ initial: 0, min: 0, integer: true }),
        hardnessSetTo:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
        bashingFormula:    new fields.StringField({ initial: "", blank: true }),
        lethalFormula:     new fields.StringField({ initial: "", blank: true }),
        aggravatedFormula: new fields.StringField({ initial: "", blank: true })
      }),

      // M3 — Wound penalty reduction / negation
      woundReduction: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        formula: new fields.StringField({ initial: "", blank: true })
      }),

      // M4 — Scene-long attribute / ability boost
      statBoost: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        changes: new fields.ArrayField(new fields.SchemaField({
          path:  new fields.StringField({ initial: "", blank: true }),
          value: new fields.StringField({ initial: "1" })
        }))
      }),

      // M5 — Mote recovery on trigger event (Essence-Gathering Temper family)
      moteRecovery: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        event:   new fields.StringField({ initial: "onDamageReceived" }),
        action:  new fields.StringField({ initial: "recoverPeripheral" }),
        formula: new fields.StringField({ initial: "", blank: true })
      }),

      // M6 — Healing roll effect
      healingRoll: new fields.SchemaField({
        enabled:    new fields.BooleanField({ initial: false }),
        pool:       new fields.StringField({ initial: "", blank: true }),
        bonus:      new fields.StringField({ initial: "", blank: true }),
        damageType: new fields.StringField({ initial: "bashing" }),
        target:     new fields.StringField({ initial: "self" })
      }),

      // M7 — Status effect application (Crippling / Sickness / Poison / Knockback)
      statusApply: new fields.SchemaField({
        enabled:    new fields.BooleanField({ initial: false }),
        status:     new fields.StringField({ initial: "Crippling" }),
        resistPool: new fields.StringField({ initial: "@sta + @resistance" }),
        onFail:     new fields.StringField({ initial: "applyCrippling" })
      }),

      // M8 — Permanent mote pool expansion (Essence Plethora family)
      motePoolBonus: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        pool:    new fields.StringField({ initial: "peripheral" }),
        amount:  new fields.NumberField({ initial: 10, min: 0, integer: true })
      }),

      // M9 — Extra-action charm execution
      extraActions: new fields.SchemaField({
        enabled:       new fields.BooleanField({ initial: false }),
        maxFormula:    new fields.StringField({ initial: "@essence", blank: true }),
        costPerAction: new fields.NumberField({ initial: 2, min: 0, integer: true })
      }),

      // M18 — Keyword effect magnitudes (Emotion / Compulsion / Servitude)
      // Override defaults when a charm specifies non-standard penalty values.
      // All sub-fields default to the rules-standard value so existing charms
      // need no data migration.
      keywordEffects: new fields.SchemaField({
        emotionPenaltyMinor: new fields.NumberField({ integer: true, min: 0, initial: 1 }),
        emotionPenaltyMajor: new fields.NumberField({ integer: true, min: 0, initial: 3 }),
        compulsionWpCost:    new fields.NumberField({ integer: true, min: 0, initial: 1 }),
        servitudeWpCost:     new fields.NumberField({ integer: true, min: 0, initial: 1 }),
        servitudeGmRemoval:  new fields.BooleanField({ initial: true })
      }),

      // M10 — DV bonus and DV penalty negation
      dvBonus: new fields.SchemaField({
        enabled:            new fields.BooleanField({ initial: false }),
        dodgeBonus:         new fields.NumberField({ initial: 0, min: 0, integer: true }),
        parryBonus:         new fields.NumberField({ initial: 0, min: 0, integer: true }),
        ignoreAllPenalties: new fields.BooleanField({ initial: false }),
        ignorePenaltyTypes: new fields.ArrayField(new fields.StringField({ blank: true })),
        dodgeBonusFormula:  new fields.StringField({ initial: "", blank: true }),
        parryBonusFormula:  new fields.StringField({ initial: "", blank: true })
      }),

      // M11 — Internal penalty applied to target
      targetPenalty: new fields.SchemaField({
        enabled:       new fields.BooleanField({ initial: false }),
        amount:        new fields.NumberField({ initial: -1, max: 0, integer: true }),
        amountFormula: new fields.StringField({ initial: '', blank: true }),
        scope:         new fields.StringField({ initial: "all" }),
        duration:      new fields.StringField({ initial: "oneScene" })
      }),

      // M12 — Attack roll bonus (supplemental charms)
      attackBonus: new fields.SchemaField({
        enabled:                 new fields.BooleanField({ initial: false }),
        accuracyDice:            new fields.StringField({ initial: "", blank: true }),
        accuracySuccesses:       new fields.StringField({ initial: "", blank: true }),
        damageDice:              new fields.StringField({ initial: "", blank: true }),
        // When true, damageDice is multiplied by resolvedUnits at roll time.
        damageDicePerMote:       new fields.BooleanField({ initial: false }),
        // Post-soak damage dice bypass the soak calculation entirely.
        postSoakDamageDice:      new fields.StringField({ initial: "", blank: true }),
        // When true, postSoakDamageDice is multiplied by resolvedUnits at roll time.
        postSoakDicePerMote:     new fields.BooleanField({ initial: false }),
        ignoreAccuracyPenalties: new fields.BooleanField({ initial: false }),
        ignoreRangeBand:         new fields.BooleanField({ initial: false })
      }),

      // M13 — Speed modifier
      speedModifier: new fields.SchemaField({
        enabled:      new fields.BooleanField({ initial: false }),
        delta:        new fields.NumberField({ initial: -1, integer: true }),
        deltaFormula: new fields.StringField({ initial: '', blank: true }),
        minimum:      new fields.NumberField({ initial: 3, min: 1, integer: true }),
        perMotes:     new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      // M14 — Rate bonus (extra attacks in a flurry)
      rateBonus: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        formula: new fields.StringField({ initial: "1", blank: true })
      }),

      // M15 — Willpower recovery on trigger event
      willpowerRecovery: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        event:   new fields.StringField({ initial: "onDamageReceived" }),
        formula: new fields.StringField({ initial: "1", blank: true })
      }),

      // M16 — Apply Active Effects to target (on hit or on activation)
      // `changes` maps to Foundry's standard AE changes array (key/mode/value).
      // `internalPenalty` maps to flags.exalted2e.internalPenalty used by the
      // derived-data penalty aggregator — same structure as applyInternalPenalty.
      targetEffect: new fields.SchemaField({
        enabled:  new fields.BooleanField({ initial: false }),
        trigger:  new fields.StringField({ initial: "onHit", choices: ["onHit", "onActivate"] }),
        label:    new fields.StringField({ initial: "", blank: true }),
        icon:     new fields.StringField({ initial: "icons/svg/aura.svg", blank: true }),
        duration: new fields.StringField({ initial: "oneScene", choices: ["oneScene", "indefinite", "permanent"] }),
        changes: new fields.ArrayField(new fields.SchemaField({
          key:   new fields.StringField({ initial: "", blank: true }),
          mode:  new fields.NumberField({ initial: 2, integer: true }), // CONST.ACTIVE_EFFECT_MODES.ADD
          value: new fields.StringField({ initial: "0", blank: true }),
        })),
        internalPenalty: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          type:    new fields.StringField({ initial: "all" }),
          amount:  new fields.NumberField({ initial: -1, max: 0, integer: true }),
        }),
        perDamageLevel: new fields.BooleanField({ initial: false }),
      }),

      // M17 — Grants initiation in a tradition (Sorcery / Necromancy / Weaving)
      grantsInitiation: new fields.SchemaField({
        enabled:   new fields.BooleanField({ initial: false }),
        tradition: new fields.StringField({ initial: "sorcery", choices: ["sorcery", "necromancy", "weaving"] }),
        level:     new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true })
      })
    };
  }
}
