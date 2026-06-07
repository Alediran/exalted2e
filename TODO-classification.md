# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-06 (Coverage-raising initiative COMPLETE — SP1–SP5 + SP2b + regression-floor CI gate all done; Vitest suite 1394, 5 Quench render batches. count 1 A / 0 B / 1 C / 2 active)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Monstrance of Celestial Portion | Abyssal | fields done; control/servitude mechanics (deathlord authority over deathknight) still pending |

---
  
## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

*(none — Coverage-raising initiative completed: SP1–SP5 + SP2b + regression-floor CI gate all done)*

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
| B — Ready, Medium | 0 |
| C — Ready, Complex | 1 |
| **Total active** | **2** |
| (Parked) | 1 |
