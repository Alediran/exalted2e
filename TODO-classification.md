# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-05-21 (Area attacks, Coordinated attacks, FoI surcharge, Style weapon tag validation, Sidereal/DB MA gates, Martial-ready gating, Countermagic resolution done, Mundane crafting roll resolver done, Manse item type done, Background hooks partial: Familiar actor ref + Cult mote regen + 53-type registry with optgroup display)

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
| Combo-building rules (size limits, keyword restrictions) | Combat | charm filter at combo-add time; pre-errata size caps |
| Shields as weapons | Defense | new weapon tag handling, DV bonus, mobility penalty |
| Fatigue penalty mechanic | Defense / Penalty | hook on scene-length exertion + Sta+Res roll |
| Overdrive pool | Keywords | temp Peripheral pool tracking + scene-end dissipation — [charms-gap A1](docs/charms-gap.md) |
| Blasphemy / Axiomatic / Dawn damage upgrades | Keywords | mirror of Holy, splat-specific target condition |
| Training keyword XP debt ledger | Keywords | per-actor debt AE or item field — [charms-gap A8](docs/charms-gap.md) |
| Merged keyword (learn-once, multi-ability) | Keywords | charm activation routing extension |
| Countermagic cost variance by circle | Sorcery | tier-based mote slider already exists; extend CountermagicDialog to enforce circle-rank minimums |
| Spell-specific duration/effect payloads | Sorcery | per-spell AE-like target effects; requires per-spell schema extension |
| Ghost summoning | Sorcery | extended opposed WP+Ess contest (Black Treatise) |
| Binding/fetter spells | Sorcery | Piercing the Heel, Soul Brand, Rune of Sweet Passing AE payloads |
| Demon summoning | Sorcery | bind ritual on new moon/Calibration; bonus dice per demon type |
| Celestial-MA 1.5× XP | Martial Arts | same tier check in XP cost engine for non-resonant exalts |
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
| Manse geomancy rules | Crafting | Oadenol's Codex power table, demesne pre-roll (unblocked by Manse item type) |
| Background mechanical hooks | Other | Familiar actor link + Cult mote-regen/WP-recovery + 53-type optgroup registry done; Backing/Contacts/Resources mechanical automation still pending |
| Workshop & material prerequisites UI | Crafting | prerequisites check UI for crafting projects |
| Artifact extended-roll builder | Crafting | Rating cumulative successes; seasons interval; exotic ingredient tracker |
| Drag-and-drop items between sheets | QoL | improve drop handler across item types |
| Multi-actor action helpers | QoL | coordinate/cooperative charm dialog |
| Personal/Peripheral commitment split | QoL | artifact attunement choice UI |
| Poison/Disease tracking | Other | per-interval AE *(needs Poison/Disease item types — Group A — first)* |
| Pre-built weapons/armor compendia | Compendium | data authoring, magical material variants |
| Pre-built spells compendium | Compendium | data authoring (3 circles × 2 traditions) |
| Pre-built artifact compendium (daiklaves/armors) | Compendium | data authoring + attunement variants |
| Headless tests for remaining paths | Testing | test authoring for charm prereqs, multi-tick, sorcery |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Why complex |
|------|-------------|-------------|
| Clinch / Grapple | Combat | new turn-loop: control pool, opposed rolls, sub-actions (throw/crush/hold), per-tick renewal |
| Mounted combat | Combat | Ride-controlled mount stats, charge bonuses, Ride charm integration |
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
| Unit actor type | Other | Mass combat design (Group C) |

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 1 |
| B — Ready, Medium | 35 |
| C — Ready, Complex | 11 |
| D — Blocked | 1 |
| **Total pending** | **48** |

**Biggest force-multipliers:**
- **Social charm bonus payload** (Group C) → prerequisite for Mass Combat morale/demoralize pipeline
- **Charm deactivation resolver** (Group C) → prerequisite for Mass Combat battle-duration effects
- **Environmental hazards** (Group B) → prerequisite for Mass Combat terrain modifiers
