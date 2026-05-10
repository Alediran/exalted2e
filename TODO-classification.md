# TODO Classification — Exalted 2e Foundry VTT

Companion to `TODO.md`. Classifies all pending `[ ]` / `[~]` items by implementation readiness, then complexity.
Last updated: 2026-05-09 (after Status Effects remainder cluster)

---

## Group A — Ready, Simple
*Isolated, 1–3 files, clear existing pattern to follow.*

| Item | TODO Section | Notes |
|------|-------------|-------|
| Height advantage (+1/+3 DV close combat) | Combat | cover AE framework done; height-advantage rule still pending |
| Drag-reorder within Combo sheet | Combat | UI arrow buttons only |
| Shared/compendium-sourced Combos | Combat | drag handler on combo sheet, existing pattern |
| Monstrance of Celestial Portion | Abyssal | fields done; control/servitude mechanics (deathlord authority over deathknight) still pending |
| Stunt-on-perfect | Stunts | small logic fix in roll dialog |
| Motivation-advance WP reward | Stunts | hook trigger on motivation change |
| Macro to re-create Circle folder | Circle | standalone macro |
| Restoring defaults when actor leaves Circle | Circle | hook on folder-item remove |
| Status effects compendium | Compendium | Blind/Deaf/Stunned/Grappled seeded; Knockdown/Poisoned/Diseased/Crippled still pending |
| Willpower recovery on virtue channel success | Other | hook trigger, 1–2 lines |
| docs/charm-authoring.md | Docs | prose only |
| docs/npc-stat-blocks.md | Docs | prose only |

---

## Group B — Ready, Medium
*Multi-file, all dependencies present, needs some design.*

| Item | TODO Section | Key concern |
|------|-------------|-------------|
| Range bands with tiered penalties | Combat | config table + range-check rewrite + attack penalty lookup |
| Combo-building rules (size limits, keyword restrictions) | Combat | charm filter at combo-add time; pre-errata size caps |
| Consolidated single chat card + combined Reverse | Combat | chat card template redesign |
| Area attacks | Combat | new attack schema flag + resolution path without accuracy roll |
| Coordinated attacks | Combat | leader Cha+War roll + DV reduction AE on target |
| Aim bonus banking | Combat | multi-tick container already exists; add banking counter |
| Shields as weapons | Defense | new weapon tag handling, DV bonus, mobility penalty |
| Fatigue penalty mechanic | Defense / Penalty | hook on scene-length exertion + Sta+Res roll |
| Stackable keyword accumulation | Keywords | per-charm per-target stack counter |
| Compulsion / Emotion AE | Keywords | keyword → scene-long AE, AE template system |
| Illusion disbelieve mechanic | Keywords | Per+Investigation check against charm activation |
| Servitude AE | Keywords | loyalty-binding AE, removal conditions |
| Overdrive pool | Keywords | temp Peripheral pool tracking + scene-end dissipation |
| Blasphemy / Axiomatic / Dawn damage upgrades | Keywords | mirror of Holy, splat-specific target condition |
| Training keyword XP debt ledger | Keywords | per-actor debt AE or item field |
| Merged keyword (learn-once, multi-ability) | Keywords | charm activation routing extension |
| Permanent Essence + Willpower cost general field | Charms | new charm-data fields + activateCharm spending path |
| First/Second-vs-Third Excellency exclusivity | Charms | roll dialog: detect both activated, block double-use |
| Infinite Mastery discount | Charms | committed-mote tracking → Excellency cost reduction |
| Spell casting chat card | Sorcery | commit→cast cycle, reverse button, mote ledger |
| Countermagic resolution | Sorcery | reflexive roll + mote cost, 3-circle tiering |
| Form-type charm handling | Martial Arts | track active Forms per actor + style; enforce one-at-a-time; scene duration AE |
| Style weapon tag validation | Martial Arts | define per-style weapons config (M/MO tags), then enforce at attack time |
| Sidereal MA entry gate | Martial Arts | check actor owns a Form-type charm from ≥1 Celestial style |
| Sidereal MA gating (splat section) | Sidereal | same as above; cross-reference in splat section |
| Celestial-MA DB initiation charms | Martial Arts | specific charm data + actor gating for DB access to Celestial styles |
| Celestial-MA per-charm surcharge | Martial Arts | `martialArtsTier === "celestial"` check in aspect-surcharge.mjs for DB actors |
| Celestial-MA 1.5× XP | Martial Arts | same tier check in XP cost engine for non-resonant exalts |
| Martial/Martial-ready keyword gating | Keywords | weapon tag check at charm-learn time using per-style weapons config |
| Limit Break scripted scene effects | Solar / Virtues | per-Virtue-Flaw AE templates (4 flaws × 2 break types) |
| Shintai / Mantle form-type charms | Infernal | charm activation mode + transformation state AE |
| Gremlin Syndrome / Dissonance | Alchemical | Clarity track → Dissonance consequences |
| Resplendent Destiny payloads | Sidereal | extend item type: Ascendant/Descending mechanical effects |
| Per-splat tabs on character sheet | Sheet | new tab per splat with existing track widgets |
| Willpower recovery hooks (rest / stunt) | Virtues | hook registration + recovery amounts |
| Limit accumulation automation | Virtues | trigger Limit increment on Virtue Flaw condition |
| Per-trait lock overrides | XP | per-field lock flag, purchase mode guard |
| Circle special buttons (party roll, XP award, rest) | Circle | macro-buttons on folder widget |
| NPC → character auto-conversion on move-in | Circle | hook + actor-type change |
| Clarity mechanical effects | Alchemical | Clarity track consequences (Virtue suppression thresholds) |
| Crippling injuries | Other | health track extension + extended surgery roll |
| Environmental hazards | Other | Damage/interval + Trauma AE, configurable hazard schema |
| Manse item type | Other | TypeDataModel + mote-regen integration with hearthstone regen |
| Background mechanical hooks | Other | AE per background dot (Manse regen, Familiar ref, etc.) |
| Scene-end reset | Other | hook + reset: anima, scenePeripheral, per-scene WP drain counters |
| Mundane crafting roll resolver | Crafting | extended roll vs Resources difficulty |
| Drag-and-drop items between sheets | QoL | improve drop handler across item types |
| Multi-actor action helpers | QoL | coordinate/cooperative charm dialog |
| Personal/Peripheral commitment split | QoL | artifact attunement choice UI |
| Poison/Disease tracking | Other | per-interval AE *(needs Poison/Disease item types — Group A — first)* |
| Pre-built weapons/armor compendia | Compendium | data authoring, magical material variants |
| Pre-built spells compendium | Compendium | data authoring (3 circles × 2 traditions) |
| Pre-built artifact compendium (daiklaves/armors) | Compendium | data authoring + attunement variants |
| Headless tests for remaining paths | Testing | test authoring for charm prereqs, multi-tick, sorcery |
| Social Combos | Social | adapts combo infrastructure for social charms *(soft dep: base combo items still open)* |
| Intimacy as first-class scored trait | Social | rewrite stub into scored trait with cap + ablation logic — large |

