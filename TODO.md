# TODO — Exalted 2nd Edition Foundry VTT System

**Progress: 214 / 264 complete** (10 out-of-scope / partial — last updated 2026-05-28 — added artifact ability prereq system + M20 charm effect)

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
- [ ] Limit Break scripted scene effects (per-Virtue-Flaw mechanical consequences beyond WP gain)

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

### Infernal
- [x] Castes (Slayer / Malefactor / Defiler / Scourge / Fiend)
- [x] Yozi patron assignment (charm tree discriminator)
- [x] Urge trait (Motivation-like Yozi-pleasing drive)
- [x] Torment track (Limit-variant; Yozi-themed eruptions)
- [x] Act of Villainy counter
- [x] Heretical charms gating (GSP-only; 9 XP)
- [x] Fiend non-Infernal charm access (16 XP, +2m activation)
- [ ] Shintai / Mantle form-type charms (Yozi-specific transformation state)

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
- [ ] Limit Break scripting at 10 (per-Virtue-Flaw scene template)

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
- [ ] Poison / Disease tracking (item types + per-interval AE)
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
- [~] Background mechanical hooks — Familiar (actor link, species, bond rating, linked actor creation into The Circle/Familiars) and Cult (mote regen / WP recovery from dot rating) done; 53-type registry with optgroup display; Backing / Contacts / Resources mechanical automation still pending
- [x] Willpower recovery on virtue channel success (no recovery per rules; WP spent is the cost)
- [x] Scene-end reset (anima step-down done; Peripheral-spend counter, per-scene WP drain counters)

## Crafting
- [x] Craft specializations (Fire, Water, Air, Earth, Wood, Magitech, etc.) — multiple named Craft variants with independent dot ratings, XP costs (inherits Caste/Favored), and roll integration with per-variant charm gating
- [x] Mundane crafting roll resolver (Int/Per+Craft vs Resources diff; extended for large items)
- [x] Artifact extended-roll builder (Rating cumulative successes; seasons interval; exotic ingredient tracker)
- [x] Workshop & material prerequisites UI — workshop quality (5 tiers → −4..+4 dice) + assistants (mortal/lesser/greater/mighty → bonus successes) selectable in both crafting roll dialogs and persisted per project; Words-as-Workshop Method charm flag (`system.wordsAsWorkshop`) floors the workshop at Master's; artifact ingredients soft-warn before rolling; crafting-tab rows show workshop/assistant summaries. (Ability prereqs + charm reduction were already done.)
- [ ] Manse geomancy rules (Oadenol's Codex) — manse power table, demesne pre-roll

## Quality of Life
- [x] Drag-and-drop items between sheets — move semantics for weapon/armor/background/meritflaw between actor sheets; non-transferable types (charm, spell, etc.) blocked with warning
- [x] Automated charm prerequisite validation
- [x] Charm Tree Dialog — visual prerequisite tree per splat + ability/attribute; branch navigation; actor purchase state (owned / purchasable / locked / available card states)
- [x] GM "Roll a Pool" dialog — ad-hoc dice roller that picks up the standard penalty machinery
- [x] Keyword-effect registry for systematic status application (completed under Charm Keywords; duplicate entry)
- [x] Effect-flag registry file documenting every `flags.exalted2e.*` semantic role
- [ ] Migration pipeline for schema changes as system evolves
- [x] Language-drift linter (en.json ↔ es.json key parity)
- [ ] Multi-actor action helpers (Coordinate, Cooperative charms, mass Guard)
- [x] Personal/Peripheral commitment split — DialogV2 in `_preUpdate` lets players choose pool when both have motes; chosen pool stored in `flags.exalted2e.attunePool`; un-attune/delete refunds to same pool

## Testing
- [x] Vitest suite (pure-logic helpers, math modules, prepareDerivedData)
- [x] Quench integration tests (in-Foundry: attack pipeline, social combat, stunt rewards, purchase/attunement)
- [ ] Headless tests for remaining paths: charm prerequisite edge cases, multi-tick state machine, sorcery interruption

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
