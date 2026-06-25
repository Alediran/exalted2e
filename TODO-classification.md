# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-25 (Charm mechanics backlog extracted from charm-manual-discoveries; new attack-pipeline fields A1–A4 complete; A5–A14 + planned systems added to TODO)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Target-number reduction (`targetNumberReduction`) | Combat System | New `NumberField` on CharmData; `ExaltedRoll` already accepts a `targetNumber` option — wire schema → pack data → UI control; same 4-file pattern as A1–A4 |
| Onslaught multiplier (`onslaughtMultiplier`) | Combat System | New `NumberField`; multiply stacks in the onslaught-stamp step of `rollAttack`; straightforward addendum to existing onslaught logic |
| Fix Unbreakable Warrior's Mastery | Charms | Remove wrong `statusApply`; add `negatesCripplingEffect: true` — one JSON fix + confirm consumer already reads that field |
| Formal virtue roll pipeline | Virtues & Willpower | New `virtueRollTrigger` SchemaField; re-use existing virtue-channel roll dialog as a base; 3–4 files |

---

## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Soak reduction on hit (`soakReductionOnHit`) | Combat System | Schema + post-hit AE stamped on target reducing soak aggregation; needs AE field → soak-aggregation read path; ~5 files |
| Damage-driven penalty (`damageDrivenPenalty`) | Combat System | Post-damage hook reads HL dealt → stamps penalty AE on target; design scope: which attribute groups, how duration tracked; ~5 files |
| Temporary health levels (`temporaryHealthLevels`) | Combat System | Transient AE adding HL at specified level; health-track must re-compute with AE-sourced HL; ~4 files + CSS |
| Fix Serpentine Evasion consumer | Charms | `dvBonus` formula/condition wrong; read errata, patch `dvBonus` fields + confirm aggregator handles it |
| Fix Shockwave Technique consumer | Charms | Multiple fields misconfigured; audit `moteRecovery`, `statusApply`, `dvBonus`, `willpowerRecovery` against errata; patch JSON and verify each consumer |
| Per-purchase variant selection | Charms | Dialog at learn-time picking variant; store on item instance; `maxPurchases` formula support (`@essence`); ~4 files |
| Upgrade tier system | Charms | `upgradeRequiresEssence` field; gate higher-tier effect fields behind Essence check in sheet + activation; ~4 files |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Mote loan + willpower gift | Combat System | Ally-targeting flow (see below) must land first; then `moteLoan`/`willpowerGift` schema fields + `receiveMotes`/`receiveWillpower` actor methods + chat card |
| Ally-targeting support | Combat System | Charm activation dialog gains "pick ally token" step; prerequisite for moteLoan, willpowerGift, Background-grant Lunar charms |
| Formal social attack pipeline for social-keyword charms | Social Combat | MDV-halving + Willpower-cost flags for social attacks paralleling Unblockable/Undodgeable; design-heavy |
| Homing attack | Combat System | "Pending re-attack" state on combatant; auto-re-roll on following tick; Lunar-specific |
| Ammo tracking + `bypassAmmoConsumption` | Combat System | Quiver/clip resource; decrement on attack; charm bypass flag; blocks archery-charm variants |
| Elsewhere system | Combat System | "Elsewhere inventory" on CharacterData; charm-activated store/recall; paired AE; Archery-specific |
| Dematerialized targeting gate | Lunar | `dematerialized` status AE on spirit actors; `harmImmaterial` gate in `rollAttack`; pairs with Spirit/Lunar charms |
| Maladic capture + transfer | Lunar | New item/AE type; transfer dialog; Lunar-specific |
| Background grant via charm | Lunar | Transient Background item stamped on ally; cleanup AE; Lunar-specific |
| Linked NPC template | Lunar | NPC actor binding to charm active state; token teardown on deactivation; Lunar-specific |
| Overwrite pool | Abyssal | New `overwritePool` schema field; separate spend path in mote-cost resolver; Abyssal-specific |

---

## Parked (no actionable work)
| Item | TODO Section | Note |
|------|-------------|------|
| Background mechanical hooks | Other | Mechanized types (Familiar/Cult/Command/Followers) done. Backing/Contacts/Resources kept narrative-only by user decision (2026-06-04). Re-open if specific automations are identified. |
| Monstrance of Celestial Portion | Abyssal | Data fields done. Control/servitude mechanics (deathlord authority over deathknight) deemed purely narrative by user (2026-06-06) — no automation. |

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 4 |
| B — Ready, Medium | 7 |
| C — Ready, Complex | 11 |
| **Total active** | **22** |
| (Parked) | 2 |
