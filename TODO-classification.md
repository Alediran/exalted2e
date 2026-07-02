# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-07-02 (M71–M75 done: ammo tracking, elsewhere system, maladic capture+transfer, background grant, linked NPC companion)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Status |
|------|-------------|--------|
| Target-number reduction (`targetNumberReduction`) | Combat System | ✅ Done — schema + `countSuccesses` parameterized + `rollAttack` consumer + UI + i18n |
| Onslaught multiplier (`onslaughtMultiplier`) | Combat System | ✅ Done — schema + extra `addOnslaught()` calls in `rollAttack` + UI + i18n |
| Fix Unbreakable Warrior's Mastery | Charms | ✅ Done — source JSON already correct; no fix needed |
| Formal virtue roll pipeline | Virtues & Willpower | ✅ Done — `virtueRollTrigger` SchemaField + consumer in `activateCharm` + UI + i18n |
| ~~Counterattack Unblockable variant (`counterattackUnblockableVariant`)~~ | Combat System | **Done** — schema + chat-cards handler passes `extraKeywords: ["Unblockable"]`; `rollAttack` merges after supplemental loop; checkbox UI + i18n |
| ~~Overdrive pool display~~ | Other Mechanics | **Done** — already rendered in `header.hbs:93-94` as conditional `+N` badge with `OverdriveTooltip`; already complete |

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
| ~~Per-purchase variant selection~~ | Charms | **Done** — `soakBonus.options[]` + picker hook + grouped CharacterSheet display + `evalMaxPurchases` formula resolution |
| ~~Upgrade tier system~~ | Charms | **Done** — `upgradeTiers[]` schema + `charm-tier-math.mjs` + `TierSelectionDialog` + `activateCharm` pipeline |
| ~~Range multiplier (`rangeMultiplier`)~~ | Combat System | **Done** — schema + `getRangeMultiplierFromCharms` (max across active charms) applied in `checkAttackRange`; number input UI + i18n |
| ~~Melee range extension (`meleeRangeExtension`)~~ | Combat System | **Done** — schema + `hasMeleeRangeExtensionFromCharms`; melee treated as 30-unit ranged in `checkAttackRange`; checkbox UI + i18n |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| ~~Mote loan + willpower gift~~ | Combat System | **Done** — `moteLoan`/`willpowerGift` SchemaFields; Circle-folder ally picker in `activateCharm`; `receiveMotes` → `recoverMotes` + new `receiveWillpower` actor method |
| ~~Ally-targeting support~~ | Combat System | **Done** — embedded in moteLoan/willpowerGift; Circle folder by `flags.exalted2e.theCircle`; `DialogV2.prompt` with radio buttons |
| ~~Formal social attack pipeline — MDV-halving~~ | Social Combat | **Done** — `halveMDV` BooleanField; detected post-activation in `rollAttributeAbility`; `resolveStep2` applies `Math.floor(rawBase/2)` to base subtotal; WP-to-resist already existed via `umiCost` |
| ~~Homing attack~~ | Combat System | **Done** — `homingAttack` BooleanField; snapshot carries `homingAttack`/`weaponId`/`modeIndex`/`isHomingReattack`; `showHomingReattack` in `computeAttackOutcome`; button + handler in chat-cards; `homingReattackFired` prevents loops |
| ~~Ammo tracking + `bypassAmmoConsumption`~~ | Combat System | **Done** — `ammo: SchemaField { enabled, current, max }` on WeaponData; gate in `rollAttack` post-`activatedCharmItems`; `bypassAmmoConsumption` BooleanField on CharmData; abort+toast at 0; skipped on homing re-attack |
| ~~Elsewhere system~~ | Combat System | **Done** — `inElsewhere` BooleanField on WeaponData; `sendsWeaponToElsewhere` on CharmData; `ElsewhereInventoryDialog` to recall; paired AE on caster; Archery-specific |
| ~~Dematerialized targeting gate~~ | Lunar | **Done** — `dematerialized` status in `CONFIG.statusEffects`; gate in `rollAttack` post-`activatedCharmItems`; `harmImmaterial` from passives or supplemental charm bypasses it |
| ~~Maladic capture + transfer~~ | Lunar | **Done** — `malados` item type (MaladosData: spiritName, essenceRating); `capturesMalados`/`transfersMalados` BooleanFields on CharmData; capture dialog creates malados item; transfer dialog picks malados + ally and moves item |
| ~~Background grant via charm~~ | Lunar | **Done** — `grantsBackground` BooleanField on CharmData; ally picker creates Background item on target with `charmGranted` flag; tracking AE with `grantedBackgroundRef`; `_removeCharmWeaponArtifacts` deletes granted bg on deactivation |
| ~~Linked NPC companion~~ | Lunar | **Done** — `linksNpcCompanion` BooleanField on CharmData; NPC dropdown binding; tracking AE with `linkedNpcActorId`; `_removeCharmWeaponArtifacts` dismisses NPC tokens from scene on deactivation |

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
| B — Ready, Medium | 0 (all done) |
| C — Ready, Complex | 0 (all done) |
| **Total active** | **0** |
| (Parked) | 2 |
