# TODO — Exalted 2nd Edition Foundry VTT System

Pending features based on Exalted 2nd Edition core rules + errata + Ink Monkeys + per-splat Manuals.
See [docs/mechanics-reference.md](docs/mechanics-reference.md) for the rule targets and [docs/gap-analysis.md](docs/gap-analysis.md) for architectural notes.

## Combat System
- [x] Attack resolution (pool vs DV, damage roll, threshold)
- [x] Multi-step attack resolution (Steps 1 / 2 / 4 / 5 / 8 / 9 on the attack card)
- [x] Canvas target picker when no token is pre-targeted
- [x] Range check (melee ≤ 1 square, Reach ≤ 2; ranged ≤ `effectiveRange`)
- [ ] Range bands (short/medium/long) with tiered penalties (currently binary in-range / out-of-range)
- [x] Flurries
  - [x] Declaration dialog (action rows, per-mode rate caps, draw-then-attack)
  - [x] Dice penalty applied in `rollAttack`
  - [x] DV penalty stamped as AE on the actor
  - [x] Finish Turn advances by the flurry's max Speed
- [x] Combos (charm combo creation, activation)
  - [ ] Combo-building rules (size limits, keyword restrictions, pre-errata constraints)
  - [ ] Combo-Basic keyword enforcement (Form-type MA charm + reflexive only) per errata
  - [ ] Flaw-of-Invulnerability + Form-type Combo +2 WP surcharge
  - [ ] Shared / compendium-sourced Combos (drag-in from packs)
  - [ ] Drag-reorder within the Combo sheet (v1 uses arrow buttons)
  - [ ] Consolidated single chat card + combined Reverse (fallback if chat gets too noisy)
  - [ ] NPC Combos
- [x] **Knockback / Knockdown / Stunning** (Stamina + Resistance resist rolls, Prone + stun AE)
- [ ] **Clinch / Grapple** (control pool, opposed rolls, throw/crush/hold sub-actions, renew-each-tick)
- [x] Tick system (Speed-based initiative)
  - [x] `ExaltedCombat` sorts ascending; same-tick tiebreaker Dex → Wits → name → id
  - [x] Join Battle (all / NPCs-only) + canonical `tick = maxSuccesses − mySuccesses`
  - [x] Finish Turn control; per-combatant initiative button swapped to d10
  - [x] Auto-advance on Roll Damage (charge the attacker Speed ticks automatically)
  - [x] Actions quickbar (Move 5, Guard 3, Aim 5, Rise 5, Draw 5, Inactive 5)
- [x] DV refresh tracking — AE-driven, cleared when the combatant's turn starts
- [x] Onslaught penalty (−1 DV per attack received; reuse the DV-penalty AE plumbing)
- [ ] **Coordinated attacks** (leader Cha+War, target DV reduced by successes cap unit size)
- [ ] **Mounted combat** (Ride-controlled mount stats, charge bonuses, lance mechanics, Ride charms per splat)
- [ ] Cover modifiers (buckler / target / tower / %-cover) +DV bonuses
- [ ] Height advantage (+1/+3 DV close combat)
- [x] **Multi-tick action container** — for shaping sorcery, Aim banking across ticks, clinch renewal, extra-action charm flurries with their own tick scheduling
- [ ] Aim bonus banking (one die per banked tick, consumed on aimed attack)
- [ ] Aborted-Aim divert penalty (already partial: -2 internal penalty applied in combat.mjs)
- [ ] Minimum-damage errata swap (currently 1 die; confirm no Essence-dice fallback path)

## Combat — Defense & Soak
- [x] Dodge DV / Parry DV formulas, weapon-mode parry selection
- [x] Essence-2+ rounds DVs up
- [x] Armor soak aggregation (equipped armor + natural)
- [x] Artifact commitment feedback on mote maxima
- [x] Hardness model (per armor)
- [ ] Shields as weapons (errata: Sh0/Sh1/Sh2 tag-driven shields with mobility penalty, no longer "mobile cover")
- [ ] Cover modifiers
- [ ] Starmetal armor: target-imposed external attack penalty
- [ ] Fatigue penalty (armor fatigue triggering Stamina+Resistance rolls over scene-length exertion)

