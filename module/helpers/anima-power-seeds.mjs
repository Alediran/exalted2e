const ANIMA_POWER_SEEDS = [
  // ── Solar ──────────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerSolarDawn",
    exaltType:  "solar",
    caste:      "dawn",
    summary:    "Fear aura: -1 to attackers, +2 DV, disrupts coordinated attacks for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending five motes, the character appears glorious and terrifying until end of scene (or until she lets the effect dissipate). All opponents attempting to attack or oppose her suffer a -1 external penalty on all attack rolls (Unnatural Emotion, 5wp to ignore for a scene). Difficulty to coordinate attacks against her increases by 2. Her DVs increase by 2. She is immune to fear-based Emotion effects while this power is active. If a complementary mass combat unit checks for rout because of her actions, they suffer -2 external penalty.\n\nActivates automatically when the Solar spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerSolarZenith",
    exaltType:  "solar",
    caste:      "zenith",
    summary:    "Holy fire: soak bonus vs creatures of darkness, +1 min damage die; burn corpses.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "As an action, the Zenith channels 10 motes of Essence. He glows with holy fire and illuminates (Essence×10) yards as noon. For the rest of the scene, he gains additional lethal and bashing soak equal to his Essence against attacks by creatures of darkness, and may add 1 die to the minimum number of dice he rolls for any attack against a creature of darkness (errata: 1 die, not Essence dice).\n\nAdditionally, the Zenith can burn fallen bodies for 1 mote each, sending the soul to Heaven and preventing them from rising as undead.\n\nActivates automatically when the Solar spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerSolarTwilight",
    exaltType:  "solar",
    caste:      "twilight",
    summary:    "Essence sight: +Essence successes on Occult/Awareness for magic, +3 MDV vs Illusions.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending five motes, the Twilight may perceive Essence through her anima for a scene. She adds (Essence) automatic successes to any (Intelligence + Occult) roll to identify a Charm or analyze it with Essence sight, and to any (Perception + Awareness) roll to notice a magical effect or Charm. She also gains +3 to her Dodge MDV against unnatural Illusions.\n\nActivates automatically when the Solar spends 11+ motes of Peripheral Essence.\n\nThis power also applies to the Daybreak and Defiler anima powers."
  },
  {
    nameKey:    "EX2E.AnimaPowerSolarNight",
    exaltType:  "solar",
    caste:      "night",
    summary:    "Mute anima (+1m per Charm, double for Obvious); 10m shroud raises difficulty to notice/track.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "The Night Caste can reflexively add 1 mote to any non-Obvious Charm's cost to prevent that expenditure from adding to her anima banner. For Obvious Charms, she must spend double the normal mote cost to prevent the addition.\n\nBy spending 10 motes, the Night extends a muted veil for a scene: difficulty of all rolls to notice or track her increases by half her Essence (round up).\n\nOnce the Solar spends 11+ motes of Peripheral Essence, her features are completely obscured by her anima display — witnesses know a Solar was present but not her identity. (The Activate button targets the 10m scene-long veil.)"
  },
  {
    nameKey:    "EX2E.AnimaPowerSolarEclipse",
    exaltType:  "solar",
    caste:      "eclipse",
    summary:    "Sanctify oaths (Essence botches for oathbreakers); cross-Exalt Charm learning.",
    activationCost:  { motes: 10, willpower: 1 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending 10 motes and 1 Willpower, the Eclipse sanctifies an oath by touch. Oathbreakers suffer (Essence) botches at critical moments, enforced by Heaven even after the Eclipse's death.\n\nEclipse Caste Solars may also learn Charms of other Exalt types, spirits, and the Fair Folk. Cost: 16 XP per Charm (all prerequisites required — no cherry-picking). Each such Charm costs +2 motes to activate. Foreign Permanent Charms need not commit the 2m surcharge. If a foreign Charm has a Flaw of Invulnerability, the Eclipse must apply a Solar Flaw when activating it.\n\nThe Eclipse and her companions are protected by ancient pacts — spirits, demons, and Fair Folk may not attack them without just cause while on legitimate business.\n\nActivates automatically when the Solar spends 11+ motes of Peripheral Essence."
  },

  // ── Lunar ─────────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerLunarFull",
    exaltType:  "lunar",
    caste:      "full",
    summary:    "Double speed, leaping, and Strength for feats for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending five motes, the Full Moon doubles her speed and leaping distances for a scene and doubles her Strength for feats of strength. This effect stacks additively with other increases (a Lunar who doubles speed twice moves at three times normal, not four).\n\nActivates automatically when the Lunar has 11+ motes of Peripheral Essence active."
  },
  {
    nameKey:    "EX2E.AnimaPowerLunarChanging",
    exaltType:  "lunar",
    caste:      "changing",
    summary:    "Assume any known person's appearance for a scene; add Essence dice to social rolls.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending 10 motes, the Changing Moon appears as any person he knows for a scene, including voice and smell. Add (Essence) dice to social actions that the illusion of trustworthiness assists.\n\nIf his anima banner activates at any level, it pierces the illusion. However, the resulting display of shifting shadows and silver light adds the Lunar's Essence to the difficulty of discerning his identity by sight for anyone who didn't see him before the banner activated.\n\nActivates automatically when the Lunar has 11+ motes of Peripheral Essence active (at which point the shifting light automatically obscures identity)."
  },
  {
    nameKey:    "EX2E.AnimaPowerLunarNo",
    exaltType:  "lunar",
    caste:      "no",
    summary:    "Shadowy penumbra: -1 to attackers in darkness; reduce Occult Charm and spell costs.",
    activationCost:  { motes: 1, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "The No Moon spends 1 to (2×Essence) motes. She gains a shadowy penumbra causing attackers who cannot see through darkness to suffer a -1 external penalty. She may reduce the cost of all Charms requiring an Occult roll by 1 per mote spent (max half cost) and reduce spell costs by the same amount.\n\nThe mote cost stored here (1) is the minimum — the full scaling is described above. At bonfire anima (11+ motes), this power activates automatically at full strength (2×Essence), treating her as having spent twice her permanent Essence for cost reduction purposes. The penumbra protection remains.\n\nActivates automatically when the Lunar has 11+ motes of Peripheral Essence active."
  },

  // ── Terrestrial ───────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerTerrestrialAir",
    exaltType:  "terrestrial",
    caste:      "air",
    summary:    "Wind vortex: triple leap, no fall damage, +Essence DV vs ranged attacks for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description: "By spending five motes, the Air Aspect attunes his anima to the winds for a scene. He is surrounded by a swirling vortex of air. He may triple his leaping distance and takes no damage from falls (gusts slow his descent). He adds his Essence to his DV against Thrown and Archery attacks, as the winds buffet ranged weapons."
  },
  {
    nameKey:    "EX2E.AnimaPowerTerrestrialEarth",
    exaltType:  "terrestrial",
    caste:      "earth",
    summary:    "Skin of stone: soak lethal with Stamina, resist grapples, +Essence Stamina on earth.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description: "By spending five motes, the Earth Aspect attunes her anima to stone for a scene. She may soak all lethal damage with her full Stamina. She adds her Essence to dice rolls to resist grappling attacks or to avoid knockback. While her feet rest on earth or stone, she also adds her Essence to her Stamina for all purposes."
  },
  {
    nameKey:    "EX2E.AnimaPowerTerrestrialFire",
    exaltType:  "terrestrial",
    caste:      "fire",
    summary:    "Corona of flames: attackers take Essence lethal, +Essence damage on attacks, ignite touch.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description: "By spending five motes, the Fire Aspect erupts in a corona of flames for a scene. The flames do not harm her body or possessions. Any bare-handed or grappling attack against her causes the attacker to suffer (Essence) lethal damage dice. Her own bare-handed and grappling attacks deal an additional (Essence) damage dice. She can ignite flammable materials with a touch. She is immune to natural fires while her anima flares."
  },
  {
    nameKey:    "EX2E.AnimaPowerTerrestrialWater",
    exaltType:  "terrestrial",
    caste:      "water",
    summary:    "Water freedom for a full day: breathe water, no underwater penalties, walk on water.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description: "By spending five motes, the Water Aspect suffuses her being with the power of Water for a full day. She can breathe water as easily as air and cannot drown. She suffers no environmental penalty for any actions taken underwater (including firing a bow or throwing). She can walk across the surface of a body of water as easily as dry land."
  },
  {
    nameKey:    "EX2E.AnimaPowerTerrestrialWood",
    exaltType:  "terrestrial",
    caste:      "wood",
    summary:    "Poison immunity; contact poison (Essence tox); +Essence DV vs Archery and wood weapons.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description: "By spending five motes (reflexive, retroactive), the Wood Aspect aligns his Essence with growing things for a scene. He is completely immune to plant-based poisons (even if poisoned before activation).\n\nWhile active, skin-to-skin contact forces the target's player to roll (Stamina + Resistance) against difficulty (Essence) or suffer poisoning: Damage (Essence)/Minute, Toxicity (Essence), Tolerance None, Penalty −(Essence÷2, round up).\n\nHe also adds his Essence to his DV against Archery attacks and attacks using wooden or wood-hafted weapons."
  },

  // ── Sidereal ──────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerSiderealJourneys",
    exaltType:  "sidereal",
    caste:      "journeys",
    summary:    "Triple Move/Dash for self and allies within (Essence×10) yards for a scene.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: true, motes: 5 },
    totemicOverride: { enabled: true, motes: 1 },
    autoThreshold:   "",
    description: "The Chosen of Journeys reflexively makes the Lesser Sign of Mercury for 10 motes. The Chosen's anima billows outward in brilliant yellow. For one scene, the Sidereal and all allies within (Essence×10) yards triple their Move and Dash action distances (affects steeds if their feet touch the ground). Allies must stay within range to benefit.\n\nCost reduction: With anima banner at 11–15 motes, costs only 5 motes. If fully manifest (16+), costs only 1 mote."
  },
  {
    nameKey:    "EX2E.AnimaPowerSiderealSerenity",
    exaltType:  "sidereal",
    caste:      "serenity",
    summary:    "Self and allies in range add Essence successes to all Performance rolls for a scene.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: true, motes: 5 },
    totemicOverride: { enabled: true, motes: 1 },
    autoThreshold:   "",
    description: "The Chosen of Serenity reflexively makes the Lesser Sign of Venus for 10 motes. The Chosen's anima billows outward in brilliant blue. For one scene, the Sidereal and all allies within (Essence×10) yards add (Essence) successes to all Performance rolls. Allies must remain within range to benefit.\n\nCost reduction: With anima banner at 11–15 motes, costs only 5 motes. If fully manifest (16+), costs only 1 mote."
  },
  {
    nameKey:    "EX2E.AnimaPowerSiderealBattles",
    exaltType:  "sidereal",
    caste:      "battles",
    summary:    "Self and allies in range add Essence to bashing and lethal soak for a scene.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: true, motes: 5 },
    totemicOverride: { enabled: true, motes: 1 },
    autoThreshold:   "",
    description: "The Chosen of Battles reflexively makes the Lesser Sign of Mars for 10 motes. The Chosen's anima billows outward in brilliant scarlet. For one scene, the Sidereal and all allies within (Essence×10) yards add (Essence) to their bashing and lethal soak (errata: adds to soak, not damage reduction in Step 10). Allies must remain within range to benefit.\n\nCost reduction: With anima banner at 11–15 motes, costs only 5 motes. If fully manifest (16+), costs only 1 mote."
  },
  {
    nameKey:    "EX2E.AnimaPowerSiderealSecrets",
    exaltType:  "sidereal",
    caste:      "secrets",
    summary:    "Immune to mental attacks (Essence < yours) and +Essence MDV for self and allies in range.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: true, motes: 5 },
    totemicOverride: { enabled: true, motes: 1 },
    autoThreshold:   "",
    description: "The Chosen of Secrets reflexively makes the Lesser Sign of Jupiter for 10 motes. The Chosen's anima billows outward in brilliant green. For one scene, the Sidereal and all allies within (Essence×10) yards are immune to mind-reading and mental attacks from opponents with Essence less than the Sidereal's. Against other opponents, they add (Essence) to their Mental Defense Values. Allies must remain within range.\n\nCost reduction: With anima banner at 11–15 motes, costs only 5 motes. If fully manifest (16+), costs only 1 mote."
  },
  {
    nameKey:    "EX2E.AnimaPowerSiderealEndings",
    exaltType:  "sidereal",
    caste:      "endings",
    summary:    "Self and allies in range add Essence to raw damage of all attacks for a scene.",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: true, motes: 5 },
    totemicOverride: { enabled: true, motes: 1 },
    autoThreshold:   "",
    description: "The Chosen of Endings reflexively makes the Lesser Sign of Saturn for 10 motes. The Chosen's anima billows outward in brilliant violet. For one scene, the Sidereal and all allies within (Essence×10) yards add (Essence) to the raw damage of all attacks they make (errata: adds to raw damage, not a level of damage in Step 10). Allies must remain within range.\n\nCost reduction: With anima banner at 11–15 motes, costs only 5 motes. If fully manifest (16+), costs only 1 mote."
  },

  // ── Sidereal Greater Signs ─────────────────────────────────────────────────
  {
    nameKey:         "EX2E.AnimaPowerGreaterSignMercury",
    exaltType:       "sidereal",
    caste:           "journeys",
    summary:         "Greater Sign of Mercury — Essence 4+, 15 Journeys college dots required.",
    isGreaterSign:   true,
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description:     ""
  },
  {
    nameKey:         "EX2E.AnimaPowerGreaterSignVenus",
    exaltType:       "sidereal",
    caste:           "serenity",
    summary:         "Greater Sign of Venus — Essence 4+, 15 Serenity college dots required.",
    isGreaterSign:   true,
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description:     ""
  },
  {
    nameKey:         "EX2E.AnimaPowerGreaterSignMars",
    exaltType:       "sidereal",
    caste:           "battles",
    summary:         "Greater Sign of Mars — Essence 4+, 15 Battles college dots required.",
    isGreaterSign:   true,
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description:     ""
  },
  {
    nameKey:         "EX2E.AnimaPowerGreaterSignJupiter",
    exaltType:       "sidereal",
    caste:           "secrets",
    summary:         "Greater Sign of Jupiter — Essence 4+, 15 Secrets college dots required.",
    isGreaterSign:   true,
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description:     ""
  },
  {
    nameKey:         "EX2E.AnimaPowerGreaterSignSaturn",
    exaltType:       "sidereal",
    caste:           "endings",
    summary:         "Greater Sign of Saturn — Essence 4+, 15 Endings college dots required.",
    isGreaterSign:   true,
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "",
    description:     ""
  },

  // ── Abyssal ───────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerAbyssalDusk",
    exaltType:  "abyssal",
    caste:      "dawn", // stored key matches EX2E.castes.abyssal; label is "Dusk"
    summary:    "Fear aura: -1 to attackers, +2 DV, disrupts coordinated attacks for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Same as Solar Dawn (errata). By spending five motes, the Dusk appears glorious and terrifying until end of scene. All opponents suffer a -1 external penalty on attack rolls (Unnatural Emotion, 5wp to ignore for a scene). Difficulty to coordinate attacks against her increases by 2. DVs increase by 2. She is immune to fear-based Emotion effects while active. Complementary mass combat units checking for rout due to her actions suffer -2 external penalty.\n\nActivates automatically when the Abyssal spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerAbyssalMidnight",
    exaltType:  "abyssal",
    caste:      "zenith", // stored key matches EX2E.castes.abyssal; label is "Midnight"
    summary:    "Reanimate corpses by touch; smite mortals/animals/ghosts for Essence aggravated damage.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "The Midnight Caste can reanimate a corpse by touch, spending 5 motes. This is a (Speed 5, DV -0) diceless miscellaneous action. The corpse rises as a zombie extra under the Abyssal's control, suffering 1 level of aggravated damage per day until it disintegrates.\n\nThe Midnight can also smite a mortal, natural animal, or ghost as an unblockable, undodgeable (Speed 3, DV -1) attack inflicting (Essence) levels of aggravated damage. If the target is protected by a Defend Other action, the Midnight must smite the guardian first (if a valid target).\n\nActivates automatically when the Abyssal spends 11–15 motes: power becomes reflexive with 10-yard range, once per action for free."
  },
  {
    nameKey:    "EX2E.AnimaPowerAbyssalDaybreak",
    exaltType:  "abyssal",
    caste:      "twilight", // stored key matches EX2E.castes.abyssal; label is "Daybreak"
    summary:    "Essence sight: +Essence successes on Occult/Awareness for magic, +3 MDV vs Illusions.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Same as Solar Twilight (errata). By spending five motes, the Daybreak perceives Essence through her anima for a scene. She adds (Essence) automatic successes to (Intelligence + Occult) rolls to identify or analyze Charms with Essence sight, and to (Perception + Awareness) rolls to notice magical effects or Charms. She also gains +3 to her Dodge MDV against unnatural Illusions.\n\nActivates automatically when the Abyssal spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerAbyssalDay",
    exaltType:  "abyssal",
    caste:      "night", // stored key matches EX2E.castes.abyssal; label is "Day"
    summary:    "Mute anima; 10m ghostly shroud raises difficulty to notice/track by (Essence÷2).",
    activationCost:  { motes: 10, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Like Night Caste counterparts, Day Caste can reflexively spend an extra mote to prevent any Peripheral Essence spent on a non-Obvious Charm from adding to their anima banners. Hiding an Obvious Charm doubles its mote cost instead.\n\nBy spending 10 motes, the Day shrouds himself in ghostly concealment for a scene. Other characters suffer an internal penalty equal to half the deathknight's Essence rating (round down) to notice or track the shrouded character. While displaying an anima banner at 11+ motes, specific identifying features become indiscernible.\n\n(The Activate button targets the 10m scene-long shroud.)"
  },
  {
    nameKey:    "EX2E.AnimaPowerAbyssalMoonshadow",
    exaltType:  "abyssal",
    caste:      "eclipse", // stored key matches EX2E.castes.abyssal; label is "Moonshadow"
    summary:    "Sanctify oaths with Neverborn (Essence botches); cross-Exalt Charm learning.",
    activationCost:  { motes: 10, willpower: 1 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending 10 motes and 1 Willpower, the Moonshadow calls the Neverborn to witness an oath. Oathbreakers suffer (Essence) botches at critical moments as chosen by the Storyteller.\n\nMoonshadows may also learn non-Abyssal Charms. Cost: 16 XP per Charm (all prerequisites required; same rules as Solar Eclipse errata). Such Charms cost +2 motes to use. When learning a foreign Charm with a Flaw of Invulnerability, the Moonshadow must apply an appropriate Flaw.\n\nMoonshadows who display their caste mark and invoke Oblivion's protection are protected from creatures of death — they will not attack unless supernaturally compelled (Deathlords and other Abyssals are exempt).\n\nActivates automatically when the Abyssal spends 11+ motes of Peripheral Essence."
  },

  // ── Infernal ──────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerInfernalSlayer",
    exaltType:  "infernal",
    caste:      "slayer",
    summary:    "Fear aura: -1 to attackers, +2 DV, disrupts coordinated attacks for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Same as Solar Dawn (errata). By spending five motes, the Slayer appears glorious and terrifying until end of scene. All opponents suffer a -1 external penalty on attack rolls (Unnatural Emotion, 5wp to ignore for a scene). Difficulty to coordinate attacks against her increases by 2. DVs increase by 2. She is immune to fear-based Emotion effects while active. Complementary mass combat units checking for rout due to her actions suffer -2 external penalty.\n\nActivates automatically when the Infernal spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerInfernalMalefactor",
    exaltType:  "infernal",
    caste:      "malefactor",
    summary:    "+1 Appearance, auto-success vs demons/lower Essence on social attacks, demon binding.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending five motes (errata), the Malefactor channels her anima through sweet words for a scene. She gains +1 Appearance and adds one automatic success on all social attacks against demons or characters of lower Essence. She also adds one automatic success to any roll to sorcerously bind a demon.\n\nActivates automatically when the Infernal spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerInfernalDefiler",
    exaltType:  "infernal",
    caste:      "defiler",
    summary:    "Essence sight: +Essence successes on Occult/Awareness for magic, +3 MDV vs Illusions.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Same as Solar Twilight (errata). By spending five motes, the Defiler perceives Essence through her anima for a scene. She adds (Essence) automatic successes to (Intelligence + Occult) rolls to identify or analyze Charms, and to (Perception + Awareness) rolls to notice magical effects. She also gains +3 to her Dodge MDV against unnatural Illusions.\n\nActivates automatically when the Infernal spends 11+ motes of Peripheral Essence."
  },
  {
    nameKey:    "EX2E.AnimaPowerInfernalScourge",
    exaltType:  "infernal",
    caste:      "scourge",
    summary:    "Mute anima; 5m render self silent (Essence auto-successes to Stealth); 10m silence zone.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "Like Night Caste counterparts, Scourges can reflexively spend +1 mote to prevent non-Obvious Charm expenditures from adding to anima banners. Obvious Charms require double cost.\n\nBy spending 5 motes, the Scourge renders himself utterly silent for up to a scene (he can speak deliberately but otherwise makes no sound). While active, he adds (Essence) automatic successes to all Stealth rolls where silence plays a part.\n\nBy spending 10 motes, he creates a (Essence)-yard zone of perfect silence around him for a scene. No one within can make mundane sounds without his will. This does not interfere with Charms, sorcery, or other supernatural auditory effects.\n\n(The Activate button targets the 5m self-silence effect.)"
  },
  {
    nameKey:    "EX2E.AnimaPowerInfernalFiend",
    exaltType:  "infernal",
    caste:      "fiend",
    summary:    "Sanctify oaths (same as Eclipse); nullify Eclipse/Moonshadow oaths (5m commit); cross-Exalt Charms.",
    activationCost:  { motes: 10, willpower: 1 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "The Fiend can sanctify oaths identically to the Eclipse (same mechanical effects; see Solar Eclipse errata).\n\nBy committing 5 motes to a person who has sworn an Eclipse or Moonshadow oath, the Fiend frees the oath-swearer from oath penalties while the Essence remains committed. Violations during this window have no effect; re-violations after the Essence is withdrawn suffer the normal curse. This also works against oaths to deities or Fair Folk of lower Essence than the Fiend.\n\nFiends may learn non-Infernal Charms (16 XP, +2m to use; same Eclipse prerequisites rules). They cannot use Holy Charms (holy Charms learned as prerequisites auto-fail when activated). Diplomatic immunity in the Yozi realm and Underworld.\n\nActivates automatically when the Infernal spends 11+ motes of Peripheral Essence."
  },

  // ── Alchemical ────────────────────────────────────────────────────────────
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalOrichalcum",
    exaltType:  "alchemical",
    caste:      "orichalcum",
    summary:    "Add Essence to raw damage of all attacks for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By reflexively spending five motes, the Shining One charges her body with golden lightning for a scene. This energy surges at every point of contact. It adds the character's Essence to the raw damage of all attacks (melee and ranged).\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  },
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalMoonsilver",
    exaltType:  "alchemical",
    caste:      "moonsilver",
    summary:    "Reduce Speed of all actions (Speed > 3) by 1, to minimum 3, for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By reflexively spending five motes, the Moonsilver Alchemical suffuses her being with quicksilver grace for a scene. Her quickened senses perceive the world in slow motion. This power reduces by one (to a minimum Speed of 3) the Speed of all of her actions that have a Speed greater than 3.\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  },
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalJade",
    exaltType:  "alchemical",
    caste:      "jade",
    summary:    "Add Essence to natural bashing and lethal soak for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By reflexively spending five motes, the Jade Alchemical fortifies her flesh for a scene. Skin and features harden as Essence passes through, transmuting her flesh into flexible stone. This power adds her Essence to her natural bashing and lethal soak.\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  },
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalStarmetal",
    exaltType:  "alchemical",
    caste:      "starmetal",
    summary:    "Add (Essence÷2) to all attack, damage, and Join Battle rolls for a scene.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By reflexively spending five motes, the Starmetal Alchemical aligns his soul with the Design of the Great Maker for a scene. His player adds (Essence ÷ 2, round down) to all attack, damage, and Join Battle rolls. A prismatic halo trails slightly ahead of the Alchemical as a sort of reverse afterimage, highlighting auspicious movements.\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  },
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalSoulsteel",
    exaltType:  "alchemical",
    caste:      "soulsteel",
    summary:    "External -(Essence÷2) penalty on all incoming attacks; (Essence) Willpower to resist.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By reflexively spending five motes, the Soulsteel Alchemical stirs the souls trapped in his frame for a scene. Outlines and faint imprints of distended faces and hands appear in every surface, their moans and whispers escaping in a hushed cacophony. This dread display imposes an external penalty of (Essence ÷ 2, round down) on all attacks targeting the Alchemical. This is a natural mental influence costing (Essence) Willpower to resist for a scene; it explicitly affects automata normally incapable of fear.\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  },
  {
    nameKey:    "EX2E.AnimaPowerAlchemicalAdamanant",
    exaltType:  "alchemical",
    caste:      "adamant",
    summary:    "Witnesses must spend Essence (max 5) WP or memories distort to obscure your identity.",
    activationCost:  { motes: 5, willpower: 0 },
    bonfireOverride: { enabled: false, motes: 0 },
    totemicOverride: { enabled: false, motes: 0 },
    autoThreshold:   "bonfire",
    description: "By spending five motes, the Adamant Alchemical emits a radiance for the rest of the scene. Any witness leaving the Operative's presence must spend (Essence rating, max 5) Willpower to resist an unnatural Illusion. Paying this cost lets them remember the interaction correctly; otherwise their memories distort to conceal the Operative's identity and caste (blackout, misidentification as a different Alchemical, etc.).\n\nThis power does not cloak older memories. Operatives themselves, Autochthon, and his Divine Ministers are immune. Lesser subgods are immune only if their function involves interaction with the Adamant Caste.\n\nActivates automatically at no cost whenever the Alchemical's anima reaches the 11+ level of display."
  }
];

async function _ensureAnimaPowerFolders(pack) {
  const exaltTypes = [...new Set(ANIMA_POWER_SEEDS.map(s => s.exaltType))];
  const folderMap  = {};
  for (const exaltType of exaltTypes) {
    const label    = game.i18n.localize(game.exalted2e.EX2E.splatTypes[exaltType] ?? exaltType);
    const existing = pack.folders.find(f => f.name === label);
    if (existing) {
      folderMap[exaltType] = existing.id;
    } else {
      const folder = await Folder.create(
        { name: label, type: "Item", sorting: "a" },
        { pack: pack.collection }
      );
      folderMap[exaltType] = folder.id;
    }
  }
  return folderMap;
}

export async function _seedAnimaPowersCompendium() {
  const pack = game.packs.get("exalted2e.animapowers");
  if (!pack) return;

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  try {
    const folderMap = await _ensureAnimaPowerFolders(pack);

    const existing     = await pack.getIndex({ fields: ["name"] });
    const existingNames = new Set(existing.map(e => e.name));
    const todo          = ANIMA_POWER_SEEDS.filter(s => !existingNames.has(game.i18n.localize(s.nameKey)));

    for (const seed of todo) {
      await Item.create({
        name:   game.i18n.localize(seed.nameKey),
        type:   "animapower",
        folder: folderMap[seed.exaltType] ?? null,
        img:    "icons/magic/light/beam-rays-orange.webp",
        flags:  { exalted2e: { animaPower: true } },
        system: {
          exaltType:       seed.exaltType,
          caste:           seed.caste,
          summary:         seed.summary,
          active:          false,
          activationCost:  seed.activationCost,
          bonfireOverride: seed.bonfireOverride,
          totemicOverride: seed.totemicOverride,
          autoThreshold:   seed.autoThreshold,
          isGreaterSign:   seed.isGreaterSign ?? false,
          description:     seed.description
        }
      }, { pack: "exalted2e.animapowers" });
    }
    if (todo.length > 0) {
      console.log(`Exalted 2e | Seeded ${todo.length} anima power(s) into the animapowers compendium.`);
    }

    // Move any existing unfoldered items to their correct folder
    const docs = await pack.getDocuments();
    const toMove = docs.filter(d => !d.folder && folderMap[d.system.exaltType]);
    for (const doc of toMove) {
      await doc.update({ folder: folderMap[doc.system.exaltType] });
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}
