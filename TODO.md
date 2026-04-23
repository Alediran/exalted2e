# TODO — Exalted 2nd Edition Foundry VTT System

Pending features based on Exalted 2nd Edition core rules.

## Combat System
- [x] Attack resolution (pool vs DV, damage roll, threshold)
- [x] Multi-step attack resolution (Steps 1 / 2 / 4 / 5 / 8 / 9 on the attack card)
- [x] Canvas target picker when no token is pre-targeted
- [x] Range check (melee ≤ 1 square, Reach ≤ 2; ranged ≤ `effectiveRange`)
- [x] Flurries
  - [x] Declaration dialog (action rows, per-mode rate caps, draw-then-attack)
  - [x] Dice penalty applied in `rollAttack`
  - [x] DV penalty stamped as AE on the actor
  - [x] Finish Turn advances by the flurry's max Speed
- [x] Combos (charm combo creation, activation)
  - [ ] Combo-building rules (size limits, keyword restrictions, pre-errata constraints)
  - [ ] Shared / compendium-sourced Combos (drag-in from packs)
  - [ ] Drag-reorder within the Combo sheet (v1 uses arrow buttons)
  - [ ] Consolidated single chat card + combined Reverse (fallback if chat gets too noisy)
  - [ ] NPC Combos
- [ ] Knockback / Knockdown effects
- [ ] Clinch / Grapple (control tracking, opposed rolls)
- [x] Tick system (Speed-based initiative)
  - [x] `ExaltedCombat` sorts ascending; same-tick tiebreaker Dex → Wits → name → id
  - [x] Join Battle (all / NPCs-only) + canonical `tick = maxSuccesses − mySuccesses`
  - [x] Finish Turn control; per-combatant initiative button swapped to d10
  - [x] Auto-advance on Roll Damage (charge the attacker Speed ticks automatically)
  - [x] Actions quickbar (Move 5, Guard 3, Aim 5, Rise 5, Draw 5, Inactive 5)
- [x] DV refresh tracking — AE-driven, cleared when the combatant's turn starts
- [x] Onslaught penalty (−1 DV per attack received; reuse the DV-penalty AE plumbing)
- [ ] Coordinated attacks
- [ ] Mounted combat

## Charm Keywords
- [x] Unblockable / Undodgeable (target DVs → 0, buttons stay live for Perfect counters)
- [x] Perfect Dodge / Perfect Parry (attack short-circuits; bypasses Unblockable/Undodgeable)
- [x] Holy (upgrades bashing/lethal → aggravated vs Creature of Darkness)
- [x] Counterattack (already wired via Step 9)

## Charms
- [x] Attack tab on charm sheet (Instant rolls directly; longer durations spawn a weapon + tracking AE)
- [x] Formula builder dialog with actor-scoped live preview
- [x] Supplemental/Reflexive-step-1 charm picker in attack dialog
- [x] Charm activation ledger + Reverse button on the chat card
- [x] Typed charm costs: motes, willpower, bashing HL, lethal HL, aggravated HL, XP
- [x] XP cost confirmation dialog
- [x] Automated charm prerequisite validation

## Creatures / Traits
- [x] Creature of Darkness flaw (GM-only removal, no token HUD icon, flag-based detection)

## Sorcery & Necromancy
- [x] Spell item type (Terrestrial/Celestial/Solar circles; Shadowland/Labyrinth/Void for necromancy)
- [ ] Countermagic resolution
- [ ] Thaumaturgy (degrees and procedures)

## Social Combat
- [ ] Social attack rolls (Cha/Man + Presence/Performance/Investigation/Bureaucracy)
- [ ] Mental DVs (Dodge MDV, Parry MDV)
- [ ] Intimacy mechanical integration into social defense/attack
- [ ] Unnatural mental influence tracking and willpower resist

## Martial Arts
- [ ] Style tracking (group charms into named styles)
- [ ] Form-type charm handling
- [ ] Style weapon associations

## Lunar-Specific
- [ ] Shapeshifting (heart's blood library, Deadly Beastman Transformation, form stat mods)
- [ ] Tell tracking
- [x] Knacks item type
- [x] Health-track wraps at 10 boxes per line (everyone else wraps at 5)

## Craft System
- [x] Craft specializations (Fire, Water, Air, Earth, Wood, Magitech, etc.)

## Character Sheet
- [x] Effects tab — split into temporal (durationed / dvRefreshable) and permanent
- [x] Row-per-penalty-level health track with per-level bonus boxes (−0, −1, −2)

## The Circle / Party Management
- [x] The Circle folder seeder + auto-configure actors (linked token, Friendly disposition)
  - [ ] Special buttons on the folder (party roll, XP award, rest-and-recover, etc.)
  - [ ] Macro to manually re-create the folder if deleted
  - [ ] Restoring defaults when an actor leaves The Circle
  - [ ] NPC → character auto-conversion on move-in

## Compendium
- [x] Effects compendium (`exalted2e.effects`) seeded at ready with Creature of Darkness
- [x] Effect-wrapper pattern for drag-to-actor drops
- [ ] Pre-built charms compendium
- [ ] Pre-built weapons / armor compendia

## Penalty System (partial)
- [x] External / internal penalty aggregators on the actor
- [x] Prone (external −1, physical) via the built-in status
- [x] Aborted-Aim internal −2 (next-action tax)
- [x] Armor mobility penalty → internal physical
- [x] Wound penalty applied in `rollAttributeAbility` (previously attack-only)
- [ ] Starmetal armor: target-imposed external attack penalty (attacker's pool reduced when attacking the wearer). Needs a target-side penalty resolver in `rollAttack`.
- [ ] Fatigue penalty mechanic (armor fatigue triggering Stamina+Resistance rolls over scene-length exertion)

## Other Mechanics
- [ ] Anima powers per exalt type and caste
- [ ] Anima flux (Terrestrial environmental damage, Abyssal Resonance effects)
- [ ] Resonance track and eruptions (Abyssal)
- [ ] Torment / Act of Villainy tracking (Infernal)
- [ ] Clarity mechanical effects (Alchemical)
- [ ] Stunt mote/WP auto-recovery (2-die stunt: +2m, 3-die stunt: +2m +1wp)
- [ ] Poison / Disease tracking
- [ ] Crippling injuries
- [ ] Environmental hazards (Damage/interval, Trauma)
- [ ] Mass combat (unit stats, Magnitude, Drill, Might)
- [ ] Artifact creation rules
- [ ] Manse / Hearthstone item type
- [ ] Background mechanical hooks (Backing, Contacts, Resources)
- [ ] XP cost tables per exalt type (Terrestrial out-of-aspect surcharges, etc.)

## Quality of Life
- [ ] Drag-and-drop items between sheets (partial: effect-wrapper compendium works)
- [x] Automated charm prerequisite validation
- [ ] GM "Roll a Pool" dialog — ad-hoc dice roller that picks up the standard penalty machinery (internal / external / wound) so bespoke GM rolls match player rolls
