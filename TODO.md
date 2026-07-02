# TODO — Exalted 2nd Edition Foundry VTT System

**Progress: 281 / 291 complete** (6 partial / out-of-scope, 0 plan tasks pending — last updated 2026-06-26 — added M49–M63 charm mechanic fields: onslaught DV injection, DV-penalty ignore, MDV bonus, shaping immunity, auto-knockdown, dematerialized detection, limit-break immunity, virtue recovery, social-success formula, attacker movement, unexpected-attack flags, join-battle bonus, max-perfect-uses, intimacy protection)

Pending features based on Exalted 2nd Edition core rules + errata + Ink Monkeys + per-splat Manuals.
See [docs/mechanics-reference.md](docs/mechanics-reference.md) for the rule targets and [docs/gap-analysis.md](docs/gap-analysis.md) for architectural notes.

## Combat System
- [x] Attack resolution (pool vs DV, damage roll, threshold)
- [x] Multi-step attack resolution (Steps 1 / 2 / 4 / 5 / 8 / 9 on the attack card)
- [x] Canvas target picker when no token is pre-targeted
- [x] Range check (melee ≤ 1 square, Reach ≤ 2; ranged ≤ `effectiveRange`)
- [x] Range bands (short/medium/long) with tiered penalties (currently binary in-range / out-of-range)
- [x] Flurries
  - [x] Declaration dialog (action rows, per-mode rate caps, draw-then-attack)
  - [x] Dice penalty applied in `rollAttack`
  - [x] DV penalty stamped as AE on the actor
  - [x] Finish Turn advances by the flurry's max Speed
- [x] Combos (charm combo creation, activation)
  - [x] Combo-building rules (keyword restrictions: Combo-Basic only with Reflexive; one Form-type per combo; no size cap per errata)
  - [x] Combo-Basic keyword enforcement (Form-type MA charm + reflexive only) per errata
  - [x] Flaw-of-Invulnerability + Form-type Combo +2 WP surcharge
  - [x] Shared / compendium-sourced Combos (drag-in from packs)
  - [x] Drag-reorder within the Combo sheet (v1 uses arrow buttons)
  - [x] Consolidated single chat card + combined Reverse (fallback if chat gets too noisy)
  - [x] NPC Combos
- [x] **Knockback / Knockdown / Stunning** (Stamina + Resistance resist rolls, Prone + stun AE)
- [x] **Area attacks** (cone/radius attack forms — Elemental Burst Technique, Tsunami Force Shout, etc.; targets make Essence resist rolls, no accuracy roll; requires dedicated area-attack schema field or charm flag)
- [x] **Clinch / Grapple** (control pool, opposed rolls, throw/crush/hold sub-actions, renew-each-tick)
- [x] Tick system (Speed-based initiative)
  - [x] `ExaltedCombat` sorts ascending; same-tick tiebreaker Dex → Wits → name → id
  - [x] Join Battle (all / NPCs-only) + canonical `tick = maxSuccesses − mySuccesses`
  - [x] Finish Turn control; per-combatant initiative button swapped to d10
  - [x] Auto-advance on Roll Damage (charge the attacker Speed ticks automatically)
  - [x] Actions quickbar (Move 5, Guard 3, Aim 5, Rise 5, Draw 5, Inactive 5)
