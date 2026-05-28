# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-05-27 (Ravening Mouth done via moteRecovery onDamageDealt event; count 1 A / 34 B / 6 C / 41 total)

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
| Manse geomancy rules | Crafting | Oadenol's Codex power table, demesne pre-roll (unblocked by Manse item type) |
| Background mechanical hooks | Other | Familiar actor link + Cult mote-regen/WP-recovery + 53-type optgroup registry done; Backing/Contacts/Resources mechanical automation still pending |
| Workshop & material prerequisites UI | Crafting | prerequisites check UI for crafting projects |
| Artifact extended-roll builder | Crafting | Rating cumulative successes; seasons interval; exotic ingredient tracker |
| Drag-and-drop items between sheets | QoL | improve drop handler across item types |
| Multi-actor action helpers | QoL | Cooperative keyword done; Coordinate attacks + mass Guard still pending |
| Personal/Peripheral commitment split | QoL | artifact attunement choice UI |
| Poison/Disease tracking | Other | per-interval AE *(needs Poison/Disease item types — Group A — first)* |
| Headless tests for remaining paths | Testing | test authoring for charm prereqs, multi-tick, sorcery |
| Essence Flow innate-powers mechanic | Charms | gate: does actor own `(Ability) Essence Flow` charm? If yes, skip Combo requirement for that ability's three Excellencies at activation time; dice-pool cap still applies |
| Touch keyword mechanics | Charm Keywords | non-consenting target needs Dex+MA attack roll before touch-range charm resolves; extend attack dialog or add pre-activation roll step |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Why complex |
|------|-------------|-------------|
| Clinch / Grapple | Combat | new turn-loop: control pool, opposed rolls, sub-actions (throw/crush/hold), per-tick renewal |
| Mounted combat | Combat | Ride-controlled mount stats, charge bonuses, Ride charm integration |
| Thaumaturgy | Sorcery | separate lower-power tier: procedures, degrees, own roll resolver |
| Artifact creation rules | Crafting | extended Craft roll + Craft+Lore+Occult, seasons interval, exotic ingredient tracker |
| Vehicle / Warstrider actor type | Other | new actor type with unique soak/movement/weapon-mount mechanics |
| Migration pipeline | QoL | schema versioning, upgrade scripts, DataModel migration hooks |

---

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 1 |
| B — Ready, Medium | 34 |
| C — Ready, Complex | 6 |
| **Total pending** | **41** |
