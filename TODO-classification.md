# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-05-18 (A7 Fury-OK filter done)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Monstrance of Celestial Portion | Abyssal | fields done; control/servitude mechanics (deathlord authority over deathknight) still pending |

---

## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

| Item | TODO Section | Key concern |
|------|-------------|-------------|
| Range bands with tiered penalties | Combat | config table + range-check rewrite + attack penalty lookup |
| Combo-building rules (size limits, keyword restrictions) | Combat | charm filter at combo-add time; pre-errata size caps |
| Area attacks | Combat | new attack schema flag + resolution path without accuracy roll |
| Coordinated attacks | Combat | leader Cha+War roll + DV reduction AE on target |
| Shields as weapons | Defense | new weapon tag handling, DV bonus, mobility penalty |
| Fatigue penalty mechanic | Defense / Penalty | hook on scene-length exertion + Sta+Res roll |
| Compulsion / Emotion AE | Keywords | keyword → scene-long AE, AE template system |
| Illusion disbelieve mechanic | Keywords | Per+Investigation check against charm activation |
| Servitude AE | Keywords | loyalty-binding AE, removal conditions |
| Overdrive pool | Keywords | temp Peripheral pool tracking + scene-end dissipation — [charms-gap A1](docs/charms-gap.md) |
| Blasphemy / Axiomatic / Dawn damage upgrades | Keywords | mirror of Holy, splat-specific target condition |
| Training keyword XP debt ledger | Keywords | per-actor debt AE or item field — [charms-gap A8](docs/charms-gap.md) |
| Merged keyword (learn-once, multi-ability) | Keywords | charm activation routing extension |
| Countermagic resolution | Sorcery | reflexive roll + mote cost, 3-circle tiering |
| Spell-specific duration/effect payloads | Sorcery | per-spell AE-like target effects; requires per-spell schema extension |
| Ghost summoning | Sorcery | extended opposed WP+Ess contest (Black Treatise) |
| Binding/fetter spells | Sorcery | Piercing the Heel, Soul Brand, Rune of Sweet Passing AE payloads |
| Demon summoning | Sorcery | bind ritual on new moon/Calibration; bonus dice per demon type |
| Flaw-of-Invulnerability +2 WP combo surcharge | Combat | detect Form-type in active combo + surcharge at activation |
| Style weapon tag validation | Martial Arts | define per-style weapons config (M/MO tags), then enforce at attack time |
| Sidereal MA entry gate | Martial Arts | check actor owns a Form-type charm from ≥1 Celestial style |
| Sidereal MA gating (splat section) | Sidereal | same as above; cross-reference in splat section |
| Celestial-MA DB initiation charms | Martial Arts | specific charm data + actor gating for DB access to Celestial styles |
| Celestial-MA per-charm surcharge | Martial Arts | `martialArtsTier === "celestial"` check in aspect-surcharge.mjs for DB actors |
| Celestial-MA 1.5× XP | Martial Arts | same tier check in XP cost engine for non-resonant exalts |
| Martial/Martial-ready keyword gating | Keywords | weapon tag check at charm-learn time using per-style weapons config |
| Limit Break scripted scene effects | Solar / Virtues | per-Virtue-Flaw AE templates (4 flaws × 2 break types) |
| Shintai / Mantle form-type charms | Infernal | charm activation mode + transformation state AE |
| Gremlin Syndrome / Dissonance | Alchemical | Clarity track → Dissonance consequences |
| Resplendent Destiny payloads | Sidereal | extend item type: Ascendant/Descending mechanical effects |
| Per-splat tabs on character sheet | Sheet | new tab per splat with existing track widgets |
| Per-trait lock overrides | XP | per-field lock flag, purchase mode guard |
| Circle special buttons (party roll, XP award, rest) | Circle | macro-buttons on folder widget |
| NPC → character auto-conversion on move-in | Circle | hook + actor-type change |
| Clarity mechanical effects | Alchemical | Clarity track consequences (Virtue suppression thresholds) |
| Crippling injuries | Other | health track extension + extended surgery roll |
| Environmental hazards | Other | Damage/interval + Trauma AE, configurable hazard schema |
| Manse item type | Other | TypeDataModel + mote-regen integration with hearthstone regen |
| Background mechanical hooks | Other | AE per background dot (Manse regen, Familiar ref, etc.) |
| Mundane crafting roll resolver | Crafting | extended roll vs Resources difficulty |
| Drag-and-drop items between sheets | QoL | improve drop handler across item types |
| Multi-actor action helpers | QoL | coordinate/cooperative charm dialog |
| Personal/Peripheral commitment split | QoL | artifact attunement choice UI |
| Poison/Disease tracking | Other | per-interval AE *(needs Poison/Disease item types — Group A — first)* |
| Pre-built weapons/armor compendia | Compendium | data authoring, magical material variants |
| Pre-built spells compendium | Compendium | data authoring (3 circles × 2 traditions) |
| Pre-built artifact compendium (daiklaves/armors) | Compendium | data authoring + attunement variants |
| Headless tests for remaining paths | Testing | test authoring for charm prereqs, multi-tick, sorcery |
| Social Combos | Social | adapts combo infrastructure for social charms *(soft dep: base combo items still open)* |
| Gift keyword auto-activation | Lunar | DBT entry hook + activate all owned Gift charms — [charms-gap A6](docs/charms-gap.md) |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Why complex |
|------|-------------|-------------|
| Clinch / Grapple | Combat | new turn-loop: control pool, opposed rolls, sub-actions (throw/crush/hold), per-tick renewal |
| Mounted combat | Combat | Ride-controlled mount stats, charge bonuses, Ride charm integration |
| Keyword-as-status-effect registry | Keywords | systematic mapping engine: all Compulsion/Emotion/Illusion/Servitude charms → AEs |
| Essence-tiered upgrade branches | Charms | `essenceUpgrades[]` schema + branch-selection step in activation dialog — [charms-gap A2](docs/charms-gap.md) |
| Social charm bonus payload | Social | `socialBonus` sub-schema (pool/MDV modifier) + social-roll pipeline integration — [charms-gap A9](docs/charms-gap.md) |
| Charm deactivation resolver | Charms | state machine: scene-end / combat-end / out-of-motes, handles all duration types |
| Thaumaturgy | Sorcery | separate lower-power tier: procedures, degrees, own roll resolver |
| Artifact creation rules | Crafting | extended Craft roll + Craft+Lore+Occult, seasons interval, exotic ingredient tracker |
| Pre-built charms compendium | Compendium | hundreds of Solar charms minimum; large data-authoring effort |
| Mass combat | Other | new sub-system: unit actor type, Magnitude/Drill/Might/Morale, formations, commander relay |
| Vehicle / Warstrider actor type | Other | new actor type with unique soak/movement/weapon-mount mechanics |
| Migration pipeline | QoL | schema versioning, upgrade scripts, DataModel migration hooks |

---

## Group D — Blocked
*Cannot start without completing another open item in this list.*

| Item | TODO Section | Blocked by |
|------|-------------|-----------|
| Countermagic cost variance by circle | Sorcery | Countermagic resolution (Group B) |
| Manse geomancy rules | Crafting | Manse item type (Group B) |
| Workshop & material prerequisites UI | Crafting | Mundane crafting roll resolver (Group B) |
| Artifact extended-roll builder | Crafting | Mundane crafting roll resolver (Group B) |
| Unit actor type | Other | Mass combat design (Group C) |

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 1 |
| B — Ready, Medium | 49 |
| C — Ready, Complex | 12 |
| D — Blocked | 5 |
| **Total pending** | **67** |

**Biggest force-multipliers:**
- **Countermagic resolution** (Group B) → unblocks Countermagic cost variance
- **Manse item type** (Group B) → unblocks Manse geomancy rules
- **Mundane crafting roll resolver** (Group B) → unblocks Workshop UI + Artifact extended-roll builder