- [x] DV refresh tracking — AE-driven, cleared when the combatant's turn starts
- [x] Onslaught penalty (−1 DV per attack received; reuse the DV-penalty AE plumbing)
- [x] **Coordinated attacks** (leader Cha+War, target DV reduced by successes cap unit size)
- [x] **Mounted combat** (Ride-controlled mount stats, charge bonuses, lance mechanics, Ride charms per splat) — vehicle actor type + Ride cap on all combat rolls and DVs; vehicle weapons usable from cockpit; mount/dismount from Combat tab, persists outside combat
- [~] Cover modifiers — light/heavy cover AE-based DV bonus framework implemented; buckler/tower shield items pending
- [x] Height advantage — custom `heightAdvantage` status effect with `dvBonus: { dodge: 1, parry: 1 }` + compendium seeder entry
- [x] **Multi-tick action container** — for shaping sorcery, Aim banking across ticks, clinch renewal, extra-action charm flurries with their own tick scheduling
- [x] Aim bonus banking (one die per banked tick, consumed on aimed attack)
- [x] Aborted-Aim divert penalty — `onCommitOther` returns `applyAbortPenalty:true`; `advanceCurrentByTicks` applies `applyInternalPenalty(2, dvRefreshable)` when diverted
- [x] Minimum-damage errata swap — `Math.max(damagePool − soak, overwhelming)` where `overwhelming` defaults to 1; hardnessStops correctly blocks entirely (no minimum applies)
- [x] DV halving from supplemental charms (`dvHalving: true` halves both Dodge+Parry DV floor before Step 4; `halvesParryDV: true` halves Parry DV only; wired in `rollAttack` after terrain bonus and before base snapshot — see Blazing Solar Bolt, Ferocious Biting Tooth)
- [x] Incoming attack dice penalty from defender's passively-active charms (`incomingAttackDicePenalty: NumberField`; aggregated via `aggregateIncomingAttackDicePenaltyFromCharms`; subtracted from attacker pool in `ExaltedRoll` constructor — see Crouching Tiger Stance)
- [x] Charm-level hardness bypass (`ignoresHardness: true` on supplemental charm zeros `targetHardness` before soak; distinct from aggravated-always-ignores-hardness path — see Shell-Crushing Atemi)
- [x] Target-number reduction (`targetNumberReduction: NumberField`) — reduces the success threshold below 7 for this attack's dice roll; `ExaltedRoll` accepts `targetNumber` option, wired from supplemental charms in `rollAttack`; `countSuccesses` in `dice-math.mjs` parameterized accordingly
- [x] Onslaught multiplier (`onslaughtMultiplier: NumberField`) — additional onslaught stacks = `max(multiplier,1)−1` extra `addOnslaught()` calls after the base stack in `rollAttack`
- [x] Onslaught-to-DV-penalty charm flag (`onslaughtToDVPenalty: BooleanField`) — when any passively-active charm has this flag, each `addOnslaught()` call also stamps an `onslaught-dv` AE on the target
- [x] DV penalty ignore from charms (`ignoreDVPenalties: { dodge, parry }`) — passively-active charms zero the applicable DV penalty total in `currentDodgeDV`/`currentParryDV` getters
- [x] Auto-knockdown supplemental charm (`automaticKnockdown: BooleanField`) — on any damage dealt forces Prone on NPC targets; queues a pending-confirm card for player-owned targets; wired in `knockback.mjs`
- [x] Makes-attack-unexpected supplemental charm (`makesAttackUnexpected: BooleanField`) — zeros both target DVs for the attack; wired in `rollAttack` after the Unblockable/Undodgeable step
- [x] Attacker movement on hit (`attackerMovement: { enabled, formula }`) — supplemental charm triggers a UI prompt for the attacker to declare movement distance after damage is applied
- [x] Join Battle success bonus (`joinBattleSuccessBonus: NumberField`) — flat bonus successes from passively-active charms added to `rollInitiative` success count
- [x] First-attack-unexpected passive charm (`firstAttackUnexpected: BooleanField`) — actor's first attack each combat zeroes target DVs; tracks via `combatant.flags.exalted2e.hasAttacked`; cleared on new combat
- [x] Max perfect uses per scene (`maxPerfectUses: NumberField`) — caps perfect-defense activations via `targetCombatant.flags.exalted2e.perfectUses[charmId]` counter; toast warns on exhaustion (0 = unlimited)
- [x] Counterattack becomes Unblockable via charm flag (`counterattackUnblockableVariant: BooleanField`) — injects `Unblockable` keyword when the counterattack is fired; `rollAttack` merges `options.extraKeywords` into `activatedKeywords` after the supplemental-charm loop
- [x] Range multiplier (`rangeMultiplier: NumberField`) — passively-active charms multiply effective weapon range; `getRangeMultiplierFromCharms` (max across active charms) applied to `rangeVal` in `checkAttackRange`
- [x] Melee range extension (`meleeRangeExtension: BooleanField`) — melee weapons treated as 30-unit thrown range in `checkAttackRange` when any passively-active charm has this flag
- [x] Mote loan to target (`moteLoan: SchemaField { enabled, formula, maxReceive }`) — Circle-folder ally picker (DialogV2 radio buttons) in `activateCharm` after cost spend; calls `targetAlly.recoverMotes(amt, "peripheral")`
- [x] Willpower gift to target (`willpowerGift: SchemaField { enabled, formula, maxTarget }`) — same ally picker as moteLoan; calls `targetAlly.receiveWillpower(amt)`; new `receiveWillpower` actor method added
- [x] Ally-targeting support — Circle-folder picker (game.folders flag `theCircle`) embedded in activateCharm for moteLoan/willpowerGift
- [x] Soak reduction on hit (`soakReductionOnHit: SchemaField { bashingReduction, lethalReduction, duration }`) — temporarily lowers target's soak after a hit (e.g. Throat-Baring Hold, duration "untilNextAction"); stamp a time-limited AE on the target reducing soak aggregation
- [x] Damage-driven penalty on target (`damageDrivenPenalty: SchemaField { enabled, perHL, scope }`) — for each HL of damage dealt, apply `perHL` dice penalty to the target's attribute group (`scope`: "physicalAttributes" / "mentalAttributes" / "all"); stamp a named AE on target after damage roll — see Joint-Wounding Attack
- [x] Temporary health levels (`temporaryHealthLevels: SchemaField { enabled, level, formula }`) — add transient AE granting extra HL at the specified level (e.g. Anointment of Miraculous Health adds HL at −0); AE carries `charmDuration` for auto-sweep
- [x] Homing attack — `homingAttack` BooleanField on CharmData; stored in attack snapshot; `computeAttackOutcome` sets `showHomingReattack` on miss; `btn-homing-reattack` button in attack-result.hbs; click handler in chat-cards.mjs re-fires `rollAttack` with `isHomingReattack: true`; infinite-loop prevention via `homingReattackFired` flag
- [x] Ammo tracking + `bypassAmmoConsumption` — `ammo: SchemaField { enabled, current, max }` on WeaponData; decrement in `rollAttack` post-dialog (after `activatedCharmItems`, before dematerialized gate); `bypassAmmoConsumption: BooleanField` on CharmData skips decrement; aborts attack with toast when current ≤ 0; skipped on `isHomingReattack`
- [x] Elsewhere system — `inElsewhere: BooleanField` on WeaponData; weapons split into `weapons` (active) and `elsewhereWeapons` in context; Elsewhere section in inventory tab with Recall button; Send to Elsewhere button on active weapon rows; `sendsWeaponToElsewhere: BooleanField` on CharmData for charm data annotation; Send clears `equipped`

## Combat — Defense & Soak
- [x] Dodge DV / Parry DV formulas, weapon-mode parry selection
- [x] Essence-2+ rounds DVs up
- [x] Armor soak aggregation (equipped armor + natural)
- [x] Artifact commitment feedback on mote maxima
- [x] Hardness model (per armor)
- [x] Shields as weapons (errata: Sh0/Sh1/Sh2 tag-driven shields with mobility penalty, no longer "mobile cover") — `shieldTag` field on weapon modes (0–3); flat parry DV bonus post-halve; mobility penalty via `internalPenaltyFor("physical")`
- [~] Cover modifiers (light/heavy cover AE bonus implemented; shield-type cover pending)
- [x] Starmetal armor: target-imposed external attack penalty
- [x] Fatigue penalty (armor fatigue triggering Stamina+Resistance rolls over scene-length exertion)

## Charm Keywords
- [x] Unblockable / Undodgeable (target DVs → 0, buttons stay live for Perfect counters)
- [x] Perfect Dodge / Perfect Parry (attack short-circuits; bypasses Unblockable/Undodgeable)
- [x] Holy (upgrades bashing/lethal → aggravated vs Creature of Darkness)
- [x] Counterattack (already wired via Step 9)
- [x] Action-Only (reflexive charms gated to acting ticks, once per tick)
- [x] Stackable (allow multi-activation accumulation on same target)
- [x] Compulsion (scene-long forced-task AE on target)
- [x] Emotion (scene-long ±1/±3 internal penalty on actions counter to emotion)
- [x] Illusion (Perception+Investigation disbelieve mechanic)
- [x] Servitude (loyalty binding AE)
- [x] Overdrive pool (temp Peripheral, cap 25, dissipates scene-end) — schema field + buffer drain + addOverdriveMotes + combat end clear + UI badge + gainOverdrive moteRecovery action wired + compendium charms updated (righteous-avengers-aspect, song-of-the-depths, snarling-watchdog-retribution, hungry-wind-howling) + onAllyAttacked event wired in applyDamage + overdrive spend restricted to offensive charms only (allowOverdrive / _isCharmOffensive)
- [x] Surging Essence Reactor (Solar Integrity 3, permanent) — convertsOverdriveToAttunement flag; attunementMotes pool on CharacterData; per-artifact attunementMotesCover/attunedViaAttunement fields on weapon/armor; applyAttunementMotes() actor method; scene-end expiry + artifact un-attunement; header UI badge; inventory gem buttons; Effects tab checkbox; i18n keys; CSS; charm JSON (solar-integrity-surging-essence-reactor)
- [x] Touch keyword mechanics — Dex+MA pool roll before costs are spent; if successes ≤ target Dodge DV the charm is cancelled (no motes spent)
- [x] Training keyword (trainee XP debt ledger) — per-actor `trainingLedger` ArrayField; XP deducted immediately on Start Training; charm locked until GM completes; Experience tab table + Charms tab badge
- [x] Native keyword gating (blocks Eclipse/Moonshadow/Fiend from learning) — learn-time enforcement deferred; see [charms-gap A10](docs/charms-gap.md)
- [x] Mirror keyword navigation UI (show linked charm across splats)
- [x] Merged keyword (learn once, usable across listed Abilities) — auto-grant via mergedIds + XP suppression + prerequisite bypass already implemented; sibling routing via separate items works correctly
- [x] Martial / Martial-ready gating (weapon tag + min-ability bypass via `isWeaponValidForStyle` / `canBypassMinAbility`; enforced at attack time)
- [x] Heretical keyword (Infernal GSP-only enforcement)
- [x] Blasphemy / Axiomatic / Dawn-keyword splat-specific damage upgrades — Axiomatic: Aggravated vs Creatures of the Void + activation guard; Dawn: 8 XP flat for Dawn Caste Solars; Blasphemy: GM-whisper alert card + Roll Sensing button for nearby Celestials