## Charm Keywords
- [x] Unblockable / Undodgeable (target DVs → 0, buttons stay live for Perfect counters)
- [x] Perfect Dodge / Perfect Parry (attack short-circuits; bypasses Unblockable/Undodgeable)
- [x] Holy (upgrades bashing/lethal → aggravated vs Creature of Darkness)
- [x] Counterattack (already wired via Step 9)
- [ ] Action-Only (reflexive charms gated to acting ticks, once per tick)
- [ ] Stackable (allow multi-activation accumulation on same target)
- [ ] Compulsion (scene-long forced-task AE on target)
- [ ] Emotion (scene-long ±1/±3 internal penalty on actions counter to emotion)
- [ ] Illusion (Perception+Investigation disbelieve mechanic)
- [ ] Servitude (loyalty binding AE)
- [ ] Overdrive pool (temp Peripheral, cap 25, dissipates scene-end)
- [ ] Touch keyword mechanics (requires Dex+MA attack vs non-consenting target)
- [ ] Training keyword (trainee XP debt ledger)
- [ ] Native keyword gating (blocks Eclipse/Moonshadow/Fiend from learning)
- [ ] Mirror keyword navigation UI (show linked charm across splats)
- [ ] Merged keyword (learn once, usable across listed Abilities)
- [ ] Martial / Martial-ready gating at charm-learn time
- [ ] Heretical keyword (Infernal GSP-only enforcement)
- [ ] Blasphemy / Axiomatic / Dawn-keyword splat-specific damage upgrades (mirror of Holy)

## Charms
- [x] Attack tab on charm sheet (Instant rolls directly; longer durations spawn a weapon + tracking AE)
- [x] Formula builder dialog with actor-scoped live preview
- [x] Supplemental/Reflexive-step-1 charm picker in attack dialog
- [x] Charm activation ledger + Reverse button on the chat card
- [x] Typed charm costs: motes, willpower, bashing HL, lethal HL, aggravated HL, XP
- [x] XP cost confirmation dialog
- [x] Automated charm prerequisite validation
- [ ] Expand prerequisite types: Virtue ≥ N, Essence ≥ N, Ability ≥ N, Background ≥ N
- [ ] Permanent Essence cost (Sidereal Greater Signs, Infernal shintai)
- [ ] Permanent Willpower cost
- [x] Attribute-keyed Excellencies for Lunar/Alchemical (charm.attribute field; activation routing)
- [ ] First/Second-vs-Third Excellency exclusivity enforcement per roll
- [ ] Infinite (Ability) Mastery discount tracking (committed motes reduce Excellency cost)
- [ ] Keyword-as-status-effect registry (systematic Compulsion/Emotion/Illusion/Servitude → AE mapping)
- [ ] Charm deactivation resolver (scene-end / combat-end / out-of-motes)
- [ ] Cooperative keyword (multi-caster charm dialog)

## Social Combat
- [ ] **Intimacy as first-class scored trait** (count capped at Willpower + Compassion, damage ablation = Conviction; currently stub Item type only)
- [x] **MDV axis on actor** (Dodge MDV / Parry MDV derived; social-attack dialog; MDV modifiers via AE plumbing)
- [x] Social attack rolls (Cha/Man + Presence/Performance/Investigation/Bureaucracy) with MDV resolution
- [x] Appearance delta ± up to 3 MDV
- [x] Intimacy/Virtue/Motivation MDV modifiers (−1/−2/−3 support, +1/+2/+3 oppose, immediate-danger +3)
- [x] Threshold successes → 1 WP per 3 above MDV (errata), 5 WP cap to resist
- [x] Unnatural mental influence resistance (+1 Limit/Torment/Resonance/Paradox per scene, max once)
- [x] Natural influence cap (2 WP drain per scene per attacker)
- [x] Motivation-break mechanic (permanent WP + Essence days without recovery)
- [x] Intimacy building/erosion via successful social attack (+/−1 or new Intimacy seed)
- [ ] Social Combos (no Obvious display unless charm is Obvious)

## Sorcery & Necromancy
- [x] Spell item type (Terrestrial/Celestial/Solar; Shadowland/Labyrinth/Void)
- [x] **Shaping-action pipeline** (multi-tick action container; damage-interrupts-with-Wits+Occult roll; Essence Burn botch)
- [ ] Countermagic resolution (Emerald/Sapphire/Adamant reflexive counter, Iron/Onyx/Obsidian necro)
- [ ] Countermagic cost variance by defended-circle-rank
- [ ] Spell casting chat card (motes committed during shape, released at cast; reverse button)
- [ ] Thaumaturgy (degrees and procedures — separate lower-power tier)
- [ ] Spell-specific duration/effect payloads (many spells create AE-like effects on targets)
- [ ] Ghost summoning (Black Treatise: extended opposed WP+Ess contest)
- [ ] Binding/fetter spells (Piercing the Heel, Soul Brand, Rune of Sweet Passing)
- [ ] Demon summoning (bind ritual on new moon/Calibration; bonus dice per demon)