---

## Group C — Ready, Complex
*New sub-systems, significant design + multi-day implementation.*

| Item | TODO Section | Why complex |
|------|-------------|-------------|
| Clinch / Grapple | Combat | new turn-loop: control pool, opposed rolls, sub-actions (throw/crush/hold), per-tick renewal |
| Mounted combat | Combat | Ride-controlled mount stats, charge bonuses, Ride charm integration |
| Keyword-as-status-effect registry | Keywords | systematic mapping engine: all Compulsion/Emotion/Illusion/Servitude charms → AEs |
| Charm deactivation resolver | Charms | state machine: scene-end / combat-end / out-of-motes, handles all duration types |
| Thaumaturgy | Sorcery | separate lower-power tier: procedures, degrees, own roll resolver |
| Artifact creation rules | Crafting | extended Craft roll + Craft+Lore+Occult, seasons interval, exotic ingredient tracker |
| Pre-built charms compendium | Compendium | hundreds of Solar charms minimum; large data-authoring effort |
| Mass combat | Other | new sub-system: unit actor type, Magnitude/Drill/Might/Morale, formations, commander relay |
| Vehicle / Warstrider actor type | Other | new actor type with unique soak/movement/weapon-mount mechanics |
| Migration pipeline | QoL | schema versioning, upgrade scripts, DataModel migration hooks |

---

## Group D — Blocked
*Cannot start without completing another open item in this list.*

| Item | TODO Section | Blocked by |
|------|-------------|-----------|
| Intimacies section (cap + ablation UI) | Sheet | Intimacy as scored trait (Group B) |
| Countermagic cost variance by circle | Sorcery | Countermagic resolution (Group B) |
| Spell-specific duration/effect payloads | Sorcery | Spell casting chat card (Group B) |
| Ghost summoning | Sorcery | Spell casting chat card (Group B) |
| Binding/fetter spells | Sorcery | Spell casting chat card (Group B) |
| Demon summoning | Sorcery | Spell casting chat card (Group B) |
| Combo-Basic keyword enforcement | Combat | Form-type charm handling (Group B) |
| Flaw-of-Invulnerability +2 WP combo surcharge | Combat | Form-type charm handling (Group B) |
| Manse geomancy rules | Crafting | Manse item type (Group B) |
| Workshop & material prerequisites UI | Crafting | Mundane crafting roll resolver (Group B) |
| Artifact extended-roll builder | Crafting | Mundane crafting roll resolver (Group B) |
| Unit actor type | Other | Mass combat design (Group C) |

---

## Summary

| Group | Count |
|-------|-------|
| A — Ready, Simple | 12 |
| B — Ready, Medium | 55 |
| C — Ready, Complex | 10 |
| D — Blocked | 12 |
| **Total pending** | **89** |

**Biggest force-multipliers:**
- **Spell casting chat card** (Group B) → unblocks 4 sorcery items
- **Form-type charm handling** (Group B) → unblocks 2 combo items
- **Intimacy as scored trait** (Group B) → unblocks the social section