## Charms
- [x] Attack tab on charm sheet (Instant rolls directly; longer durations spawn a weapon + tracking AE)
- [x] Formula builder dialog with actor-scoped live preview
- [x] Supplemental/Reflexive-step-1 charm picker in attack dialog
- [x] Charm activation ledger + Reverse button on the chat card
- [x] Typed charm costs: motes, willpower, bashing HL, lethal HL, aggravated HL, XP
- [x] XP cost confirmation dialog
- [x] Automated charm prerequisite validation
- [x] Expand prerequisite types: Virtue ≥ N, Essence ≥ N, Ability ≥ N, Background ≥ N all implemented
- [x] Permanent Essence cost (`cost.formula: "perm ess"` — general DSL field; Greater Signs uses same path)
- [x] Permanent Willpower cost (`cost.formula: "perm wp"` — general DSL field)
- [x] Attribute-keyed Excellencies for Lunar/Alchemical (charm.attribute field; activation routing)
- [x] First/Second-vs-Third Excellency exclusivity enforcement per roll
- [x] Infinite (Ability) Mastery discount tracking (committed motes reduce Excellency cost)
- [x] Essence Flow innate-powers mechanic — `system.essenceFlow: true` on CharmData; when actor owns the Essence Flow charm for the rolled ability, stunt rating adds to firstExcMax in RollDialog dynamically (per Errata)
- [x] Keyword-as-status-effect registry (systematic Compulsion/Emotion/Illusion/Servitude → AE mapping)
- [x] Charm deactivation resolver (scene-end / combat-end) — `clearSceneCharms` sweeps oneScene + action-count AEs at scene/combat end; `decrementActionCharmsFor` counts down per combatant act; indefinite/permanent untouched
- [x] Essence-tiered upgrade branches (Essence 3+/4+ conditional charm effects; gate conditions, passive/active tiers, per-tier effect sections, activation pipeline integration) — [charms-gap A2](docs/charms-gap.md)
- [x] Cooperative keyword (multi-caster charm dialog — DB aspect cooperation)
- [x] **Charm-level per-purchase variant selection** — `soakBonus.options[]` + `selectedOption`; `createItem` hook fires variant picker dialog; grouped display in `CharacterSheet` with `#expandedGroups`; Armor Plating JSON updated
- [x] **`maxPurchases` formula support** — `evalMaxPurchases()` in `charm-tree-builder.mjs`; resolves `@ess` and other rollData tokens; `getCharmState`/`getPipData` updated to use item-count model for multi-purchase charms
- [x] **Upgrade tier system** — `upgradeTiers[]` ArrayField; `charm-tier-math.mjs`; `TierSelectionDialog`; activation pipeline integrated in `activateCharm()`; `tiersApplied` in ledger
- [x] Fix consumer wiring — Unbreakable Warrior's Mastery: already has `negatesCripplingEffect: true` and no `statusApply` in source JSON — no fix needed; confirmed correct
- [x] Fix consumer wiring — Serpentine Evasion: disabled incorrect `dvBonus` (AE pipeline doesn't fire for instant charms; errata Step-2 retroactive penalty not automatable with current architecture)
- [x] Fix consumer wiring — Shockwave Technique: added `Unblockable` keyword (description says "Parry DV inapplicable")
- [x] Detect dematerialized via charm (`detectDematerialized: BooleanField`) — passively-active charm exposes `actor.canDetectDematerialized` getter; upstream gates (targeting, vision) consult this flag
- [ ] **Social attack pipeline for charms** — Presence/Performance opposed rolls with MDV; currently social bonus fields add dice/successes but the full opposed-roll pipeline (attacker pool vs MDV threshold, onslaught MDV, social-perfect defenses) is not wired to charm effects; blocks 30+ Social-keyword charms from full automation

## Social Combat
- [x] **Intimacy as first-class scored trait** (count capped at Willpower + Compassion, damage ablation = Conviction; currently stub Item type only)
- [x] **MDV axis on actor** (Dodge MDV / Parry MDV derived; social-attack dialog; MDV modifiers via AE plumbing)
- [x] Social attack rolls (Cha/Man + Presence/Performance/Investigation/Bureaucracy) with MDV resolution
- [x] Appearance delta ± up to 3 MDV
- [x] Intimacy/Virtue/Motivation MDV modifiers (−1/−2/−3 support, +1/+2/+3 oppose, immediate-danger +3)
- [x] Threshold successes → 1 WP per 3 above MDV (errata), 5 WP cap to resist
- [x] Unnatural mental influence resistance (+1 Limit/Torment/Resonance/Paradox per scene, max once)
- [x] Natural influence cap (2 WP drain per scene per attacker)
- [x] Motivation-break mechanic (permanent WP + Essence days without recovery)
- [x] Intimacy building/erosion via successful social attack (+/−1 or new Intimacy seed)
- [x] Social Combos (no Obvious display unless charm is Obvious)
- [x] Social charm bonus payload (`socialBonus` schema — charm-driven pool dice/auto-successes/penalty-ignore for social attacks; MDV debuff gap noted in spec) — [charms-gap A9](docs/charms-gap.md)
  - [x] Social attack chat card: surface `charmPoolDice` / `charmPoolSuccesses` in pool breakdown line (currently stored in ledger but not rendered)
- [x] Mental DV bonus from charms (`mentalDVBonus: NumberField`) — passively-active charms add a flat bonus to both `currentDodgeMDV` and `currentParryMDV`
- [x] Shaping immunity from charms (`shapingImmunity: BooleanField`) — social attacks flagged `isShaping` against the defender inject "Perfect Mental Defense" in Step-2
- [x] Limit Break influence immunity (`limitBreakInfluenceImmunity: BooleanField`) — at Limit 10, all influence against the defender auto-fails via "Perfect Mental Defense" in Step-2
- [x] Social success bonus formula (`socialSuccessBonusFormula: StringField`) — supplemental charm formula evaluated and added to `rollSuccesses` in `rollSocialAttack`
- [x] Intimacy protection from charms (`intimacyProtection: ArrayField { description, type }`) — social attacks targeting a named protected intimacy auto-fail via "Perfect Mental Defense" in Step-2; matched by intimacy item name (case-insensitive substring + type check)
- [x] **Formal social attack pipeline — MDV-halving** (`halveMDV: BooleanField`) — attacker charm flag; detected from `actuallyActivated` post-charm-activation in `rollAttributeAbility`; stored in social attack ledger; `preStep2EffectiveMDV` display value halved at roll time; `resolveStep2` in `social-attack-math.mjs` applies `Math.floor(rawBase / 2)` to base subtotal before Excellency dice; WP-to-resist path already handled by existing `umiCost` + `unnaturalInfluence` fields

## Sorcery & Necromancy
- [x] Spell item type (Terrestrial/Celestial/Solar; Shadowland/Labyrinth/Void)
- [x] **Shaping-action pipeline** (multi-tick action container; damage-interrupts-with-Wits+Occult roll; Essence Burn botch)
- [x] Sorcerous initiation (charm flag `grantsInitiation` — grants Terrestrial/Celestial/Solar or Necromancy access on activation)
- [x] Countermagic resolution (Emerald/Sapphire/Adamant reflexive counter, Iron/Onyx/Obsidian necro)
- [x] Countermagic cost variance by defended-circle-rank
- [x] Spell casting chat card (motes committed during shape, released at cast; reverse button)
- [x] Thaumaturgy (degrees and procedures — separate lower-power tier)
- [x] Spell-specific duration/effect payloads — Effects tab (embedded AEs) on spell sheets; target AE stamping at cast time via _createSpellEffectAe
- [x] Ghost summoning — GhostContestApp: interactive WP+Ess extended contest; bind result chat card
- [x] Binding/fetter spells — Soul Brand / Piercing the Heel / Rune of Sweet Passing use Effects tab AEs; stamped on target at cast
- [x] Demon summoning — DemonSummonFlow: Cha+Occult binding roll, circle-scaled difficulty (3/5/7), bind result chat card

## Martial Arts
- [x] Style tracking — `martialArtsStyleName` + `martialArtsTier` on charms; `martialartsstyle` item type with sheet, auto-create hook, and Martial Arts tab grouping charms by style on the character sheet
- [x] Form-type charm handling (one-at-a-time across ALL styles; scene duration; Combo-Basic)
- [x] Style weapon tag validation (M = Melee-or-MA, MO = MA-only; `isWeaponValidForStyle` enforced at attack time; style item `weapons[]` list drives allowed weapons)
- [x] Sidereal Martial Arts entry gate (requires ≥1 Celestial style mastered to Form + Sidereal sifu; `canLearnSiderealMA` hook in `preCreateItem`)
- [x] Celestial-MA DB initiation charms (Pasiap's Humility+Daana'd etc.; `grantsCelestialMA` charm flag; `canLearnCelestialMA` gate in `preCreateItem`)
- [x] Celestial-MA per-charm surcharge for Dragon-Blooded (+1m per activation)
- [x] Celestial-MA 1.5× XP for non-resonant Exalts

## Per-Splat Mechanics
- [x] **Splat subobject schema** (`system.splat.<type>.*` discriminated union per exaltType)

### Solar
- [x] Baseline Personal / Peripheral pool formulas
- [x] Caste abilities auto-flag on caste change
- [x] Anima banner auto-derived from scene peripheral spend (`system.scenePeripheral` → `system.anima` enum in `prepareDerivedData`; GM ± nudge + End Scene reset on Main tab)
- [x] Eclipse anima oath-binding mechanic (10m + 1 WP; Essence # botches on breakers)
- [x] Eclipse non-Solar charm access (2× cost, +2m activation surcharge)
- [x] Limit Break indicator (Solar/Lunar/Terrestrial/Sidereal) — red label at Limit 10 on sheet
- [x] Limit Break chat card — Virtue Flaw name + description, Full/Partial choice, WP recovery, Limit reset
- [x] Limit Break scripted scene effects (per-Virtue-Flaw mechanical consequences beyond WP gain) — data-driven `system.changes` on the VirtueFlaw item; on resolve stamps a scene-duration AE (`flags.exalted2e.limitBreakEffect`, `charmDuration:"oneScene"`, `gmOnlyRemoval`), swept by `clearSceneCharms`

### Lunar
- [x] Heart's Blood forms roster (human/animal/spirit types with stats + mutation points)
- [x] Shapeshifting actions (1m basic shift, DBT activation at 5m + Ess 2 prereq)
- [x] Deadly Beastman Transformation stat delta (+1 Str/Dex/Sta, (Ess+4) mutation points)
- [x] Tell as a tracked trait (hidden or visible; mental-influence pool implications)
- [x] Knacks item type
- [x] Health-track wraps at 10 boxes per line
- [x] Attribute-keyed charms (Excellency system uses attribute for Lunars)
- [x] Chimera Knacks gated by Casteless + Limit ≥ 5
- [x] Gift keyword auto-activation on Deadly Beastman Transformation entry — [charms-gap A6](docs/charms-gap.md)
- [x] Fury-OK charm filter during Relentless Lunar Fury (block non-Fury-OK from supplemental picker) — [charms-gap A7](docs/charms-gap.md)
- [x] **Dematerialized targeting gate** — `dematerialized` custom status added to `CONFIG.statusEffects`; gate in `rollAttack` (post-`activatedCharmItems`) blocks attacks unless `getHarmImmaterialFromCharms` or an activated `harmImmaterial` supplemental charm is active; `TargetIsDematerialized` warning toast
- [x] **Maladic capture + transfer** — Lunar charm mechanic to capture a spirit's Essence pattern (a malados) and transfer it to another being; requires a `malados` item type or AE wrapper and a transfer dialog
- [x] **Background grant via charm** — Lunar charms that temporarily grant a Background to an ally (e.g. Sharing the Gifts of Luna); requires a transient Background item stamped on the ally actor with a cleanup AE
- [x] **Linked NPC template** — charm that creates or binds a specific NPC actor as a companion (spirit ally, familiar); token linked to the charm's active state; teardown on deactivation

### Dragon-Blooded
- [x] Aspects & breeding (Breeding 1-5 mote-pool bonus)
- [x] Out-of-aspect charm activation surcharge (+1m)
- [x] Water Aspect Terrestrial-MA no-surcharge exemption
- [x] Anima flux damage at 11+ banner (environmental — scene effect)
- [x] Charm cooperation (multi-DB pooled costs)
- [x] Family / House background linkage

### Sidereal
- [~] Arcane Fate trait — OUT OF SCOPE; purely narrative, ST-controlled, no mechanical implementation planned
- [x] **Paradox** track (0-10; pattern bite at 10; −1 per 3 months; Wrapped Fly / Ritual of Expiation)
- [x] Resplendent Destiny — Phases 1, 2a, 2b, 3 all done. Phase 1: `resplendent` destinyType + College/Identity/Endurance fields; wear/carry with one-worn identity AE; don costs 1 WP; disguise roll (Man+Larceny+3); Endurance auto-end at 0 via updateItem hook. Phase 2a: `resplendency` item type + sheet; powers drop onto a destiny (`parentDestinyId` flag) and list in its body; `activateResplendency` spends Endurance, rolls Paradox dice into the Sidereal track, stamps stat-bonus AEs (`flags.exalted2e.resplendencyEffect`, torn down on destiny-end and resp-remove), posts a chat card. Phase 2b: all 75 Resplendencies authored (25 colleges × 3) in `src/packs/resplendencies/` as descriptive powers (rules text in description) — needs `fvtt package pack` to build the live pack. Phase 3: Resplendent Paradox table (`EX2E.resplendentParadoxTriggers` + `sumResplendentParadoxDice`) as a GM-only checklist dialog (`ResplendentParadoxDialog`) launched from the character sheet beside the Paradox track; `applyResplendentParadox` rolls the summed dice, adds raw successes to the track (Pattern Bite fires at 10), posts a chat card. (Ascending/Descending destinies are a separate concept, already shipped.)
- [x] Astrological Colleges trait (7 dots; ≥4 in own Maiden's 5)
- [x] Greater Signs (Essence 4+, 10m; permanent Essence & Willpower cost; chat card reversal)
- [x] Sidereal Martial Arts gating (see Martial Arts section)

### Abyssal
- [x] Castes (mirror Solar with deathknight labels)
- [x] Resonance / Dark Fate track (0-10) — track = Limit track, labelled "Resonance"; eruption warning at 10
- [x] Resonance vent roll (Essence dice; each success reduces Resonance by 1 and banks 1 point for Resonance effects; failure increases Resonance by 1 and triggers a Resonance effect at Permanent Essence level)
- [x] Banked Resonance points storage and spending UI
- [x] Resonance eruptions (Blight / Branding / Conduit / Stigmata effect scripts)
- [x] ST-triggered eruption button (GM-only)
- [x] Whispers trait (Conduit effect cap)
- [~] Monstrance of Celestial Portion — `isMonstrance` + `deathlord` fields on Background item; full mechanics pending
- [x] Moonshadow non-Abyssal charm access (16 XP, +2m activation)
- [x] Creature of Darkness flaw (GM-only removal, flag-based detection)
- [x] Ravening Mouth of (Ability) mote recovery — hook into the damage step of `rollAttack`; when a Ravening Mouth AE is active for the attacking ability, regain 1m per HL of damage dealt to sentient beings (non-undead, non-automaton target flag); cap 20m per action across all Ravening Mouth effects; no recovery from spells or ongoing/poison damage ticks
- [ ] **Overwrite pool** — Abyssal-specific temporary mote pool funded by spending successes or HL; distinct from the Overdrive pool (Overdrive feeds from damage taken; Overwrite feeds from spending successes/HL to fuel specific charm costs); requires a new `overwritePool` schema field and a separate spend path in the mote-cost resolver

### Infernal
- [x] Castes (Slayer / Malefactor / Defiler / Scourge / Fiend)
- [x] Yozi patron assignment (charm tree discriminator)
- [x] Urge trait (Motivation-like Yozi-pleasing drive)
- [x] Torment track (Limit-variant; Yozi-themed eruptions)
- [x] Act of Villainy counter
- [x] Heretical charms gating (GSP-only; 9 XP)
- [x] Fiend non-Infernal charm access (16 XP, +2m activation)
- [x] Shintai / Mantle form-type charms (Yozi-specific transformation state) — handled by the existing generic Form-type machinery (`module/combat/form-charms.mjs`: a charm keyworded `Form-type` enforces one-form-at-a-time, stamps a transformation-state AE from its effect fields via `buildCharmSynthAEs`/`applyCharmAEs`, and reverts on toggle-off / `clearActorForms` at scene end). Audited the 7 Infernal shintai/mantle charms: the 4 self-transforms (All-Devouring-Depths, Tenebrous-Apotheosis, Devil-Tyrant-Avatar, Scarlet-Rapture) are tagged `Form-type` — **fixed Scarlet Rapture's broken `Form-Type` casing** that silently disabled it; Devil-Tyrant's +Essence soak is wired (`soakBonus @ess`). The non-transforms (Black-Mirror = instant cheating charm; Soul-Sand-Devil & Impervious-Primacy-Mantle = permanent passives) are correctly NOT Form-type. Remaining shintai effects (aggravated/mote-drain attacks, granted-charm bundles, mutations, conditional Str/movement, dematerialization) are bespoke and stay descriptive. **Note:** Scarlet Rapture's charm JSON has an empty description — it now registers as a form but needs its rules text + effect fields to do anything.

### Alchemical
- [x] Castes (incl. Adamant)
- [x] **Charm Slots** (4 General + 4 Dedicated; install/uninstall flow; committed-motes cost per slot)
- [x] Submodules (slot-within-slot installations)
- [x] Clarity track (0-10; Virtue-suppression & contact-deprivation triggers)
- [x] Gremlin Syndrome / Dissonance path — `dissonance` 0-10 field + Main-tab nudge track; at 10 an updateActor hook stamps a `creatureOfVoid`/`gremlinSyndrome` AE + GM-whisper alert with Convert-to-Antagonist button; drops below 10 remove the AE
- [x] Installed armor (subcutaneous / exoskeletal plating — different from equipped armor)
- [x] Weaving protocols (Man-Machine / God-Machine as sorcery mirror)
- [~] Adamant caste hidden-from-society rules

### Mortal
- [x] Mortal-specific sheet variant (hide Essence/Mote/Charm sections, anima, limit track, virtue flaw)
- [x] Terrestrial-only sorcery/MA restrictions (universal `grantsInitiation` charm flag covering all traditions + circles)
- [x] No Excellencies enforcement

## Creatures / Traits
- [x] Creature of Darkness flaw (GM-only removal, no token HUD icon, flag-based detection)

## Penalty System
- [x] External / internal penalty aggregators on the actor
- [x] Prone (external −1, physical) via the built-in status
- [x] Aborted-Aim internal −2 (next-action tax)
- [x] Armor mobility penalty → internal physical
- [x] Wound penalty applied in `rollAttributeAbility` (previously attack-only)
- [x] Starmetal target-imposed external attack penalty
- [x] Fatigue penalty mechanic (armor fatigue scene-long exertion → Sta+Res rolls)

## Character Sheet
- [x] Effects tab — split into temporal (durationed / dvRefreshable) and permanent
- [x] Row-per-penalty-level health track with per-level bonus boxes (−0, −1, −2)
- [x] Intimacies section (cap enforcement + ablation UI once Intimacy trait is scored)
- [x] MDV derived display (Combat tab)
- [x] Anima banner auto-calculated display (tier shown on Main tab; caste anima power widget with Activate / Deactivate / View buttons)
- [x] Per-splat tab(s) surfacing splat-specific mechanics (Sidereal Paradox, Abyssal Resonance, Infernal Torment/Urge, etc.) — `tabSplat` (diamond icon) shown for Abyssal/Infernal/Lunar/Alchemical via `beh.showSplatTab`; Abyssal Whispers as dotRating, Infernal Patron + FavoredYozi, Lunar heartsblood forms, Alchemical Clarity permanent
- [x] Virtue Channel counter (per-story, not per-scene) — `channeled: BooleanField` on each virtue; checkbox on virtue row in tab-main.hbs

## Virtues & Willpower
- [x] Permanent + temporal virtue tracks
- [x] Willpower minimum = sum of two highest Virtues
- [x] Virtue channel action (spend 1 WP + Virtue, add Virtue dice, consumes per-story channel slot)
- [x] Willpower recovery hooks (rest, stunt reward)
- [x] Limit accumulation automation (Virtue suppression → Limit gain on primary virtue; UMI → +1 Limit already implemented)
- [x] Limit Break scripting at 10 (per-Virtue-Flaw scene template) — see Solar/Virtues section; data-driven break AE stamped on resolve, scene-swept
- [x] **Formal virtue roll pipeline** — `virtueRollTrigger: SchemaField { enabled, virtue, difficulty }` on `CharmData`; consumer in `activateCharm` (item.mjs) rolls the Virtue pool and posts to chat; UI controls on Effects tab with virtue select + difficulty number; i18n in en.json/es.json
- [x] Virtue recovery via charm event (`virtueRecovery: { enabled, virtue, event }`) — passively-active charm restores the spent channel on a named virtue when the specified event fires (`onEndScene`/`onDamageReceived`); wired in `_fireRecoveryEvent` and `#onEndScene`

## Experience / Purchase Tracking
- [x] Purchase Mode toggle + enforcement (block reductions, log XP on increases)
- [x] Purchase log UI on Experience tab
- [x] XP Cost Engine
- [x] XP cost tables per exalt type (Terrestrial out-of-aspect surcharges, etc.)
- [x] Purchase Mode support for NPC-typed actors — `purchaseLocked` field in NpcData; toggle button injected in NpcSheet._onRender; #onTogglePurchaseMode handler
- [x] Per-trait lock overrides — PurchaseConfirmDialog gains GM-only "Bypass XP" button; resolves with xpCost=0 so trait is applied without XP deduction
- [x] Background-method setting — world setting `backgroundMethod` (xp/free); _priceBackground returns 0 when free

## Stunts & Drama
- [x] Stunt dice in roll dialog
- [x] Auto mote/WP reward on successful stunted action (at DV refresh)
- [x] Stunt-on-perfect (ST adjudication; no automation needed)
- [x] Motivation-advance WP reward (ST adjudication; no automation needed)

## The Circle / Party Management
- [x] The Circle folder seeder + auto-configure actors (linked token, Friendly disposition)
  - [x] Special buttons on the folder (party roll, XP award, rest-and-recover) — `renderActorDirectory` hook injects Party Roll / Award XP / Rest buttons on The Circle folder header
  - [x] Macro to manually re-create the folder if deleted
  - [x] Restoring defaults when an actor leaves The Circle

## Compendium
- [x] Effects compendium (`exalted2e.effects`) seeded at ready with Creature of Darkness
- [x] Effect-wrapper pattern for drag-to-actor drops
- [x] Anima powers compendium (`exalted2e.animapowers`) seeded at ready; 34 entries covering all castes across all exalt types
- [x] Pre-built charms compendium (Solar Ability charms + multi-splat coverage; upgrade and fix as needed)
- [x] Pre-built weapons / armor compendia (with magical material variants; upgrade and fix as needed)
- [x] Pre-built spells compendium (Terrestrial through Solar circles + Shadowlands/Labyrinth/Void; upgrade and fix as needed)
- [x] Pre-built artifact compendium — hearthstones pack complete; daiklaves and armors covered; upgrade and fix as needed
- [x] Status effects compendium — Blind, Deaf, Stunned, Grappled/Clinched, Crippled, Height Advantage seeded; Poisoned/Diseased enriched via Foundry built-ins; Knockdown handled by Prone

## Other Mechanics
- [x] Anima powers per exalt type and caste (embedded `animapower` item on actor; 34-entry compendium; swapped on caste/exaltType change; manual activate/deactivate with mote + WP cost)
- [x] Auto-activate caste anima power at ≥11m peripheral scene spend (bonfire threshold)
- [x] Anima flux (DB environmental damage + visual region ring following token; Abyssal Resonance effects shipped)
- [x] Resonance track and eruptions (Abyssal) — see Abyssal splat
- [x] Torment / Act of Villainy tracking (Infernal) — see Infernal splat
- [x] Clarity mechanical effects (Alchemical) — social/mental/autochthon already wired; Compassion penalty + auto-fail now surface as Main-tab display badges (GM-enforced per design)
- [x] Paradox track (Sidereal) — see Sidereal splat
- [x] Poison / Disease tracking — affliction is a flagged AE on the victim (`flags.exalted2e.affliction` snapshot + poison `remainingIntervals`; carries the poisoned/diseased status). `module/combat/affliction.mjs`: `afflictTargets` (from the poison/disease item sheet's "Afflict targets" button → game.user.targets/selected; poison prompts for interval count), `advanceAffliction` (poison: roll Stamina+Resistance, apply net damage via applyDamage, decrement/expire; disease: resist-to-shake-off vs morbidity), `treatAffliction` (both kinds: Int+Medicine by a selected physician or self vs morbidity/damage → cure), `removeAffliction`. Managed from an Afflictions panel on the character sheet (Advance/Treat/Remove); all post a shared chat card. (Manual advance only — combat-tick auto-fire, drug effects, and free-text duration parsing beyond a leading integer are out of scope.)
- [x] Crippling injuries (4+ HL single hit; surgery Int+Medicine to heal)
- [x] Environmental hazards (Damage/interval, Trauma; generic Scene Region behavior with resistance rolls, terrain cost, and GM placement flow)
- [x] Mass combat (unit actor type: Magnitude, Drill, Might, Endurance, Morale, formations, commander + relays + heroes; Guard DV bonus; unit DV pipeline; chokepoint informational system — Phases 1–9 complete)
- [x] Artifact creation rules (extended Craft roll; Craft+Lore+Occult; seasons interval; Craft/Lore/Occult ability minimums per rating enforced in new-project dialog with pip blocking; `artifactAbilityReduction` charm effect M20 reduces thresholds; Wonder-Forging Genius wired)
- [x] **Manse** item type (rating, aspect, powers budget; linked to Background for rating + Hearthstone for aspect)
- [x] **Hearthstone** item type (rating, type, mote-regen, socketable into artifact weapons/armor/equipment)
- [x] **Artifact** item type (general; non-weapon/armor artifacts) — covered by `equipment` item type with `artifact: true` flag (magical material, attunement, hearthstone slots)
- [x] **Mutation** item type (mutationType positive/negative/neutral, pointCost; no mechanics yet)
- [x] **Poison** item type (damage, damageType, interval, duration, vector; no mechanics yet)
- [x] **Disease** item type (morbidity, trauma, duration, vector; no mechanics yet)
- [x] **Drug** item type (effect, duration, addiction; no mechanics yet)
- [x] **Vehicle / Warstrider** actor type (First Age magitech)
- [x] **Unit** actor type for mass combat
- [~] Background mechanical hooks — Familiar (actor link, species, bond rating, linked actor creation into The Circle/Familiars), Cult (mote regen / WP recovery from dot rating), Command (war dice) and Followers (magnitude) done via dedicated item types + `_prepareXxxData` rating tables; 53-type registry with optgroup display. Backing / Contacts / Resources are intentionally **narrative-only** (ST-adjudicated) — no automation planned for now (decision 2026-06-04). Item parked pending the user identifying specific automations worth building.
- [x] Willpower recovery on virtue channel success (no recovery per rules; WP spent is the cost)
- [x] Scene-end reset (anima step-down done; Peripheral-spend counter, per-scene WP drain counters)
- [x] Overdrive pool display on character sheet — `system.motes.peripheral.overdrive` already rendered in `header.hbs` (lines 93–94) as a conditional `+N` badge with `OverdriveTooltip` i18n; already complete

## Crafting
- [x] Craft specializations (Fire, Water, Air, Earth, Wood, Magitech, etc.) — multiple named Craft variants with independent dot ratings, XP costs (inherits Caste/Favored), and roll integration with per-variant charm gating
- [x] Mundane crafting roll resolver (Int/Per+Craft vs Resources diff; extended for large items)
- [x] Artifact extended-roll builder (Rating cumulative successes; seasons interval; exotic ingredient tracker)
- [x] Workshop & material prerequisites UI — workshop quality (5 tiers → −4..+4 dice) + assistants (mortal/lesser/greater/mighty → bonus successes) selectable in both crafting roll dialogs and persisted per project; Words-as-Workshop Method charm flag (`system.wordsAsWorkshop`) floors the workshop at Master's; artifact ingredients soft-warn before rolling; crafting-tab rows show workshop/assistant summaries. (Ability prereqs + charm reduction were already done.)
- [x] Manse geomancy rules (Oadenol's Codex) — Phase 1 (Creation Point economy) done: budget = rating×2 + drawbacks (Maintenance ×1 / Fragility ×2 / Habitability ×1) + hearthstone-level sacrifice (+1/level) + Design Beyond Limit (+10 at rating 5); `manseBudgetState` helper + sheet CP breakdown; power cost 0–5 with `isMaterial` overriding the value≤rating cap; hearthstone link gated by `rating − hearthstoneReduction`. **Phase 2a** (powers-catalog machine) done: new `manse-power` item type (cost/aspectFavored/onlyAspect/abilityReq/multiPurchase/isMaterial/description) with its own sheet; `MansePowerPickerDialog` lists manse-power items (compendium + world) grouped by point value, applies the aspect-favored −1 discount and gates eligibility (over-rating, only-aspect), greys already-added non-multiPurchase powers; "Add from catalog" copies a `{name,cost,isMaterial}` snapshot onto the manse's `powers[]` (Phase 1 budget counts it) alongside "Add custom". **Phase 2b** done: full Oadenol's Codex catalog authored in `src/packs/manse-powers/` — 65 manse-power source JSONs (0pt:3, 1pt:8, 2pt:14, 3pt:18, 4pt:12, 5pt:10) with cleaned rules descriptions, aspect-favored/only tags, ability-req text, and multiPurchase flags; needs `fvtt package pack` to build. (Caveats: `isMaterial` defaults false on all — the source doc lost the book's italics that mark material/placed-after powers, so flag those manually; 3 trap/elemental-attack powers — Dangerous Traps, Ultra-Deadly Traps, Dragon's Will — have condensed mechanics descriptions to avoid content-filter issues. Ink Monkeys/Errata powers are additive drops.) **Phase 3** done: construction + Power Failure via `module/combat/manse-construction.mjs` — capping roll (Per+Lore diff 1, botch→Essence-buildup notice); per-power design roll (Int + lowest(Occult,Lore) vs cost+3, gated on Lore & Occult ≥ cost+2) setting a per-power `status` (pending/designed/damaged); `applyManseDamage` cascades Power Failures against a fragility-scaled threshold (×20/×10/×5/1), rolls the maintenance-modified Essence-buildup die per failure, and destroys the manse at effective rating 0; repair roll (diff 3) restores a level; all via a shared chat card; surfaced in a "Construction & Damage" sheet section + per-power Status column. (Out of scope, ST narrative: combat stress-points, partial-cap mutation timeline, sorcerous/shadow construction, hearthroom suggestion; *Armored*/*Fortress* soak/threshold not auto-applied.) **Manse geomancy is fully implemented.** Source rules in docs/manse-design.md.

## Quality of Life
- [x] Drag-and-drop items between sheets — move semantics for weapon/armor/background/meritflaw between actor sheets; non-transferable types (charm, spell, etc.) blocked with warning
- [x] Automated charm prerequisite validation
- [x] Charm Tree Dialog — visual prerequisite tree per splat + ability/attribute; branch navigation; actor purchase state (owned / purchasable / locked / available card states)
- [x] GM "Roll a Pool" dialog — ad-hoc dice roller that picks up the standard penalty machinery
- [x] Keyword-effect registry for systematic status application (completed under Charm Keywords; duplicate entry)
- [x] Effect-flag registry file documenting every `flags.exalted2e.*` semantic role
- [x] Migration pipeline for schema changes as system evolves (module/migration/, semver-keyed forward-only, baseline 1.1.0)
- [x] Language-drift linter (en.json ↔ es.json key parity)
- [x] Multi-actor action helpers (Coordinate, Cooperative charms, mass Guard) — mass Guard added: GM HUD button guards all selected canvas tokens' combatants at once (`module/combat/mass-guard.mjs`), one combined card, skips non-combatants with a warning
- [x] Personal/Peripheral commitment split — DialogV2 in `_preUpdate` lets players choose pool when both have motes; chosen pool stored in `flags.exalted2e.attunePool`; un-attune/delete refunds to same pool

## Testing
- [x] Vitest suite (pure-logic helpers, math modules, prepareDerivedData)
- [x] Quench integration tests (in-Foundry: attack pipeline, social combat, stunt rewards, purchase/attunement)
- [x] Headless tests for remaining paths — implemented as a **headless Quench runner in CI**: GitHub Actions boots Foundry (felddy Docker) with a committed `exalted2e-test` world + Quench, Playwright runs all batches and gates CI, with a V8 coverage report over `module/**`. Pure parser/summarizer (`tools/ci/*.mjs`) unit-tested; infra validated by CI iteration (needs Foundry secrets). See `tools/ci/README.md`. (Charm-prereq/multi-tick/sorcery pure paths already had Vitest coverage.)
- [x] **Coverage-raising initiative — COMPLETE** — lifted combined (Vitest∪Quench) coverage worst-first per directory via extract-pure→Vitest + Quench render/shell smokes. SP1 region-behaviors, SP2 dialog extraction, SP2b dialog shells, SP3 item sheets, SP4 actor sheets, SP5 apps — all done — plus a regression-floor CI gate. Vitest ~1394; Quench batches: region-behaviors, item-sheets, actor-sheets, dialog-shells, app-shells. Two real bugs caught+fixed (RegionBehavior types unregistered in system.json; anima-power-sheet multi-root template). Specs/plans under `docs/superpowers/{specs,plans}/2026-06-06-coverage-*`.
  - [x] SP1 — quick 0% wins: `module/data/region-behaviors/*` + `module/sheets/_edit-image.mjs`. Extracted `hazard-math.mjs` (pure, Vitest); refactored `hazard-damage.mjs` onto it; removed obsolete `_onEditImage` Tokenizer hook + Vitest'd `editImageAction`; Quench batch `exalted2e.region-behaviors` (terrain schema + hazard apply-path smoke).
  - [x] SP2 — `module/dialogs` pure-logic extraction (extraction-only): 7 dialogs' trapped math → tested helpers (`excellency-math` budget de-dup ×3, `coordination-math`, `sidereal-destiny-math`, `eruption-math`, `anima-fx-math`, `social-attack-math` filters, `flurry-math`). +37 Vitest cases. Dialog-shell Quench smokes deferred to SP2b.
  - [x] SP2b — Quench shell smokes for the dialog shells: `tests/quench/dialogs/dialog-shells.mjs` (batch `exalted2e.dialog-shells`) — one render smoke per the 20 uncovered dialogs (construct → render → assert element → close). CI-verified.
  - [x] SP3 — `module/sheets/item` (~2115). **Phase A (extraction)**: 8 helpers — dot-rating (×4 dup), socketed-slots (×3 dup), spell-circle (×2 dup), background-tables (×4 dup), manse soak-ref + reuse design-reqs, destiny option normalize, combo-helpers, charm-sheet-helpers. +34 Vitest. **Phase B (Quench shell smokes)**: `tests/quench/sheets/item-sheets.mjs` — render+name round-trip per Item subtype + 3 targeted action smokes (charm keyword, combo removeCharm, manse addMansePower). CI-verified.
  - [x] SP4 — `module/sheets/actor`. **Phase A (focused extraction)**: character-sheet pure logic → `character-sheet-helpers.mjs` (greater-sign, stackable dedup, anima cost, purchase-log overdraft, effects, ability-groups), `combo-display.mjs`, `spell-helpers.spellInitiationStatus`; dot-rating de-dup (char+unit). npc left as-is (real divergence). +21 Vitest. **Phase B**: `tests/quench/sheets/actor-sheets.mjs` (batch `exalted2e.actor-sheets`) — render+name round-trip per actor type. CI-verified.
  - [x] SP5 — `module/apps`. Extracted 5 in-dialog fns → `app-dialog-helpers.mjs` (isNumbersEligible, buildFormationOptions, buildHeroWeaponRows, parseManualTick, parseTierSelection); 4 apps delegate. +13 Vitest. Quench batch `exalted2e.app-shells` renders mass-combat-action / import (item+actor) / hero-mass-combat / join-war. (charm-tree already covered; tier-selection render skipped — blocking DialogV2.)
  - [x] Regression-floor gate on the CI `coverage` job — `tools/ci/coverage-gate.mjs` (`evaluateCoverageGate`, Vitest-tested) + `merge-coverage.mjs` exits non-zero when combined lines < `COVERAGE_MIN_LINES` (66, tune up); skips on incomplete inputs so a degraded Quench run doesn't false-fail.

## Documentation (internal)
- [x] docs/sysref-index.md — catalog of every PDF + topic lookup
- [x] docs/mechanics-reference.md — distilled rules by system
- [x] docs/gap-analysis.md — architectural notes (partially stale; see git log for resolved gaps)
- [x] docs/Experience.md — XP cost tables per exalt type
- [x] docs/charm-authoring.md — guide for authoring charms that plug into the activation pipeline
- [x] docs/npc-stat-blocks.md — templates for common antagonists

## Notes
- Anything under `docs/` stays out of git per project preference.
- When authoring new mechanics, grep `docs/_extraction/errata.txt` and `ink-monkeys.txt` FIRST — several revisions supersede Core.
- Minimum damage is **1 die**, not Essence dice (errata).
- Combos cost 0 XP and 0 WP to create/activate (errata).
- Stunting applies to DV the same way it applies to pools (errata).
- Equipment bonuses DO NOT STACK — highest per category only (errata).
- MDVs always round down — no Essence-2+ round-up (RAW).
- Socialize is social-stealth, not a social-attack ability (excluded from attack pools).
- Terrestrial Excellency caps on ability + best applicable specialty (never attribute).
