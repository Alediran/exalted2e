# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-06 (Coverage initiative SP3 DONE — Phase A 8 item-sheet helpers (+34 Vitest, suite 1352) + Phase B item-sheets Quench batch (per-subtype render + 3 action smokes). SP4 actor-sheets next. count 1 A / 1 B / 1 C / 3 active)

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
| Coverage-raising initiative (SP4–SP5 + SP2b + gate) | Testing | SP1, SP2, SP3 done. Next worst-first: SP4 `module/sheets/actor`. Each sub-project = spec→plan→subagent-driven cycle; extract-pure + Quench-smoke pattern. SP2b (dialog-shell smokes) + regression-floor CI gate still pending. |

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
