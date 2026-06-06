# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-06 (Coverage-raising initiative opened; SP1 quick-0%-wins done — hazard-math extract + region-behavior/_edit-image tests. count 1 A / 1 B / 1 C / 3 active)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Monstrance of Celestial Portion | Abyssal | fields done; control/servitude mechanics (deathlord authority over deathknight) still pending |

---
  
## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Coverage-raising initiative (SP2–SP5 + gate) | Testing | SP1 done. Next worst-first: SP2 `module/dialogs` (~3260 uncovered). Each sub-project = spec→plan→subagent-driven cycle; extract-pure + Quench-smoke pattern established in SP1. Regression-floor CI gate after baseline. |

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
| B — Ready, Medium | 1 |
| C — Ready, Complex | 1 |
| **Total active** | **3** |
| (Parked) | 1 |