## Martial Arts
- [ ] Style tracking (group charms into named styles; style weapons list)
- [ ] Form-type charm handling (one-at-a-time across ALL styles; scene duration; Combo-Basic)
- [ ] Style weapon tag validation (M = Melee-or-MA, MO = MA-only; form weapons count as unarmed for style purposes)
- [ ] Sidereal Martial Arts entry gate (requires ≥1 Celestial style mastered to Form + Sidereal sifu)
- [ ] Celestial-MA DB initiation charms (Pasiap's Humility+Daana'd etc.)
- [ ] Celestial-MA per-charm surcharge for Dragon-Blooded (+1m per activation)
- [ ] Celestial-MA 1.5× XP for non-resonant Exalts
- [ ] Solar Hero Style: ordinary Solar charms for Solars, Celestial MA for others

## Per-Splat Mechanics
- [x] **Splat subobject schema** (`system.splat.<type>.*` discriminated union per exaltType)

### Solar
- [x] Baseline Personal / Peripheral pool formulas
- [x] Caste abilities auto-flag on caste change
- [x] Anima banner auto-derived from scene peripheral spend (`system.scenePeripheral` → `system.anima` enum in `prepareDerivedData`; GM ± nudge + End Scene reset on Main tab)
- [ ] Eclipse anima oath-binding mechanic (10m + 1 WP; Essence # botches on breakers)
- [x] Eclipse non-Solar charm access (2× cost, +2m activation surcharge)
- [x] Limit Break indicator (Solar/Lunar/Terrestrial/Sidereal) — red label at Limit 10 on sheet
- [x] Limit Break chat card — Virtue Flaw name + description, Full/Partial choice, WP recovery, Limit reset
- [ ] Limit Break scripted scene effects (per-Virtue-Flaw mechanical consequences beyond WP gain)

### Lunar
- [x] Heart's Blood forms roster (human/animal/spirit types with stats + mutation points)
- [x] Shapeshifting actions (1m basic shift, DBT activation at 5m + Ess 2 prereq)
- [x] Deadly Beastman Transformation stat delta (+1 Str/Dex/Sta, (Ess+4) mutation points)
- [ ] Tell as a tracked trait (hidden or visible; mental-influence pool implications)
- [x] Knacks item type
- [x] Health-track wraps at 10 boxes per line
- [x] Attribute-keyed charms (Excellency system uses attribute for Lunars)
- [ ] Chimera Knacks gated by Casteless + Limit ≥ 5

### Dragon-Blooded
- [x] Aspects & breeding (Breeding 1-5 mote-pool bonus)
- [x] Out-of-aspect charm activation surcharge (+1m)
- [x] Water Aspect Terrestrial-MA no-surcharge exemption
- [ ] Anima flux damage at 11+ banner (environmental — scene effect)
- [ ] Charm cooperation (multi-DB pooled costs)
- [ ] Family / House background linkage

### Sidereal
- [ ] Arcane Fate trait (doubled background costs; social penalties)
- [ ] **Paradox** track (0-10; pattern bite at 10; −1 per 3 months; Wrapped Fly / Ritual of Expiation)
- [ ] Resplendent Destiny item type (Providence / Trigger / Scope / Duration / Frequency / Paradox / Endurance)
- [ ] Astrological Colleges trait (7 dots; ≥4 in own Maiden's 5)
- [ ] Greater Signs (Essence 4+, 10m; permanent Essence & Willpower cost)
- [ ] Sidereal Martial Arts gating (see Martial Arts section)

### Abyssal
- [x] Castes (mirror Solar with deathknight labels)
- [x] Resonance / Dark Fate track (0-10) — track = Limit track, labelled "Resonance"; eruption warning at 10
- [ ] Resonance vent roll (Essence dice; each success reduces Resonance by 1 and banks 1 point for Resonance effects; failure increases Resonance by 1 and triggers a Resonance effect at Permanent Essence level)
- [ ] Banked Resonance points storage and spending UI
- [ ] Resonance eruptions (Blight / Branding / Conduit / Stigmata effect scripts)
- [ ] ST-triggered eruption button (GM-only)
- [ ] Whispers trait (Conduit effect cap)
- [ ] Monstrance of Celestial Portion as an artifact/background
- [x] Moonshadow non-Abyssal charm access (16 XP, +2m activation)
- [x] Creature of Darkness flaw (GM-only removal, flag-based detection)

### Infernal
- [x] Castes (Slayer / Malefactor / Defiler / Scourge / Fiend)
- [ ] Yozi patron assignment (charm tree discriminator)
- [ ] Urge trait (Motivation-like Yozi-pleasing drive)
- [ ] Torment track (Limit-variant; Yozi-themed eruptions)
- [ ] Act of Villainy counter
- [ ] Heretical charms gating (GSP-only; 9 XP)
- [x] Fiend non-Infernal charm access (16 XP, +2m activation)
- [ ] Shintai / Mantle form-type charms (Yozi-specific transformation state)

### Alchemical
- [x] Castes (incl. Adamant)
- [x] **Charm Slots** (4 General + 4 Dedicated; install/uninstall flow; committed-motes cost per slot)
- [x] Submodules (slot-within-slot installations)
- [x] Clarity track (0-10; Virtue-suppression & contact-deprivation triggers)
- [ ] Gremlin Syndrome / Dissonance path
- [ ] Installed armor (subcutaneous / exoskeletal plating — different from equipped armor)
- [ ] Weaving protocols (Man-Machine / God-Machine as sorcery mirror)
- [ ] Adamant caste hidden-from-society rules

### Mortal
- [ ] Mortal-specific sheet variant (hide Essence/Mote/Charm sections)
- [ ] Terrestrial-only sorcery/MA restrictions
- [ ] No Excellencies enforcement

## Creatures / Traits
- [x] Creature of Darkness flaw (GM-only removal, no token HUD icon, flag-based detection)

## Penalty System
- [x] External / internal penalty aggregators on the actor
- [x] Prone (external −1, physical) via the built-in status
- [x] Aborted-Aim internal −2 (next-action tax)
- [x] Armor mobility penalty → internal physical
- [x] Wound penalty applied in `rollAttributeAbility` (previously attack-only)
- [ ] Starmetal target-imposed external attack penalty
- [ ] Fatigue penalty mechanic (armor fatigue scene-long exertion → Sta+Res rolls)

## Character Sheet
- [x] Effects tab — split into temporal (durationed / dvRefreshable) and permanent
- [x] Row-per-penalty-level health track with per-level bonus boxes (−0, −1, −2)
- [ ] Intimacies section (cap enforcement + ablation UI once Intimacy trait is scored)
- [x] MDV derived display (Combat tab)
- [x] Anima banner auto-calculated display (tier shown on Main tab; caste anima power widget with Activate / Deactivate / View buttons)
- [ ] Per-splat tab(s) surfacing splat-specific mechanics (Sidereal Paradox, Abyssal Resonance, Infernal Torment/Urge, etc.)
- [ ] Virtue Channel counter (per-story, not per-scene)

## Virtues & Willpower
- [x] Permanent + temporal virtue tracks
- [x] Willpower minimum = sum of two highest Virtues
- [ ] Virtue channel action (spend 1 WP + Virtue, add Virtue dice, consumes per-story channel slot)
- [ ] Willpower recovery hooks (rest, channel success, stunt)
- [ ] Limit accumulation automation (Virtue Flaw triggers)
- [ ] Limit Break scripting at 10 (per-Virtue-Flaw scene template)

## Experience / Purchase Tracking
- [x] Purchase Mode toggle + enforcement (block reductions, log XP on increases)
- [x] Purchase log UI on Experience tab
- [x] XP Cost Engine
- [x] XP cost tables per exalt type (Terrestrial out-of-aspect surcharges, etc.)
- [ ] Purchase Mode support for NPC-typed actors
- [ ] Per-trait lock overrides
- [ ] Background-method setting (Method 1: 3 XP/dot; Method 2: free w/ ST permission)

## Stunts & Drama
- [x] Stunt dice in roll dialog
- [x] Auto mote/WP reward on successful stunted action (at DV refresh)
- [ ] Stunt-on-perfect (errata: bonus dice apply even when success guaranteed)
- [ ] Motivation-advance WP reward

## The Circle / Party Management
- [x] The Circle folder seeder + auto-configure actors (linked token, Friendly disposition)
  - [ ] Special buttons on the folder (party roll, XP award, rest-and-recover, etc.)
  - [ ] Macro to manually re-create the folder if deleted
  - [ ] Restoring defaults when an actor leaves The Circle
  - [ ] NPC → character auto-conversion on move-in

## Compendium
- [x] Effects compendium (`exalted2e.effects`) seeded at ready with Creature of Darkness
- [x] Effect-wrapper pattern for drag-to-actor drops
- [x] Anima powers compendium (`exalted2e.animapowers`) seeded at ready; 34 entries covering all castes across all exalt types
- [ ] Pre-built charms compendium (at least Solar Ability charms)
- [ ] Pre-built weapons / armor compendia (with magical material variants)
- [ ] Pre-built spells compendium (Terrestrial through Solar circles + Shadowlands/Labyrinth/Void)
- [ ] Pre-built artifact compendium (daiklaves, armors, hearthstones)
- [ ] Status effects compendium (Knockdown, Stun, Clinched, Poisoned, Diseased, Prone-per-leg, Crippled)

## Other Mechanics
- [x] Anima powers per exalt type and caste (embedded `animapower` item on actor; 34-entry compendium; swapped on caste/exaltType change; manual activate/deactivate with mote + WP cost)
- [x] Auto-activate caste anima power at ≥11m peripheral scene spend (bonfire threshold)
- [ ] Anima flux (Terrestrial environmental damage, Abyssal Resonance effects)
- [ ] Resonance track and eruptions (Abyssal) — see Abyssal splat
- [ ] Torment / Act of Villainy tracking (Infernal) — see Infernal splat
- [ ] Clarity mechanical effects (Alchemical) — see Alchemical splat
- [ ] Paradox track (Sidereal) — see Sidereal splat
- [ ] Poison / Disease tracking (item types + per-interval AE)
- [ ] Crippling injuries (4+ HL single hit; surgery Int+Medicine to heal)
- [ ] Environmental hazards (Damage/interval, Trauma; fire/cold/drowning/starvation/thirst)
- [ ] Mass combat (unit actor type: Magnitude, Drill, Might, Endurance, Morale, formations, commander + relays + heroes)
- [ ] Artifact creation rules (extended Craft roll; Craft+Lore+Occult; seasons interval)
- [ ] **Manse** item type (rating, aspect, powers, mote-regen grant)
- [ ] **Hearthstone** item type (rating, aspect, socketable into artifacts)
- [ ] **Artifact** item type (general; non-weapon/armor artifacts)
- [ ] **Mutation** item type (Pox/Affliction/Blight/Abomination; Wyld origin)
- [ ] **Poison** item type
- [ ] **Disease** item type
- [ ] **Drug** item type
- [ ] **Vehicle / Warstrider** actor type (First Age magitech)
- [ ] **Unit** actor type for mass combat
- [ ] Background mechanical hooks (Backing, Contacts, Resources, Manse → mote regen, Familiar → embedded actor ref)
- [ ] Willpower recovery on virtue channel success
- [ ] Scene-end reset (anima banner, Peripheral-spend counter, per-scene WP drain counters, stunt history)

## Crafting
- [x] Craft specializations (Fire, Water, Air, Earth, Wood, Magitech, etc.)
- [ ] Mundane crafting roll resolver (Int/Per+Craft vs Resources diff; extended for large items)
- [ ] Artifact extended-roll builder (Rating cumulative successes; seasons interval; exotic ingredient tracker)
- [ ] Workshop & material prerequisites UI
- [ ] Manse geomancy rules (Oadenol's Codex) — manse power table, demesne pre-roll

## Quality of Life
- [ ] Drag-and-drop items between sheets (partial: effect-wrapper compendium works)
- [x] Automated charm prerequisite validation
- [ ] GM "Roll a Pool" dialog — ad-hoc dice roller that picks up the standard penalty machinery
- [ ] Keyword-effect registry for systematic status application
- [ ] Effect-flag registry file documenting every `flags.exalted2e.*` semantic role
- [ ] Migration pipeline for schema changes as system evolves
- [ ] Language-drift linter (en.json ↔ es.json key parity)
- [ ] Multi-actor action helpers (Coordinate, Cooperative charms, mass Guard)
- [ ] Personal/Peripheral commitment split (players choose the pool split for attuned artifacts)

## Testing
- [x] Vitest suite (pure-logic helpers, math modules, prepareDerivedData)
- [x] Quench integration tests (in-Foundry: attack pipeline, social combat, stunt rewards, purchase/attunement)
- [ ] Headless tests for remaining paths: charm prerequisite edge cases, multi-tick state machine, sorcery interruption

## Documentation (internal)
- [x] docs/sysref-index.md — catalog of every PDF + topic lookup
- [x] docs/mechanics-reference.md — distilled rules by system
- [x] docs/gap-analysis.md — architectural notes (partially stale; see git log for resolved gaps)
- [x] docs/Experience.md — XP cost tables per exalt type
- [ ] docs/charm-authoring.md — guide for authoring charms that plug into the activation pipeline
- [ ] docs/npc-stat-blocks.md — templates for common antagonists

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
