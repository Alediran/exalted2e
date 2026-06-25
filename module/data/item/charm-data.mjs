import { descriptionsField } from "./_shared/descriptions-field.mjs";

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
      // charmUid of the Charm this one enhances. When set, all mechanical effects
      // from this Charm only activate while the referenced Charm is active.
      // Used for permanent Charms that are prerequisites which upgrade a sustained
      // base Charm (e.g. Element-Resisting Prana enhances Hardship Surviving Mendicant Spirit).
      enhancesCharmUid:     new fields.StringField({ initial: "", blank: true }),
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
            choices: ["charm", "anyExcellency", "virtue", "anyCharmOfAbility"]
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
          virtueKey:    new fields.StringField({ initial: "valor", blank: true }),
          virtueMin:    new fields.NumberField({ initial: 1, min: 1, max: 5, integer: true }),
          minCount:     new fields.NumberField({ initial: 1, min: 1, max: 3, integer: true }),
          // For type:"charm" prereqs: how many times the prereq charm must have been purchased.
          minPurchases: new fields.NumberField({ initial: 1, min: 1, integer: true })
        }))
      })),
      incompatibleCharms: new fields.ArrayField(
        new fields.StringField({ initial: "", blank: true })
      ),
      nativeOnly: new fields.BooleanField({ initial: false }),

      // ── Description / Source ─────────────────────────────────────────────
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
      source:       new fields.StringField({ initial: "", blank: true }),

      // ── Excellency ───────────────────────────────────────────────────────
      // "" = not an Excellency, "first" | "second" | "third" = which tier
      excellency: new fields.StringField({ initial: "", blank: true }),
      // When true, this charm is the (Ability) Essence Flow charm for its
      // ability. Per Errata: stunts on that ability add the stunt rating to
      // the bonus-dice cap from Charms on the same roll.
      essenceFlow: new fields.BooleanField({ initial: false }),

      // "" = not a perfect defense; "dodge" | "parry" | "soak" = which type
      perfectDefenseType: new fields.StringField({ initial: "", blank: true }),

      hasFoi: new fields.BooleanField({ initial: false }),
      grantsCelestialMA: new fields.BooleanField({ initial: false }),

      // ── Countermagic ─────────────────────────────────────────────────────
      isCountermagic:        new fields.BooleanField({ initial: false }),
      countermagicTier:      new fields.NumberField({ integer: true, min: 1, max: 3, initial: 1, nullable: true }),
      countermagicTradition: new fields.StringField({
        choices: ["sorcery", "necromancy", "both"],
        initial: "sorcery",
        nullable: true
      }),
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
        modeExclusive:  new fields.BooleanField({ initial: false }),
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
        modeExclusive:     new fields.BooleanField({ initial: false }),
        enabled:           new fields.BooleanField({ initial: false }),
        bashing:           new fields.NumberField({ initial: 0, min: 0, integer: true }),
        lethal:            new fields.NumberField({ initial: 0, min: 0, integer: true }),
        aggravated:        new fields.NumberField({ initial: 0, min: 0, integer: true }),
        hardnessAdd:       new fields.NumberField({ initial: 0, min: 0, integer: true }),
        hardnessSetTo:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
        bashingFormula:    new fields.StringField({ initial: "", blank: true }),
        lethalFormula:     new fields.StringField({ initial: "", blank: true }),
        aggravatedFormula: new fields.StringField({ initial: "", blank: true }),
        selectedOption:    new fields.NumberField({ initial: 0, min: 0, integer: true }),
        options: new fields.ArrayField(new fields.SchemaField({
          label:       new fields.StringField({ initial: "", blank: true }),
          bashing:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
          lethal:      new fields.NumberField({ initial: 0, min: 0, integer: true }),
          aggravated:  new fields.NumberField({ initial: 0, min: 0, integer: true }),
          hardnessAdd: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        })),
      }),

      // M3 — Wound penalty reduction / negation
      woundReduction: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        formula: new fields.StringField({ initial: "", blank: true })
      }),

      // M3b — Minimum post-soak damage dice (Violet Bier of Sorrows Form family)
      minimumDamage: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: false, nullable: false, initial: false }),
        formula: new fields.StringField({ required: false, nullable: false, initial: "" }),
      }),

      // M3c — Raw (pre-soak) damage bonus dice (Martial Arts Form charms)
      rawDamageBonus: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: false, nullable: false, initial: false }),
        formula: new fields.StringField({ required: false, nullable: false, initial: "" }),
      }),

      // M4 — Scene-long attribute / ability boost
      statBoost: new fields.SchemaField({
        modeExclusive: new fields.BooleanField({ initial: false }),
        enabled: new fields.BooleanField({ initial: false }),
        changes: new fields.ArrayField(new fields.SchemaField({
          path:  new fields.StringField({ initial: "", blank: true }),
          value: new fields.StringField({ initial: "1" })
        }))
      }),

      // M5b — Overdrive pool addition on activation (Abyssal Overdrive keyword charms)
      overdriveMotes: new fields.StringField({ initial: "", blank: true }),

      // M5c — Surging Essence Reactor: when true, Solar may convert Overdrive gains to Attunement motes
      convertsOverdriveToAttunement: new fields.BooleanField({ initial: false }),

      // M5 — Mote recovery on trigger event (Essence-Gathering Temper family)
      moteRecovery: new fields.SchemaField({
        modeExclusive:  new fields.BooleanField({ initial: false }),
        enabled:        new fields.BooleanField({ initial: false }),
        event:          new fields.StringField({ initial: "onDamageReceived" }),
        action:         new fields.StringField({ initial: "recoverPeripheral" }),
        formula:        new fields.StringField({ initial: "", blank: true }),
        source:         new fields.StringField({ initial: "self", choices: ["self", "fromTarget"] }),
        perDamageLevel:          new fields.BooleanField({ initial: false }),
        maxRecovery:             new fields.NumberField({ initial: 20, integer: true, min: 1 }),
        sentientOnly:            new fields.BooleanField({ initial: false }),
        // Overdrive dice-roll mechanic (Essence-Gathering Temper family):
        // roll (effectivePool × overdriveDiceMultiplier) dice, count successes,
        // optionally cap at Stamina, then multiply by formula for motes.
        overdriveDiceMultiplier: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
        overdriveStaminaCap:     new fields.BooleanField({ initial: false }),
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
        enabled:                new fields.BooleanField({ initial: false }),
        maxFormula:             new fields.StringField({ initial: "@essence", blank: true }),
        costPerAction:          new fields.NumberField({ initial: 2, min: 0, integer: true }),
        costPerActionHighRate:  new fields.NumberField({ required: false, initial: 0, min: 0 })
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
        modeExclusive:      new fields.BooleanField({ initial: false }),
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
        modeExclusive: new fields.BooleanField({ initial: false }),
        enabled:       new fields.BooleanField({ initial: false }),
        amount:        new fields.NumberField({ initial: -1, max: 0, integer: true }),
        amountFormula: new fields.StringField({ initial: '', blank: true }),
        scope:         new fields.StringField({ initial: "all" }),
        duration:      new fields.StringField({ initial: "oneScene" })
      }),

      // M12a — Movement bonus (dash distance, flight, water-walking)
      moveBonus: new fields.SchemaField({
        enabled:      new fields.BooleanField({ initial: false }),
        dashAdd:      new fields.StringField({ initial: "", blank: true }),
        flight:       new fields.BooleanField({ initial: false }),
        waterWalking: new fields.BooleanField({ initial: false })
      }),

      // M12 — Attack roll bonus (supplemental charms)
      attackBonus: new fields.SchemaField({
        modeExclusive:           new fields.BooleanField({ initial: false }),
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
        ignoreRangeBand:         new fields.BooleanField({ initial: false }),
        soakPiercing:            new fields.NumberField({ initial: 0, min: 0, integer: true }),
        ignoresArmor:            new fields.BooleanField({ initial: false })
      }),

      // M18 — Social attack bonus (supplemental / Social-keyword charms)
      socialBonus: new fields.SchemaField({
        enabled:         new fields.BooleanField({ initial: false }),
        poolDice:        new fields.StringField({ initial: "", blank: true }),
        poolSuccesses:   new fields.StringField({ initial: "", blank: true }),
        poolDicePerMote: new fields.BooleanField({ initial: false }),
        ignorePenalties: new fields.BooleanField({ initial: false })
      }),

      // M13 — Speed modifier
      speedModifier: new fields.SchemaField({
        modeExclusive: new fields.BooleanField({ initial: false }),
        enabled:      new fields.BooleanField({ initial: false }),
        delta:        new fields.NumberField({ initial: -1, integer: true }),
        deltaFormula: new fields.StringField({ initial: '', blank: true }),
        minimum:      new fields.NumberField({ initial: 3, min: 1, integer: true }),
        perMotes:     new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),

      // M12b — Attack success multiplier (e.g. Cascade of Cutting Terror doubles successes before DV comparison)
      attackSuccessMultiplier: new fields.NumberField({ required: false, nullable: false, integer: true, min: 1, initial: 1 }),
      // M12c — Extra-success multiplier: multiplies threshold successes (above DV) added to raw damage pool (Step 7). Leave at 1 for no effect.
      extraSuccessMultiplier: new fields.NumberField({ required: false, nullable: false, integer: true, min: 1, initial: 1 }),
      // M12d — Flat guaranteed successes added to attack roll (Step 3) before DV comparison.
      attackSuccessBonus: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),
      // M12e — Raw damage pool multiplier (applied before soak, Step 7)
      rawDamageMultiplier: new fields.NumberField({ required: false, nullable: false, integer: false, min: 1, initial: 1 }),
      // M12f — Post-soak damage multiplier (applied after soak, before damage roll)
      postSoakDamageMultiplier: new fields.NumberField({ required: false, nullable: false, integer: false, min: 1, initial: 1 }),
      // M12g — Damage success multiplier (each die success counted N times in Step 8)
      damageSuccessMultiplier: new fields.NumberField({ required: false, nullable: false, integer: true, min: 1, initial: 1 }),
      // M12h — Bypass soak entirely (damage pool = threshold + weapon, soak skipped)
      ignoreSoak: new fields.BooleanField({ required: false, nullable: false, initial: false }),
      // M32 — DV bonus applied during attack (formula-based, e.g. "+1 DV per 2 motes")
      dvBonusFormula: new fields.StringField({ required: false, initial: "" }),
      // M33 — Minimum post-soak damage reduction (e.g. "cannot reduce post-soak damage below 3")
      minimumDamageReduction: new fields.NumberField({ required: false, initial: 0 }),
      // M34 — Post-soak damage reduction per mote spent (scaling reduction)
      postSoakDamageReductionPerMote: new fields.NumberField({ required: false, initial: 0 }),
      // M35 — Creature of Darkness raw damage reduction (formula-based)
      creatureOfDarknessRawDamageReduction: new fields.StringField({ required: false, initial: "" }),
      // M36 — Upgrade weapon range (e.g. grants thrown range to melee weapon)
      upgradeWeaponRange: new fields.BooleanField({ required: false, initial: false }),
      // M37 — Combat dice bonus (flat dice added to combat pools)
      combatDiceBonus: new fields.NumberField({ required: false, initial: 0 }),

      // M40 — General DV penalty reduction (e.g. Fivefold Bulwark Stance)
      dvPenaltyReduction: new fields.NumberField({ required: false, initial: 0 }),

      // M41 — Onslaught-only DV penalty reduction (e.g. Lunar Hero Form)
      onslaughtPenaltyReduction: new fields.NumberField({ required: false, initial: 0 }),

      // M42 — DV halving: both target Dodge and Parry DVs are halved (floor) before Step 4 comparison
      dvHalving: new fields.BooleanField({ required: false, initial: false }),
      // M43 — Parry DV halving only (e.g. Ferocious Biting Tooth)
      halvesParryDV: new fields.BooleanField({ required: false, initial: false }),
      // M44 — Incoming attack dice penalty: defender's passively-active charm reduces attacker's pool
      incomingAttackDicePenalty: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
      // M45 — Ignore target hardness regardless of damage type (e.g. Shell-Crushing Atemi)
      ignoresHardness: new fields.BooleanField({ required: false, initial: false }),

      // M6b — Healing rate multiplier (e.g. Body-Mending Meditation speeds healing × 10).
      // Data-storage only — no automatic tick engine exists; GM must track manually.
      healingRateMultiplier: new fields.NumberField({ required: false, nullable: false, integer: true, min: 1, initial: 1 }),

      // M14 — Rate bonus (extra attacks in a flurry)
      rateBonus: new fields.SchemaField({
        modeExclusive: new fields.BooleanField({ initial: false }),
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
          type:  new fields.StringField({ initial: "add", blank: false }),
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
      }),

      // M19 — Hazard immunity (natural hazards only, or all hazards including supernatural)
      hazardImmunity: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        scope:   new fields.StringField({ initial: "natural", choices: ["natural", "supernatural"] })
      }),

      // M20 — Artifact creation ability minimum reduction (Craft / Lore / Occult)
      artifactAbilityReduction: new fields.SchemaField({
        enabled:   new fields.BooleanField({ initial: false }),
        reduction: new fields.NumberField({ initial: 1, min: 1, max: 4, integer: true })
      }),

      // Words-as-Workshop Method — treat any location as at least a Master's
      // Workshop (floors the workshop dice modifier at 0 for the crafter).
      wordsAsWorkshop: new fields.BooleanField({ initial: false }),

      // M21 — Essence Drain (on hit): drain motes from target on a confirmed hit.
      // amount is resolved from formula using attacker's rollData.
      essenceDrain: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: false, nullable: false, initial: false }),
        formula: new fields.StringField({ required: false, nullable: false, initial: "" }),
        pool:    new fields.StringField({ required: false, nullable: false, initial: "peripheral", choices: ["peripheral", "personal", "any"] }),
        targetTypeFilter: new fields.StringField({ required: false, nullable: false, initial: "", blank: true }),
      }),

      // M22b — Target Willpower Drain: reduce target's WP on a confirmed hit.
      targetWillpowerDrain: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: false, nullable: false, initial: false }),
        formula: new fields.StringField({ required: false, nullable: false, initial: "" }),
      }),

      // M22 — Ability Dice Bonus: adds bonus dice to non-attack rolls for a
      // specific ability (e.g. Dreaming Pearl Courtesan Form adds Martial Arts
      // rating to all Presence and Socialize rolls). Evaluated in
      // rollAttributeAbility via aggregateAbilityDiceBonusFromCharms.
      abilityDiceBonus: new fields.ArrayField(
        new fields.SchemaField({
          ability: new fields.StringField({ required: false, nullable: false, initial: "" }),
          formula: new fields.StringField({ required: false, nullable: false, initial: "" }),
        }),
        { required: false, nullable: false, initial: [] }
      ),

      // M23 — Social roll success bonus (flat successes on social ability rolls: Presence, Performance, Bureaucracy, Investigation)
      socialSuccessBonus: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),
      // M24 — Social roll success multiplier (multiplies successes on social ability rolls)
      socialSuccessMultiplier: new fields.NumberField({ required: false, nullable: false, integer: true, min: 1, initial: 1 }),
      // M38 — Majestic Resistance type (empty string = none, "dodgelike" | "parrylike" | etc.)
      majesticResistanceType: new fields.StringField({ required: false, initial: "" }),
      // M39 — Add Appearance dice bonus to social rolls
      addAppearanceDice: new fields.BooleanField({ required: false, initial: false }),
      // M25 — Clockwork Auto-Success Conversion (Alchemical Clockwork Perfection Nodes)
      // When active, the rolled dice pool converts to automatic successes (no dice rolled).
      clockworkAutoSuccessConversion: new fields.BooleanField({ required: false, nullable: false, initial: false }),
      // M26 — Ability/Attribute max override: when > 0, the target attribute/ability cap is raised
      // to this value (e.g. Alchemical Sixth Augmentation allows an attribute to reach 6).
      abilityMaxOverride: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),

      // Supplemental keyword injection: keywords forced onto the attack when this
      // supplemental charm activates (e.g. "Unblockable", "Undodgeable"). These
      // are added to activatedKeywords during rollAttack supplemental activation.
      supplementalKeywordInjection: new fields.ArrayField(
        new fields.StringField({ required: true, blank: false }),
        { initial: [] }
      ),

      // M28a — Harm Immaterial: attack can affect dematerialized spirits
      harmImmaterial: new fields.BooleanField({ required: false, nullable: false, initial: false }),
      // M28b — Spirit Aggravated Damage: damage dealt to spirits is Aggravated (materialized or not)
      spiritAggravatedDamage: new fields.BooleanField({ required: false, nullable: false, initial: false }),
      // M30 — Guaranteed knockback (e.g. Forceful Arrow): bypasses the normal knockback roll; distance
      // from distanceFormula yards of knockback when at least 1 die of damage is rolled.
      guaranteedKnockback: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        distanceFormula: new fields.StringField({ initial: "" }),
      }, { required: false }),
      // M31 — Post-soak damage bonus (e.g. Spirit-Maiming Essence Attack): adds bonus dice after soak
      postSoakDamageBonus: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false }),
        formula: new fields.StringField({ initial: "" }),
      }, { required: false }),
      // M29 — Post-soak damage reduction (defensive): reduces post-soak pool when this actor is targeted
      postSoakDamageReduction: new fields.NumberField({ required: false, nullable: false, integer: true, min: 0, initial: 0 }),

      negatesCripplingEffect: new fields.BooleanField({ required: false, initial: false }),
      guaranteedHit: new fields.BooleanField({ required: false, initial: false }),
      statusImmunity: new fields.ArrayField(new fields.StringField(), { required: false, initial: [] }),
      minBreeding: new fields.NumberField({ required: false, initial: 0, min: 0 }),
      dynastyEffect: new fields.StringField({ required: false, initial: "" }),
      martyrEffect: new fields.StringField({ required: false, initial: "" }),
      hasMartyrOption: new fields.BooleanField({ required: false, initial: false }),

      // ── Multi-Purchase Fields ───────────────────────────────────────────
      // Maximum number of times this charm can be purchased.
      maxPurchases:  new fields.StringField({ initial: "1", blank: false }),
      // Current purchase level (1 to maxPurchases). Tracks progression through
      // purchasable charm tiers.
      purchaseLevel: new fields.NumberField({ initial: 1, min: 1, integer: true }),
      // Essence gates for each level beyond 1. essenceGates[0] is required Essence
      // to reach level 2; essenceGates[1] for level 3, etc. Empty levels have no
      // gate. Values are 1–10.
      essenceGates:  new fields.ArrayField(
        new fields.NumberField({ min: 1, max: 10, integer: true }),
        { initial: [] }
      ),

      // ── Essence-Tiered Upgrades ─────────────────────────────────────────────
      // Each entry defines a conditional upgrade that activates when the actor
      // meets the gate requirements (essence, ability, attribute, purchase level).
      upgradeTiers: new fields.ArrayField(new fields.SchemaField({
        label:               new fields.StringField({ blank: true, initial: "" }),
        autoApply:           new fields.BooleanField({ initial: false }),
        passive:             new fields.BooleanField({ initial: true }),
        gateRequiresAll:     new fields.BooleanField({ initial: true }),
        essenceRequired:     new fields.NumberField({ integer: true, min: 0, max: 10, initial: 0 }),
        abilityGate: new fields.SchemaField({
          min: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
        }),
        attributeGate: new fields.SchemaField({
          min: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
        }),
        purchaseLevelRequired: new fields.NumberField({ integer: true, min: 2, initial: 2 }),
        cost: new fields.SchemaField({
          formula: new fields.StringField({ blank: true, initial: "" }),
        }),
        attackBonus: new fields.SchemaField({
          enabled:                 new fields.BooleanField({ initial: false }),
          accuracyDice:            new fields.StringField({ initial: "", blank: true }),
          accuracySuccesses:       new fields.StringField({ initial: "", blank: true }),
          damageDice:              new fields.StringField({ initial: "", blank: true }),
          damageDicePerMote:       new fields.BooleanField({ initial: false }),
          postSoakDamageDice:      new fields.StringField({ initial: "", blank: true }),
          postSoakDicePerMote:     new fields.BooleanField({ initial: false }),
          ignoreAccuracyPenalties: new fields.BooleanField({ initial: false }),
          ignoreRangeBand:         new fields.BooleanField({ initial: false }),
          soakPiercing:            new fields.NumberField({ initial: 0, min: 0, integer: true }),
          ignoresArmor:            new fields.BooleanField({ initial: false }),
        }),
        dvBonus: new fields.SchemaField({
          enabled:            new fields.BooleanField({ initial: false }),
          dodgeBonus:         new fields.NumberField({ initial: 0, min: 0, integer: true }),
          parryBonus:         new fields.NumberField({ initial: 0, min: 0, integer: true }),
          ignoreAllPenalties: new fields.BooleanField({ initial: false }),
          ignorePenaltyTypes: new fields.ArrayField(new fields.StringField({ blank: true })),
          dodgeBonusFormula:  new fields.StringField({ initial: "", blank: true }),
          parryBonusFormula:  new fields.StringField({ initial: "", blank: true }),
        }),
        targetPenalty: new fields.SchemaField({
          enabled:       new fields.BooleanField({ initial: false }),
          amount:        new fields.NumberField({ initial: -1, max: 0, integer: true }),
          amountFormula: new fields.StringField({ initial: "", blank: true }),
          scope:         new fields.StringField({ initial: "all" }),
          duration:      new fields.StringField({ initial: "oneScene" }),
        }),
        moteRecovery: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          event:   new fields.StringField({ initial: "onDamageReceived" }),
          action:  new fields.StringField({ initial: "recoverPeripheral" }),
          formula: new fields.StringField({ initial: "", blank: true }),
          source:  new fields.StringField({ initial: "self", choices: ["self", "fromTarget"] }),
        }),
        soakBonus: new fields.SchemaField({
          enabled:           new fields.BooleanField({ initial: false }),
          bashing:           new fields.NumberField({ initial: 0, min: 0, integer: true }),
          lethal:            new fields.NumberField({ initial: 0, min: 0, integer: true }),
          aggravated:        new fields.NumberField({ initial: 0, min: 0, integer: true }),
          hardnessAdd:       new fields.NumberField({ initial: 0, min: 0, integer: true }),
          hardnessSetTo:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
          bashingFormula:    new fields.StringField({ initial: "", blank: true }),
          lethalFormula:     new fields.StringField({ initial: "", blank: true }),
          aggravatedFormula: new fields.StringField({ initial: "", blank: true }),
        }),
        statBoost: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          changes: new fields.ArrayField(new fields.SchemaField({
            path:  new fields.StringField({ initial: "", blank: true }),
            value: new fields.StringField({ initial: "1" }),
          })),
        }),
        healthGrant: new fields.SchemaField({
          enabled:        new fields.BooleanField({ initial: false }),
          selectedOption: new fields.NumberField({ initial: 0, min: 0, integer: true }),
          options: new fields.ArrayField(new fields.SchemaField({
            label: new fields.StringField({ initial: "", blank: true }),
            zero:  new fields.NumberField({ initial: 0, min: 0, integer: true }),
            one:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
            two:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
            dying: new fields.NumberField({ initial: 0, min: 0, integer: true }),
          })),
        }),
        rateBonus: new fields.SchemaField({
          enabled: new fields.BooleanField({ initial: false }),
          formula: new fields.StringField({ initial: "1", blank: true }),
        }),
        speedModifier: new fields.SchemaField({
          enabled:      new fields.BooleanField({ initial: false }),
          delta:        new fields.NumberField({ initial: -1, integer: true }),
          deltaFormula: new fields.StringField({ initial: "", blank: true }),
          minimum:      new fields.NumberField({ initial: 3, min: 1, integer: true }),
          perMotes:     new fields.NumberField({ initial: 0, min: 0, integer: true }),
        }),
      }), { initial: [] })
    };
  }
}
