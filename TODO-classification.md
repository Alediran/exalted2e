# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-04 (Manse geomancy Phase 2b — full 65-power Oadenol's catalog — shipped; only Phase 3 design/geomancy rolls remain as the Group B manse entry. count 1 A / 6 B / 1 C / 8 active)

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
| Manse geomancy rules — Phase 3 | Crafting | Phase 1 (CP economy) + Phase 2a (manse-power item type + picker) + Phase 2b (full 65-power Oadenol's catalog in src/packs/manse-powers/) shipped. Phase 3 = design/geomancy rolls (capping, per-power design roll + prereqs, partial capping / Essence Vents, Power Failure). Source: docs/manse-design.md |
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

## Parked (no actionable work)
| Item | TODO Section | Note |
|------|-------------|------|
| Background mechanical hooks | Other | Mechanized types (Familiar/Cult/Command/Followers) done. Backing/Contacts/Resources kept narrative-only by user decision (2026-06-04). Re-open if specific automations are identified. |

---

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 1 |
| B — Ready, Medium | 6 |
| C — Ready, Complex | 1 |
| **Total active** | **8** |
| (Parked) | 1 |
