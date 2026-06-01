# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-05-31 (mounted combat + vehicle/warstrider done; count 1 A / 24 B / 1 C / 26 total)

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
| Blasphemy / Axiomatic / Dawn damage upgrades | Keywords | mirror of Holy, splat-specific target condition |
| Training keyword XP debt ledger | Keywords | per-actor debt AE or item field — [charms-gap A8](docs/charms-gap.md) |
| Merged keyword (learn-once, multi-ability) | Keywords | charm activation routing extension |
| Spell-specific duration/effect payloads | Sorcery | per-spell AE-like target effects; requires per-spell schema extension |
| Ghost summoning | Sorcery | extended opposed WP+Ess contest (Black Treatise) |
| Binding/fetter spells | Sorcery | Piercing the Heel, Soul Brand, Rune of Sweet Passing AE payloads |
| Demon summoning | Sorcery | bind ritual on new moon/Calibration; bonus dice per demon type |
| Limit Break scripted scene effects | Solar / Virtues | per-Virtue-Flaw AE templates (4 flaws × 2 break types) |
| Shintai / Mantle form-type charms | Infernal | charm activation mode + transformation state AE |
| Gremlin Syndrome / Dissonance | Alchemical | Clarity track → Dissonance consequences |
| Resplendent Destiny payloads | Sidereal | extend item type: Ascendant/Descending mechanical effects |
| Per-trait lock overrides | XP | per-field lock flag, purchase mode guard |
| Circle special buttons (party roll, XP award, rest) | Circle | macro-buttons on folder widget |
| NPC → character auto-conversion on move-in | Circle | hook + actor-type change |
| Clarity mechanical effects | Alchemical | Clarity track consequences (Virtue suppression thresholds) |
| Manse geomancy rules | Crafting | Oadenol's Codex power table, demesne pre-roll (unblocked by Manse item type) |
| Background mechanical hooks | Other | Familiar actor link + Cult mote-regen/WP-recovery + 53-type optgroup registry done; Backing/Contacts/Resources mechanical automation still pending |
| Workshop & material prerequisites UI | Crafting | ability prereqs (Craft/Lore/Occult) now enforce + charm reduction done; workshop/tool/material requirements UI still pending |
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
| Migration pipeline | QoL | schema versioning, upgrade scripts, DataModel migration hooks |

---

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 1 |
| B — Ready, Medium | 24 |
| C — Ready, Complex | 1 |
| **Total pending** | **26** |
