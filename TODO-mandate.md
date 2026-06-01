# TODO: Mandate of Heaven Subsystem

Reference: `docs/_extraction/mandate-of-heaven.md` (full rules, pp. 130–156 of Storyteller's Companion)

Implementation pattern reference:
- Actor type: `module/data/actor/unit-data.mjs` + `module/sheets/actor/unit-sheet.mjs`
- Registration: `module/exalted2e.mjs` lines 218–280, `system.json` documentTypes
- Roll engine: `module/rolls/exalted-roll.mjs` (d10 pool, 7–9 = 1 success, 10 = 2 successes)

---

## Phase 1 — Data Model

The entire subsystem rests on this. Nothing else can start without it.

### 1.1 `module/data/actor/dominion-data.mjs` — DominionData TypeDataModel

- [ ] **Magnitude** — `NumberField({ integer: true, min: 0, max: 9, initial: 3 })`
- [ ] **Society type** — `StringField({ choices: ["human", "mostlySuper", "supernatural"], initial: "human" })` — controls Virtue max and starting Virtue bonus dots
- [ ] **Dominion type** — `StringField({ choices: ["player", "rival", "background"], initial: "player" })`
- [ ] **Attributes** — Military, Culture, Government; each as a `SchemaField` with:
  - `base` — permanent base rating (set by Magnitude, changed only by Magnitude shifts)
  - `value` — current rating (base + action-increased dots)
  - `duration` — turns remaining before action-increased dots degrade (NumberField, min 0)
  - Constraint: `value ≤ base * 2`; `base ≤ 5` at creation
- [ ] **Abilities** — 10 fields (Awareness, Bureaucracy, Craft, Integrity, Investigation, Occult, Performance, Presence, Stealth, War): `NumberField({ integer: true, min: 0, max: 5 })`; constrained at creation to `≤ Magnitude`
- [ ] **Specialties** — `ArrayField` of `SchemaField({ ability: StringField, label: StringField, value: NumberField({ min:1, max:3 }) })`; max 3 per Ability
- [ ] **Virtues** — Compassion, Conviction, Temperance, Valor: `NumberField({ integer: true, min: 0, max: 7 })`; max enforced per society type (5/6/7)
- [ ] **Virtue Flaw** — `StringField({ choices: ["compassion","conviction","temperance","valor",""] })` — the highest Virtue; auto-derived in `prepareDerivedData`
- [ ] **Limit** — `NumberField({ integer: true, min: 0, max: 10, initial: 0 })`
- [ ] **Willpower** — `SchemaField({ permanent: NumberField({ min: 0, max: 10 }), value: NumberField({ min: 0, max: 10 }) })`; permanent = sum of two highest Virtues at creation
- [ ] **Bonus points** — `SchemaField({ available: NumberField({ min: 0 }), total: NumberField({ min: 0 }), externalAvailable: NumberField({ min: 0 }), externalTotal: NumberField({ min: 0 }) })`; total = `Magnitude * 5`; externalTotal cap = `Magnitude * 3`
- [ ] **Supernatural Defense** — `NumberField({ integer: true, min: 0, max: 3, initial: 0 })`
- [ ] **Spy ratings** — `ArrayField(SchemaField({ targetId: StringField, targetName: StringField, rating: NumberField({ min: 0, max: 3 }) }))` — one entry per tracked dominion
- [ ] **Treaties** — `ArrayField(SchemaField({ type: StringField, targetId: StringField, targetName: StringField, duration: NumberField, binding: BooleanField, proposedByUs: BooleanField, broken: BooleanField }))` with types: `trade`, `nonaggression`, `alliance`, `backing`, `backed-by`
- [ ] **Ongoing actions** — `ArrayField(SchemaField({ actionKey: StringField, targetId: StringField, targetName: StringField, duration: NumberField, notes: StringField }))`
- [ ] **Turn state** — `SchemaField({ actionsRemaining: NumberField, eventsRemaining: NumberField, initiativeScore: NumberField, isLimitBreak: BooleanField })` — GM-facing turn-tracking fields
- [ ] **Savant/Sorcerer link** — `SchemaField({ characterId: StringField, rank: StringField({ choices: ["","savant","sorcerer","legitimate"] }), isLegitimate: BooleanField })`
- [ ] **`prepareDerivedData()`** — auto-derive Virtue Flaw (highest Virtue), enforce society-type Virtue cap, compute `willpower.permanent` from two highest Virtues (only at creation flag), compute starting Limit from `Magnitude − lowestVirtue`

### 1.2 `system.json` — Register dominion actor type

- [ ] Add `"dominion": {}` to `documentTypes.Actor`
- [ ] Add dominion CSS to `styles` array (or share `_actor.css`)

### 1.3 `module/exalted2e.mjs` — Wire up data model and sheet

- [ ] Import `DominionData` and register in `CONFIG.Actor.dataModels`
- [ ] Import `DominionSheet` and register with `Actors.registerSheet("exalted2e", DominionSheet, { types: ["dominion"], makeDefault: true })`

---

## Phase 2 — Dominion Actor Sheet

The data model is useless without a way to view and edit it.

### 2.1 `module/sheets/actor/dominion-sheet.mjs` — DominionSheet

- [ ] Extend `HandlebarsApplicationMixin(ActorSheetV2)` (same pattern as `CharacterSheet`)
- [ ] `PARTS` map: `{ header, traits, abilities, virtues, diplomacy, actions }`
- [ ] `DEFAULT_OPTIONS`: `submitOnChange: true`, no `tag: "dialog"`
- [ ] **Context builder** — pass all dominion system data, computed labels, Magnitude table description (village/town/city/etc.), bonus point tallies
- [ ] **`_preparePartContext()`** — per-tab computed data (e.g., current vs. base Attribute columns)

### 2.2 `templates/actor/dominion/` — HBS partials

- [ ] **`tab-header.hbs`** — name, Magnitude selector (0–9), society type, dominion type, savant/sorcerer link
- [ ] **`tab-traits.hbs`** — Attributes panel (Military/Culture/Government with base dots, action dots, duration counter, degradation indicator); Virtues panel (4 Virtues with dot ratings, Virtue Flaw circle indicator); Willpower track (permanent + temporary boxes); Limit track (10 boxes + Limit Break indicator); Bonus Points summary (available/total/external)
- [ ] **`tab-abilities.hbs`** — 10 Ability rows with dot ratings and specialty slots (up to 3 per Ability with label + bonus value); specialty bonus point cost indicator
- [ ] **`tab-diplomacy.hbs`** — Treaty list (type, target, duration, binding, broken flag); Spy ratings list (per target dominion); Ongoing actions list (name, target, duration remaining); Supernatural Defense dots; Parent/child dominion fields
- [ ] **`tab-actions.hbs`** — Action log / turn state panel (for GM use: actions remaining, events remaining, current step, initiative score)

### 2.3 Sheet Actions

- [ ] Inline edit for Attribute base rating, Ability dots, Virtue dots, Willpower boxes
- [ ] Add/remove treaty button → opens treaty creation dialog
- [ ] Add/remove spy rating row
- [ ] Add/remove ongoing action row
- [ ] Add/remove specialty row
- [ ] Spend bonus point button on Abilities and Virtues (tracks available pool)
- [ ] Recover bonus point button (Dragon Rearranges Scales)

---

## Phase 3 — Roll Engine

All actions use the same dice-pool structure; build this once and reuse.

### 3.1 Dominion Roll Dialog

- [ ] **`module/rolls/dominion-roll.mjs`** — `rollDominion(actor, options)` function
  - Pool = `dominion Attribute + Ability + modifiers` (uses existing `ExaltedRoll` d10 pool)
  - Difficulty = `target's Attribute + Virtue + modifiers` (input or passed in)
  - Pre-roll options: spend 1 temporary WP for +1 auto success; channel a Virtue for extra dice (+ Limit cost)
  - Post-roll: count successes vs. difficulty → net successes, success/failure/botch result
- [ ] **Roll dialog HBS** — `templates/dialog/dominion-roll-dialog.hbs`
  - Attribute selector (Military / Culture / Government)
  - Ability selector (10 Abilities + Specialty checkboxes)
  - Modifier field (numeric, for turn length, spy rating, ally discount, etc.)
  - Target difficulty display (Attribute + Virtue of target dominion)
  - Willpower spend checkbox (+1 auto success; deducts temporary WP on confirm)
  - Virtue channel dropdown (select Virtue → shows extra dice and Limit cost)
  - Keywords preview (At War, External, Binding, etc.)
- [ ] **Chat card** — `templates/chat/dominion-roll-result.hbs`
  - Dominion name, action name, dice pool breakdown, successes, difficulty, net successes, pass/fail
  - Effect summary (what changes and by how much)
  - "Apply Effects" button (GM-only, applies Trait changes to actor documents)

### 3.2 Difficulty Modifier Helper

- [ ] **`module/rolls/dominion-modifiers.mjs`** — `computeDominionModifiers(actor, targetActor, options)` function
  - Turn length modifier (season +0, year −1, decade −3)
  - Society type modifier (+0/+1/+2)
  - Savant/Sorcerer status modifier (+2/+0)
  - External action: target relationship modifier (backing/ally/non-ally/at-war/your-own)
  - External action: spy rating discount (−1 to −3)
  - External action: supernatural defense penalty (+1 to +3)
  - Internal action: own-dominion discount (−2)

---

## Phase 4 — Action System

Define all ~30 named actions and make them executable.

### 4.1 Action Definitions — `module/config.mjs` (EX2E.dominion.actions)

For each action, define: `{ key, label, category, cost, mins, diffFormula, keywords, activation, duration, durationDegrades, effectFn }` where `effectFn` is called after a successful roll.

- [ ] **Constructive** (6 actions):
  - Bear Startles Mouse Appropriation (Military +1)
  - Tiger Confounds Bear Legislation (Government +1)
  - Mouse Defies Tiger Acculturation (Culture +1)
  - Dragon Tends Its Claws Preservation (reset Attribute duration to 4)
  - Dragon's Open-Eyed Slumber Technique (cancel next event, costs 1 WP)
  - Mouse Calms the Nest Pacification (reduce Limit by successes)
  - Tiger Esteems Mouse Petition (recover temporary WP)
  - Diligent Minister's Attenuation Technique (restore Attribute below base)
  - Dragon Spreads Wings Expansion (increase Magnitude)
  - Dragon Rearranges Scales Maneuver (redistribute bonus points)
  - Meticulous Actuary's Disbursement Rectification (reallocate Ability dots)
  - Artificer's Celestial Fortification (increase Supernatural Defense)
- [ ] **Self-Destructive / Events** (5 actions):
  - Mouse Gnaws Bear Reduction (reduce Military)
  - Bear Coerces Tiger Misappropriation (reduce Government)
  - Tiger Crushes Mouse Regulation (reduce Culture)
  - Mouse Burns the Grain (increase Limit)
  - Dragon Devours Tail Recession (reduce Magnitude — Limit Break only)
  - Covetous Magistrate Prevarication (reclaim bonus points)
- [ ] **Conquest** (6 actions):
  - Furious Bear's Intense Assault (reduce target Military)
  - Wily Tiger Emulates Serpent Maneuver (reduce target Government)
  - Sturdier Mouse Persuasion (reduce target Culture)
  - Serpent Taints the Well Disruption (increase target Limit)
  - Bear's Terrifying Roar Demonstration (transfer Attribute dots)
  - Rapacious Bear Incursion (steal bonus points)
  - Gluttonous Bear Encirclement (absorb dominion — Limit Break)
  - Serpent Stalks the Reeds Insinuation (install spies)
  - Mongoose Hunts Serpent Inquisition (remove enemy spies)
- [ ] **Diplomatic** (9 actions):
  - Sorcerer's Inscrutable Disengagement (cancel treaties)
  - Savant's Pernicious Treachery (break treaties immediately)
  - Tiger Looses Bear Declaration (declare war)
  - Tiger Fetters Bear Concession (sue for peace)
  - Tiger Welcomes Mouse Enticement (establish trade rights)
  - Two Tigers Circle Covenant (nonaggression pact)
  - Savant's Serene Coalition (alliance — human dominions)
  - Sorcerer's Inviolate Pact (alliance — supernatural dominions)
  - Emissary's Necessitous Endorsement (renew treaties)
  - Tiger Shelters Cub Patronage (provide backing)
  - Cub Absconds Litter Refusal (refuse backing)

### 4.2 Action Picker UI — `module/apps/dominion-action-picker.mjs`

- [ ] `ApplicationV2` dialog listing all actions grouped by category (Constructive / Conquest / Diplomatic / Self-Destructive)
- [ ] Filter by: keyword tags (Internal/External/At War/At Peace/Espionage/Ally/Non-Ally), activation time
- [ ] Greyed-out actions the dominion cannot currently perform (Attribute/Ability minimum not met, wrong war state, insufficient Limit/WP budget)
- [ ] On action select → launch Roll Dialog pre-populated with that action's pool formula, keywords, and difficulty formula

### 4.3 Effect Applicator

- [ ] `module/rolls/dominion-effects.mjs` — `applyDominionActionEffect(action, actorFrom, actorTo, netSuccesses)` function
  - Applies Trait increases/decreases to the correct dominion actors
  - Adjusts Limit, temporary WP, Bonus Points, Spy ratings, treaty array as appropriate
  - Writes a duration entry on the acting actor's `ongoingActions` array

---

## Phase 5 — Turn Manager

The Mandate of Heaven is played in structured turns; this orchestrates them.

### 5.1 `module/apps/mandate-turn-manager.mjs` — MandateTurnManager

- [ ] Singleton `ApplicationV2` window (GM-only, rendered via sidebar button or macro)
- [ ] **State stored on a `JournalEntry` or world setting** so it persists across refreshes:
  - `currentTurnLength` ("season" / "year" / "decade")
  - `dominions` array — `[{ actorId, initiativeScore }]` sorted by initiative
  - `activeDominionIndex` — which dominion is currently acting
  - `step` — "two" (actions) or "three" (events)
  - `actionsUsed`, `eventsUsed` on each dominion
  - `turnNumber`, `totalTurns`
- [ ] **Initiative Phase UI** — Roll Initiative button → rolls (Government + Temperance) for each dominion, sorts them, handles ties (higher Temperance first, then reroll prompt)
- [ ] **Active Turn UI** — shows current dominion, actions remaining, events remaining, step indicator
  - "Take Action" button → opens Action Picker for the controlling player
  - "Select Event" button → opens Event Picker for the previous player/GM
  - "End Dominion Turn" button → advances to next dominion
- [ ] **Step cycling logic** — after 3 actions, trigger first event; after event, return to remaining actions; after all actions + events, advance to Step Four; then next dominion
- [ ] **Step Four automation button** (GM):
  - Reduce all dominions' Limit by 1 (except those in Limit Break)
  - Roll each dominion's highest Virtue vs. current temporary WP (difficulty) → gain 1 temporary WP on success
  - Reduce all action durations by 1; expire those at 0 (with Attribute degradation if applicable)
  - Reduce unspent external bonus points by 2; increase raided-pool recovery by 3

### 5.2 Attribute Degradation Handler

- [ ] On duration expiry for Attribute-boosting actions: if `value > base`, reduce `value` by 1 and reset `duration` to 3; if `value <= base`, set `duration` to 0 and do not reduce further
- [ ] On base rating change (Magnitude shift): if `base` decreases and `value > base * 2`, reduce `value` to `base * 2` and reset duration to 3; base increases do not affect excess dots

### 5.3 Event Picker — `module/apps/dominion-event-picker.mjs`

- [ ] `ApplicationV2` dialog shown to the **previous player** in turn order (or the Storyteller)
- [ ] Lists all self-destructive actions as possible events, filtered to those the **target** dominion meets Attribute/Ability minimums for
- [ ] Hides target's Trait sheet; Storyteller may verify minimums if disputed ("Hey, Stop Looking At My Sheet" rule)
- [ ] On select: executes the event against the target dominion (no Charm or stunt bonuses)
- [ ] Target dominion player sees the event pop up with two options: "Cancel (spend 2 Limit)" or "Allow (reduce Limit by 1)"

---

## Phase 6 — Limit Break System

### 6.1 Limit Break Detection

- [ ] At the end of any action or event that raises Limit: if `limit === 10`, set `turnState.isLimitBreak = true` and show a chat message notifying all players
- [ ] Freeze Limit at 10 during the Limit Break turn; ignore all Limit changes until it ends
- [ ] At the end of the Limit Break turn: set `limit = 0`; add temporary WP equal to highest Virtue (can exceed permanent or 10)

### 6.2 Limit Break Turn Inversion

- [ ] During the Limit Break turn, the dominion's action slots become event slots and vice versa
- [ ] The opposing player (previous in turn order) selects the dominion's "actions" (events executed against it); the dominion's player selects "events" normally
- [ ] Actions during Limit Break ignore Limit costs
- [ ] Dragon Devours Tail Recession can only be attempted once per Limit Break

### 6.3 Magnitude Reduction on Limit Break

- [ ] If Dragon Devours Tail Recession succeeds: the opposing player removes Attribute/Ability/Virtue dots and bonus points per the Magnitude-decrease table; the dominion's player may then redistribute one Attribute, two Abilities and one Virtue from the reduced pool
- [ ] After a Limit Break, set a cooldown of one decade (or five turns) before another Magnitude change

---

## Phase 7 — Diplomatic Treaty System

### 7.1 Treaty Tracking

- [ ] **Treaty creation dialog** — `module/apps/dominion-treaty-dialog.mjs`: select treaty type, target dominion (from actor list), duration, Binding flag; writes to `system.treaties` on both actors
- [ ] **Treaty list display** on diplomacy tab: colored by type, duration countdown, broken/active indicator, circle if proposed by other party
- [ ] **Treaty difficulty modifier** — `computeDominionModifiers` reads the `treaties` array to apply history-based difficulty modifiers (broken treaty in last 5 turns, etc.)
- [ ] **Treaty breaking** — Savant's Pernicious Treachery sets `broken: true`, starts the penalty duration counter; Sorcerer's Inscrutable Disengagement sets `duration: 1` and marks Binding treaties as still-binding until expiry

### 7.2 Alliance Effects

- [ ] When two dominions are allied: all their mutual-action difficulties reduced by 1 (applied automatically in `computeDominionModifiers`)
- [ ] Nonaggression treaty resets to 5 when an alliance is formed/expires
- [ ] Alliance forces war choice when ally declares war (chat message to controlling player with choice buttons)
- [ ] Multi-faction war between allies: +1 Limit per turn while war continues, no forced side selection

### 7.3 Backing Effects

- [ ] Tiger Shelters Cub Patronage: on success, increase target Attribute ratings by (Magnitude difference), increase target Limit by same amount, optionally donate bonus points
- [ ] Target gains +1 Limit each turn backing is active (tracked in `treaties` array as a committed WP flag on backing dominion)
- [ ] Backing immediately cancelled on Limit Break of the backer, or if Cub Absconds Litter Refusal succeeds

### 7.4 Parent/Child Dominion

- [ ] `system.parentDominionId` field on DominionData
- [ ] Free backing: child automatically gains effects of backing from parent without treaty; no Limit increase for child; indefinite duration
- [ ] Cannot perform external actions against each other

---

## Phase 8 — Character Integration

### 8.1 Savant / Sorcerer Qualification

- [ ] `module/helpers/dominion-character-link.mjs` — `evaluateDominionRole(character)` function
  - **Savant**: any two Backgrounds with combined total ≥ 8 → role = `"savant"`
  - **Sorcerer**: three or fewer of (Allies + Backing + Followers + Influence + Resources) with combined ≥ 11 → role = `"sorcerer"` (Cult applies if dominion shares religion)
  - Returns `null` if neither threshold met
- [ ] UI on dominion sheet diplomacy tab: link a character actor, show computed role

### 8.2 Legitimacy Roll

- [ ] `module/apps/dominion-legitimacy-dialog.mjs` — roll `([highest Social Attribute] + [character Virtue matching dominion's Flawed Virtue])` vs. difficulty `(dominion Magnitude + Willpower)` with the modifier table from the rules
- [ ] Multiple contestants can roll; highest net successes wins (ties go to more favorable difficulty modifier, then re-roll)
- [ ] Winning character's legitimacy flag set on the dominion actor for the current turn

### 8.3 Ability/Virtue Replacement

- [ ] In the Roll Dialog, if a linked savant/sorcerer is present:
  - **Savant**: "Replace Ability" checkbox (one per turn); if checked, substitute the character's Ability for the dominion's Ability; adds +2 difficulty
  - **Sorcerer**: "Replace Ability" checkbox (two per turn); no difficulty penalty
  - **Legitimate Sorcerer**: additionally, "Replace Virtue" checkbox (one per turn, reflexive — can be declared after action but before roll); replacing Flawed Virtue adds 1 Limit; "Spend character Willpower instead" checkbox (reflexive); "Reduce Limit" action (10m = 1 Limit, or 2 WP = 1 Limit)

### 8.4 Charm Integration

- [ ] `EX2E.dominion.mandateCharms` — list of Solar Charms with the Mandate keyword (Bureau-Rectifying Method, Immanent Solar Glory, Infinite Wisdom Well, Insightful Buyer Technique, Taboo Inflicting Diatribe, Wise-Eyed Courtier Method, Wyld-Shaping Technique)
- [ ] In the Roll Dialog, if the linked character has the charm: show it as an available enhancement with its effect description
- [ ] Infinite Wisdom Well: add it as a spell-like charm on the Sidereal charm sheet with its full stats from p. 140
- [ ] Stunt bonuses: if a savant/sorcerer directs an action and stunts, add the standard 1/2/3 stunt dice; character regains Essence/WP per normal stunt rules; track current Essence and temporary WP on the character link

### 8.5 Essence / Willpower Carry-over

- [ ] Characters begin their next regular Exalted scene with the Essence and temporary WP they had at the end of Mandate play
- [ ] At Step Four, savants/sorcerers automatically regain 5 motes of Essence after each of their dominion's events; also regain Essence during stunted actions; regain 1 temporary WP when the dominion regains WP

---

## Phase 9 — Advanced Features

### 9.1 Magnitude Change Wizard — `module/apps/dominion-magnitude-wizard.mjs`

- [ ] When Dragon Spreads Wings Expansion succeeds, open the wizard:
  1. The last player in turn order may redistribute one Attribute dot, two Ability dots, and one Virtue dot (or the dominion spends 1 Limit to prevent)
  2. Then apply new Magnitude-level Ability/Attribute/Virtue/Bonus Point allotment
  3. Display which Traits the player may now raise with the new bonus points (no Trait may be raised more than one dot via bonus points per turn; require converting bonus points to permanent via a subsequent action)
- [ ] When Magnitude decreases (Dragon Devours Tail Recession): opposing player removes dots; then dominion player redistributes one Attribute, two Abilities, one Virtue

### 9.2 Spy System

- [ ] Serpent Stalks the Reeds Insinuation on success: increment the spy rating for that target on the acting actor's `spyRatings` array
- [ ] Spy rating displayed as a −1/−2/−3 modifier in `computeDominionModifiers` for External actions against that target
- [ ] Reduce Spy rating by 1 → reveal one Attribute, one Ability, one Virtue, temporary WP, and current Limit from the target (shown only to the acting player via socket message)
- [ ] Mongoose Hunts Serpent Inquisition: decrement target's spy rating for your dominion

### 9.3 Competent Dominions Option (pre-play free actions)

- [ ] World setting toggle: "Competent Dominions" (on by default)
- [ ] When a new dominion enters play (or when the option is first enabled), compute free action count: `ceil((Government + Temperance) / 2)`
- [ ] Dominions with ≤ 3 free actions may only take Constructive actions; those with 4+ may also take positive Diplomatic actions; Limit cannot reach 10 during free actions; no Magnitude changes

### 9.4 Extended Downtime Calculator — `module/apps/dominion-downtime-calc.mjs`

- [ ] Input: downtime duration (years, months)
- [ ] Output: breakdown of decade + year + season turns needed
- [ ] Option to run turns in bulk (auto-resolve without player input for background dominions, rolling without UI for rival dominions)

---

## Phase 10 — Compendium and Polish

### 10.1 `src/packs/dominions/` — Dominion Templates Pack

- [ ] Folder structure mirroring Magnitude tiers (0–3 / 4–6 / 7–9)
- [ ] Pre-built sample dominions:
  - Magnitude 0 — Abandoned Village
  - Magnitude 1 — The Plaza (Great Forks)
  - Magnitude 2 — Great Forks (default starting point)
  - Magnitude 3 — Lookshy
  - Magnitude 4 — Nexus
  - Magnitude 5 — Realm Prefecture / The Scavenger Lands
  - Magnitude 6 — The Realm
- [ ] Register pack in `system.json`

### 10.2 Dominion Creation Wizard — `module/apps/dominion-creation-wizard.mjs`

- [ ] Step 1: Enter name, select Magnitude, society type, dominion type
- [ ] Step 2: Distribute Attribute dots (1 per Magnitude, max 5)
- [ ] Step 3: Distribute Ability dots (per Magnitude table, max min(5, Magnitude))
- [ ] Step 4: Distribute Virtue dots (per society-type table, max 5/6/7)
- [ ] Step 5: Circle Virtue Flaw (auto-selects highest; player confirms)
- [ ] Step 6: Spend bonus points (5 per Magnitude)
- [ ] Step 7: Review and create → writes actor

### 10.3 Print-Optimized Sheet

- [ ] `templates/actor/dominion/print.hbs` — mirrors the p. 156 dominion sheet layout
- [ ] `window.print()` button on the sheet header

### 10.4 Sidebar Integration

- [ ] Add a "Mandate of Heaven" button to the Actors sidebar (GM-only, beside the Create Actor button) that opens the Turn Manager
- [ ] OR a dedicated compendium-browser-style panel for ongoing Mandate campaigns

### 10.5 i18n

- [ ] Add all new keys to `lang/en.json` and `lang/es.json` (dominion Trait labels, action names, keyword labels, dialog strings, chat card strings)

---

## Summary Order

```
Phase 1: DominionData schema + registration + basic sheet
Phase 2: Roll engine (dominion-roll + modifier helper + chat card)
Phase 3: Action definitions + Action Picker + Effect Applicator
Phase 4: Turn Manager + Attribute degradation + Event Picker
Phase 5: Limit Break detection + inversion + Magnitude-reduction handling
Phase 6: Treaty tracking + alliance/backing effects + parent/child
Phase 7: Savant/Sorcerer qualification + legitimacy + Ability replacement + Charm integration
Phase 8: Magnitude wizard + Spy system + Competent Dominions option
Phase 9: Extended downtime calculator + dominion templates pack + creation wizard
Phase 10: Print sheet + sidebar integration + i18n
```
