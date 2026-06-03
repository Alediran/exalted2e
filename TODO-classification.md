# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-02 (Clarity Compassion effects + Gremlin Syndrome/Dissonance closed; count 1 A / 9 B / 1 C / 11 total)

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
| Limit Break scripted scene effects | Solar / Virtues | per-Virtue-Flaw AE templates (4 flaws × 2 break types) |
| Shintai / Mantle form-type charms | Infernal | charm activation mode + transformation state AE |
| Resplendent Destiny payloads | Sidereal | extend item type: Ascendant/Descending mechanical effects |
| Manse geomancy rules | Crafting | Oadenol's Codex power table, demesne pre-roll (unblocked by Manse item type) |
| Background mechanical hooks | Other | Familiar actor link + Cult mote-regen/WP-recovery + 53-type optgroup registry done; Backing/Contacts/Resources mechanical automation still pending |
| Workshop & material prerequisites UI | Crafting | ability prereqs (Craft/Lore/Occult) now enforce + charm reduction done; workshop/tool/material requirements UI still pending |
| Multi-actor action helpers | QoL | Cooperative keyword done; Coordinate attacks + mass Guard still pending |
| Poison/Disease tracking | Other | per-interval AE *(needs Poison/Disease item types — Group A — first)* |
| Headless tests for remaining paths | Testing | test authoring for charm prereqs, multi-tick, sorcery |

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
| B — Ready, Medium | 9 |
| C — Ready, Complex | 1 |
| **Total pending** | **11** |
