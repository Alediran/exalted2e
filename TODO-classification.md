# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-06-25 (Group A complete: targetNumberReduction, onslaughtMultiplier, virtueRollTrigger wired; Unbreakable Warrior's Mastery confirmed already correct)

---

## Group A — Ready, Simple ✅ All complete
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Status |
|------|-------------|--------|
| Target-number reduction (`targetNumberReduction`) | Combat System | ✅ Done — schema + `countSuccesses` parameterized + `rollAttack` consumer + UI + i18n |
| Onslaught multiplier (`onslaughtMultiplier`) | Combat System | ✅ Done — schema + extra `addOnslaught()` calls in `rollAttack` + UI + i18n |
| Fix Unbreakable Warrior's Mastery | Charms | ✅ Done — source JSON already correct; no fix needed |
| Formal virtue roll pipeline | Virtues & Willpower | ✅ Done — `virtueRollTrigger` SchemaField + consumer in `activateCharm` + UI + i18n |

---

## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| ~~Soak reduction on hit (`soakReductionOnHit`)~~ | Combat System | **Done** — schema + bonus fields + soak subtraction + `_applyOnHitSoakReduction` post-hit AE |
| ~~Damage-driven penalty (`damageDrivenPenalty`)~~ | Combat System | **Done** — schema + `_applyDamageDrivenPenalty` stamps `internalPenalty` AE after damage |
| ~~Temporary health levels (`temporaryHealthLevels`)~~ | Combat System | **Done** — schema + `buildCharmSynthAEs` consumer writing to `healthGrantZero/One/Two` |
| ~~Fix Serpentine Evasion consumer~~ | Charms | **Done** — disabled incorrect `dvBonus`; retroactive Step-2 success penalty not automatable yet |
| ~~Fix Shockwave Technique consumer~~ | Charms | **Done** — added `Unblockable` keyword |
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
| A — Ready, Simple | 0 (all done) |
| B — Ready, Medium | 7 |
| C — Ready, Complex | 11 |
| **Total active** | **18** |
| (Parked) | 2 |
