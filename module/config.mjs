/**
 * Configuration constants for Exalted Second Edition
 */
export const EX2E = {};

EX2E.attributes = {
  physical: {
    strength:     "EX2E.AttrStrength",
    dexterity:    "EX2E.AttrDexterity",
    stamina:      "EX2E.AttrStamina"
  },
  social: {
    charisma:     "EX2E.AttrCharisma",
    manipulation: "EX2E.AttrManipulation",
    appearance:   "EX2E.AttrAppearance"
  },
  mental: {
    perception:   "EX2E.AttrPerception",
    intelligence: "EX2E.AttrIntelligence",
    wits:         "EX2E.AttrWits"
  }
};

// Flat list of attribute keys for iteration. Mirrors the shape of
// `EX2E.abilities` but for attributes.
EX2E.attributeKeys = [
  "strength", "dexterity", "stamina",
  "charisma", "manipulation", "appearance",
  "perception", "intelligence", "wits"
];

EX2E.abilities = [
  "archery", "athletics", "awareness", "bureaucracy",
  "craft", "dodge", "integrity", "investigation", "larceny",
  "linguistics", "lore", "martialArts", "medicine", "melee",
  "occult", "performance", "presence", "resistance", "ride",
  "sail", "socialize", "stealth", "survival", "thrown", "war"
];

EX2E.abilityLabels = {
  archery:       "EX2E.AbilityArchery",
  athletics:     "EX2E.AbilityAthletics",
  awareness:     "EX2E.AbilityAwareness",
  bureaucracy:   "EX2E.AbilityBureaucracy",
  craft:         "EX2E.AbilityCraft",
  dodge:         "EX2E.AbilityDodge",
  integrity:     "EX2E.AbilityIntegrity",
  investigation: "EX2E.AbilityInvestigation",
  larceny:       "EX2E.AbilityLarceny",
  linguistics:   "EX2E.AbilityLinguistics",
  lore:          "EX2E.AbilityLore",
  martialArts:   "EX2E.AbilityMartialArts",
  martialarts:   "EX2E.AbilityMartialArts",
  medicine:      "EX2E.AbilityMedicine",
  melee:         "EX2E.AbilityMelee",
  occult:        "EX2E.AbilityOccult",
  performance:   "EX2E.AbilityPerformance",
  presence:      "EX2E.AbilityPresence",
  resistance:    "EX2E.AbilityResistance",
  ride:          "EX2E.AbilityRide",
  sail:          "EX2E.AbilitySail",
  socialize:     "EX2E.AbilitySocialize",
  stealth:       "EX2E.AbilityStealth",
  survival:      "EX2E.AbilitySurvival",
  thrown:        "EX2E.AbilityThrown",
  war:           "EX2E.AbilityWar"
};

EX2E.virtues = {
  compassion: "EX2E.VirtueCompassion",
  conviction: "EX2E.VirtueConviction",
  temperance: "EX2E.VirtueTemperance",
  valor:      "EX2E.VirtueValor"
};

EX2E.splatTypes = {
  solar:        "EX2E.ExaltSolar",
  lunar:        "EX2E.ExaltLunar",
  terrestrial:  "EX2E.ExaltTerrestrial",
  sidereal:     "EX2E.ExaltSidereal",
  abyssal:      "EX2E.ExaltAbyssal",
  infernal:     "EX2E.ExaltInfernal",
  alchemical:   "EX2E.ExaltAlchemical",
  mortal:       "EX2E.ExaltMortal",
  spirit:       "EX2E.ExaltSpirit",
  martialarts:  "EX2E.ExaltMartialArts",
};

EX2E.castes = {
  solar:       { dawn: "EX2E.CasteDawn", zenith: "EX2E.CasteZenith", twilight: "EX2E.CasteTwilight", night: "EX2E.CasteNight", eclipse: "EX2E.CasteEclipse" },
  lunar:       { full: "EX2E.CasteFullMoon", changing: "EX2E.CasteChangingMoon", no: "EX2E.CasteNoMoon", casteless: "EX2E.CasteCasteless" },
  terrestrial: { air: "EX2E.CasteAir", earth: "EX2E.CasteEarth", fire: "EX2E.CasteFire", water: "EX2E.CasteWater", wood: "EX2E.CasteWood" },
  sidereal:    { journeys: "EX2E.CasteJourneys", serenity: "EX2E.CasteSerenity", battles: "EX2E.CasteBattles", secrets: "EX2E.CasteSecrets", endings: "EX2E.CasteEndings" },
  abyssal:     { dawn: "EX2E.CasteDeathknight_Dusk", zenith: "EX2E.CasteDeathknight_Midnight", twilight: "EX2E.CasteDeathknight_Daybreak", night: "EX2E.CasteDeathknight_Day", eclipse: "EX2E.CasteDeathknight_Moonshadow" },
  infernal:    { slayer: "EX2E.CasteSlayer", scourge: "EX2E.CasteScourge", defiler: "EX2E.CasteDefiler", malefactor: "EX2E.CasteMalefactor", fiend: "EX2E.CasteFiend" },
  alchemical:  { orichalcum: "EX2E.CasteOrichalcum", moonsilver: "EX2E.CasteMoonsilver", starmetal: "EX2E.CasteStarmetal", soulsteel: "EX2E.CasteSoulsteel", jade: "EX2E.CasteJade", adamant: "EX2E.CasteAdamant" },
  mortal:      {}
};

EX2E.yoziPatrons = {
  malfeas:              "EX2E.YoziMalfeas",
  cecelyne:             "EX2E.YoziCecelyne",
  sheWhoLivesInHerName: "EX2E.YoziSheWhoLives",
  adorjan:              "EX2E.YoziAdorjan",
  ebonDragon:           "EX2E.YoziEbonDragon",
  kimbery:              "EX2E.YoziKimbery"
};

EX2E.infernalCastePatron = {
  slayer:     "malfeas",
  malefactor: "cecelyne",
  defiler:    "sheWhoLivesInHerName",
  scourge:    "adorjan",
  fiend:      "ebonDragon"
};

// Per-splat static flags consumed by CharacterSheet._prepareContext to
// replace inline exaltType switches. Add a new entry here when a new
// splat type is introduced; the sheet reads beh = splatBehaviors[exaltType].
EX2E.splatBehaviors = {
  //                     showCharms  showAstrology  limitLabelKey                      sorceryLabelKey                  charmGroupBy  fourColumnAbilities  attributeCasteUI  showDbFlux  animaLiminalAtDim  isLunar
  solar:       { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",    charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  abyssal:     { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.LimitVariantResonance", sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  infernal:    { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.LimitVariantTorment",  sorceryLabelKey: "EX2E.TraditionSorcery",    charmGroupBy: "yozi",    fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  terrestrial: { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: true,  animaLiminalAtDim: true,  isLunar: false },
  sidereal:    { showCharms: true,  showAstrology: true,  limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  lunar:       { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: true,  attributeCasteUI: true,  showDbFlux: false, animaLiminalAtDim: false, isLunar: true  },
  alchemical:  { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.LimitVariantClarity",  sorceryLabelKey: "EX2E.TraditionProcedures", charmGroupBy: "ability", fourColumnAbilities: true,  attributeCasteUI: true,  showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  mortal:      { showCharms: false, showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  spirit:      { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
  martialarts: { showCharms: true,  showAstrology: false, limitLabelKey: "EX2E.Limit",                sorceryLabelKey: "EX2E.TraditionSorcery",   charmGroupBy: "ability", fourColumnAbilities: false, attributeCasteUI: false, showDbFlux: false, animaLiminalAtDim: false, isLunar: false },
};

// Splats that use the classic Limit mechanic. Resisting unnatural mental
// influence with Willpower ticks the Limit counter (capped at once per
// scene per attacker) for these splats only. Abyssal (Resonance),
// Infernal (Torment), Alchemical (Clarity), and Mortal use different
// (or no) anti-virtue accumulation rules and are excluded.
EX2E.LIMIT_ACCRUAL_SPLATS = ["solar", "lunar", "terrestrial", "sidereal"];

EX2E.charmTypes = {
  supplemental: "EX2E.CharmSupplemental",
  reflexive:    "EX2E.CharmReflexive",
  simple:       "EX2E.CharmSimple",
  extraAction:  "EX2E.CharmExtraAction",
  permanent:    "EX2E.CharmPermanent"
};

EX2E.durations = {
  instant:          "EX2E.DurationInstant",
  untilNextAction:  "EX2E.DurationUntilNextAction",
  oneAction:        "EX2E.DurationOneAction",
  twoActions:       "EX2E.DurationTwoActions",
  threeActions:     "EX2E.DurationThreeActions",
  oneScene:         "EX2E.DurationOneScene",
  oneDay:           "EX2E.DurationOneDay",
  oneWeek:          "EX2E.DurationOneWeek",
  oneMonth:         "EX2E.DurationOneMonth",
  oneSeason:        "EX2E.DurationOneSeason",
  indefinite:       "EX2E.DurationIndefinite",
  untilCalibration: "EX2E.DurationUntilCalibration",
  formula:          "EX2E.DurationFormula",
  permanent:        "EX2E.DurationPermanent"
};

EX2E.moteTypes = {
  personal:   "EX2E.MotesPersonal",
  peripheral: "EX2E.MotesPeripheral"
};

EX2E.stuntBonuses = {
  0: "EX2E.NoStunt",
  1: "EX2E.Stunt1",
  2: "EX2E.Stunt2",
  3: "EX2E.Stunt3"
};

EX2E.magicalMaterials = {
  orichalcum: "EX2E.MatOrichalcum",
  moonsilver:  "EX2E.MatMoonsilver",
  starmetal:   "EX2E.MatStarmetal",
  soulsteel:   "EX2E.MatSoulsteel",
  jade:        "EX2E.MatJade",
  adamant:     "EX2E.MatAdamant"
};

// Weapon stat bonuses applied when attuned to an artifact of that material.
// speed is a negative offset (lower = faster). All values added to base stats.
EX2E.meleeMagicalMaterialBonuses = {
  orichalcum:  { speed:  0, accuracy:  1, damage: 0, defense: 1, rate:  1 },
  moonsilver:  { speed:  0, accuracy:  2, damage: 0, defense: 2, rate:  0 },
  starmetal:   { speed:  0, accuracy:  1, damage: 3, defense: 0, rate:  0 },
  soulsteel:   { speed:  0, accuracy:  2, damage: 0, defense: 0, rate:  0 },
  jade:        { speed: -1, accuracy:  0, damage: 1, defense: 0, rate:  0 },
  adamant:     { speed:  0, accuracy:  0, damage: 0, defense: 0, rate:  0 }
};

EX2E.errataMeleeMagicalMaterialBonuses = {
  orichalcum:  { speed:  0, accuracy:  2, damage: 0, defense: 1, rate:  1 }  
};

EX2E.rangedMagicalMaterialBonuses = {
  orichalcum:  { speed:  0, accuracy:  1, damage: 1, defense: 0, rate:  0, range: 50, thrownRange: 10 },
  moonsilver:  { speed:  0, accuracy:  1, damage: 0, defense: 0, rate:  0, range: 100, thrownRange: 20 },
  starmetal:   { speed:  0, accuracy:  1, damage: 2, defense: 0, rate:  0 },
  soulsteel:   { speed:  0, accuracy:  2, damage: 2, defense: 0, rate:  0 },
  jade:        { speed: -1, accuracy:  0, damage: 0, defense: 0, rate:  0, range: 50, thrownRange: 10 },
  adamant:     { speed:  0, accuracy:  0, damage: 0, defense: 0, rate:  0 }
};

// Armor stat bonuses applied when attuned to an artifact of that material.
// mobilityPenalty/fatiguePenalty are positive values that REDUCE the (negative) base penalty.
// attackPenalty in Starmetal reduces the enemy's attack pool by that value
EX2E.magicalMaterialArmorBonuses = {
  orichalcum: { soak: { bashing: 2, lethal: 2, aggravated: 0 }, hardness: 1, mobilityPenalty: 0, fatiguePenalty: 0, attackPenalty: 0 },
  moonsilver: { soak: { bashing: 0, lethal: 0, aggravated: 0 }, hardness: 0, mobilityPenalty: 2, fatiguePenalty: 0, attackPenalty: 0 },
  starmetal:  { soak: { bashing: 0, lethal: 0, aggravated: 0 }, hardness: 1, mobilityPenalty: 0, fatiguePenalty: 0, attackPenalty: 1 },
  soulsteel:  { soak: { bashing: 2, lethal: 2, aggravated: 0 }, hardness: 2, mobilityPenalty: 0, fatiguePenalty: 0, attackPenalty: 0 },
  jade:       { soak: { bashing: 0, lethal: 0, aggravated: 0 }, hardness: 0, mobilityPenalty: 0, fatiguePenalty: 2, attackPenalty: 0 },
  adamant:    { soak: { bashing: 0, lethal: 3, aggravated: 0 }, hardness: 0, mobilityPenalty: 1, fatiguePenalty: 0, attackPenalty: 0 }
};

EX2E.errataMagicalMaterialArmorBonuses = {
  starmetal:  { soak: { bashing: 0, lethal: 0, aggravated: 0 }, hardness: 1, mobilityPenalty: 0, fatiguePenalty: 0, attackPenalty: 0, minDamageReduction: 1 },
  jade:       { soak: { bashing: 0, lethal: 0, aggravated: 0 }, hardness: 0, mobilityPenalty: 0, fatiguePenalty: 2, attackPenalty: 0 },
}

EX2E.weaponTags = [
  "Bow", "Clinch", "Disarming", "Flame type", "Lance type", "Martial Arts",
  "Natural", "Overwhelming", "Piercing", "Reach", "Single Shot", "Thrown", "Two-handed"
];

EX2E.armorTags = [
  "Concealable"
];

EX2E.hearthstoneTypes = {
  air:      "EX2E.HearthstoneTypeAir",
  earth:    "EX2E.HearthstoneTypeEarth",
  fire:     "EX2E.HearthstoneTypeFire",
  water:    "EX2E.HearthstoneTypeWater",
  wood:     "EX2E.HearthstoneTypeWood",
  solar:    "EX2E.HearthstoneTypeSolar",
  lunar:    "EX2E.HearthstoneTypeLunar",
  sidereal: "EX2E.HearthstoneTypeSidereal",
  abyssal:  "EX2E.HearthstoneTypeAbyssal",
  infernal: "EX2E.HearthstoneTypeInfernal"
};

// ── Charm Keywords ──────────────────────────────────────────────────────
// Predefined list for autocomplete / dropdown suggestions on Charm sheets.
// Alphabetised and deduped — source categories preserved in comments below
// for reference (Avatar is Abyssal, Axiomatic is Alchemical, etc.).
EX2E.charmKeywords = [
  "Action-Only", "Avatar", "Axiomatic",
  "Blasphemy",
  "Combo-Basic", "Combo-OK", "Combo-Permanent", "Compulsion", "Cooperative",
  "Counterattack", "Crippling",
  "Dawn", "Desecration",
  "Elemental", "Emotion", "Enhanced", "Exemplar", 
  "Fate", "Form-Enhancing", "Form-type", "Fury-OK",
  "Gift",
  "Heretical", "Holy",
  "Illusion", "Internal",
  "Knockback",
  "Maiden", "Martial", "Martial-ready", "Merged", "Messianic", "Mirror", "Monstrous",
  "Mount (Mundane)", "Mount (any)",
  "Native",
  "Obvious", "Overdrive",
  "Perfect Mental Defense", "Poison", "Prayer Strip",
  "Rage", "Reactor",
  "Resist Unnatural Mental Influence",
  "Servitude", "Shaping", "Sickness", "Social", "Sorcerous", "Spectral", "Stackable",
  "Taint", "Touch", "Training",
  "Unblockable", "Unbreakable", "Undodgeable", 
  "Variable", "Velocity", "Virtue",
  "War", "Wyld"
];

EX2E.ANIMA_THRESHOLDS = { dim: 1, glowing: 4, burning: 8, bonfire: 11, totemic: 16 };

EX2E.DB_FLUX = {
  burning: { interval: 60, soakExempt: true  },
  bonfire: { interval:  9, soakExempt: true  },
  totemic: { interval:  1, soakExempt: false }
};

EX2E.anima = {
  none:    "EX2E.AnimaNone",
  dim:     "EX2E.AnimaDim",
  glowing: "EX2E.AnimaGlowing",
  burning: "EX2E.AnimaBurning",
  bonfire: "EX2E.AnimaBonfire",
  totemic: "EX2E.AnimaTotemic"
};

// ── Anima Color Palettes ──────────────────────────────────────────────────
// Each exalt type maps to { base?: ColorEntry[], castes?: { [caste]: ColorEntry[] } }.
// ColorEntry = { key: string, label: string (i18n key), hex: string }
// getAnimaPalette() merges base + the actor's caste entries.

EX2E.animaColors = {
  solar: {
    base: [
      { key: "solarWhite",  label: "EX2E.AnimaColorSolarWhite",  hex: "#FFFFFF" },
      { key: "solarGold",   label: "EX2E.AnimaColorSolarGold",   hex: "#FFD700" }
    ],
    castes: {
      dawn: [
        { key: "dawnPaleGold",    label: "EX2E.AnimaColorDawnPaleGold",    hex: "#E8C880" },
        { key: "dawnCrimson",     label: "EX2E.AnimaColorDawnCrimson",     hex: "#C83020" },
        { key: "dawnLightViolet", label: "EX2E.AnimaColorDawnLightViolet", hex: "#B090C0" }
      ],
      zenith: [
        { key: "zenithBurningWhite", label: "EX2E.AnimaColorZenithBurningWhite", hex: "#FFF8F0" },
        { key: "zenithMajesticGold", label: "EX2E.AnimaColorZenithMajesticGold", hex: "#FFC200" }
      ],
      twilight: [
        { key: "twilightBrightRed", label: "EX2E.AnimaColorTwilightBrightRed", hex: "#CC2020" },
        { key: "twilightDarkRed",   label: "EX2E.AnimaColorTwilightDarkRed",   hex: "#880000" },
        { key: "twilightPurple",    label: "EX2E.AnimaColorTwilightPurple",    hex: "#8040A0" },
        { key: "twilightBlue",      label: "EX2E.AnimaColorTwilightBlue",      hex: "#4060C0" }
      ],
      night: [
        { key: "nightGhostlyWhite", label: "EX2E.AnimaColorNightGhostlyWhite", hex: "#E8E8F4" },
        { key: "nightPurple",       label: "EX2E.AnimaColorNightPurple",       hex: "#7040A0" },
        { key: "nightPurpleGray",   label: "EX2E.AnimaColorNightPurpleGray",   hex: "#907890" }
      ],
      eclipse: [
        { key: "eclipseCoronaWhite", label: "EX2E.AnimaColorEclipseCoronaWhite", hex: "#F8F8FF" },
        { key: "eclipseCoronaGold",  label: "EX2E.AnimaColorEclipseCoronaGold",  hex: "#FFF0C0" }
      ]
    }
  },
  lunar: {
    base: [
      { key: "lunarSilver",        label: "EX2E.AnimaColorLunarSilver",        hex: "#C0C0C0" },
      { key: "lunarMoonlightWhite", label: "EX2E.AnimaColorLunarMoonlightWhite", hex: "#F0F0F8" }
    ],
    castes: {
      fullMoon: [
        { key: "fullMoonSoftWhite",    label: "EX2E.AnimaColorFullMoonSoftWhite",    hex: "#E8E8F8" },
        { key: "fullMoonBrightSilver", label: "EX2E.AnimaColorFullMoonBrightSilver", hex: "#D0D0E0" }
      ],
      changingMoon: [
        { key: "changingMoonDarkBlue", label: "EX2E.AnimaColorChangingMoonDarkBlue", hex: "#204080" },
        { key: "changingMoonPurple",   label: "EX2E.AnimaColorChangingMoonPurple",   hex: "#602090" }
      ],
      noMoon: [
        { key: "noMoonDeepBlue",   label: "EX2E.AnimaColorNoMoonDeepBlue",   hex: "#1A2A50" },
        { key: "noMoonDeepPurple", label: "EX2E.AnimaColorNoMoonDeepPurple", hex: "#502070" }
      ],
      casteless: [
        { key: "castelessPurple", label: "EX2E.AnimaColorCastelessPurple", hex: "#7040B0" },
        { key: "castelessBlue",   label: "EX2E.AnimaColorCastelessBlue",   hex: "#2060C0" }
      ]
    }
  },
  abyssal: {
    base: [
      { key: "abyssalVoidBlack", label: "EX2E.AnimaColorAbyssalVoidBlack", hex: "#111111" },
      { key: "abyssalDarkGray",  label: "EX2E.AnimaColorAbyssalDarkGray",  hex: "#606060" }
    ],
    castes: {
      dusk: [
        { key: "duskDarkPurple", label: "EX2E.AnimaColorDuskDarkPurple", hex: "#3A1050" }
      ],
      midnight: [
        { key: "midnightDeepVoid",  label: "EX2E.AnimaColorMidnightDeepVoid",  hex: "#0A0A0A" },
        { key: "midnightDarkAbyss", label: "EX2E.AnimaColorMidnightDarkAbyss", hex: "#1A0020" }
      ],
      daybreak: [
        { key: "daybreakRegalPurple",  label: "EX2E.AnimaColorDaybreakRegalPurple",  hex: "#5A2080" },
        { key: "daybreakStatelyGray",  label: "EX2E.AnimaColorDaybreakStatelyGray",  hex: "#909090" }
      ],
      day: [
        { key: "daySicklyGreen", label: "EX2E.AnimaColorDaySicklyGreen", hex: "#607040" },
        { key: "dayPurple",      label: "EX2E.AnimaColorDayPurple",      hex: "#3A1050" }
      ],
      moonshadow: [
        { key: "moonshadowSilver",  label: "EX2E.AnimaColorMoonshadowSilver",  hex: "#B0B0C0" },
        { key: "moonshadowSparkle", label: "EX2E.AnimaColorMoonshadowSparkle", hex: "#D8D8F0" }
      ]
    }
  },
  infernal: {
    base: [
      { key: "infernalGreen", label: "EX2E.AnimaColorInfernalGreen", hex: "#30C050" }
    ],
    castes: {
      slayer: [
        { key: "slayerBlazingGreen", label: "EX2E.AnimaColorSlayerBlazingGreen", hex: "#40E060" },
        { key: "slayerBrass",        label: "EX2E.AnimaColorSlayerBrass",        hex: "#C09030" }
      ],
      malefactor: [
        { key: "malefactorTarnishedSilver", label: "EX2E.AnimaColorMalefactorTarnishedSilver", hex: "#909070" }
      ],
      defiler: [
        { key: "defilerWhiteFlame", label: "EX2E.AnimaColorDefilerWhiteFlame", hex: "#FFFFFF" }
      ],
      scourge: [
        { key: "scourgeRed", label: "EX2E.AnimaColorScourgeRed", hex: "#CC2020" }
      ],
      fiend: [
        { key: "fiendDarkGreen", label: "EX2E.AnimaColorFiendDarkGreen", hex: "#1A5030" },
        { key: "fiendPurple",    label: "EX2E.AnimaColorFiendPurple",    hex: "#502070" },
        { key: "fiendBlack",     label: "EX2E.AnimaColorFiendBlack",     hex: "#1A1A1A" }
      ]
    }
  },
  sidereal: {
    castes: {
      journeys: [
        { key: "siderealJourneysBrightYellow", label: "EX2E.AnimaColorSiderealJourneysBrightYellow", hex: "#FFE000" }
      ],
      serenity: [
        { key: "siderealSerenityBrightBlue", label: "EX2E.AnimaColorSiderealSerenityBrightBlue", hex: "#2080FF" }
      ],
      battles: [
        { key: "siderealBattlesScarlet", label: "EX2E.AnimaColorSiderealBattlesScarlet", hex: "#CC1020" }
      ],
      secrets: [
        { key: "siderealSecretsBrightGreen", label: "EX2E.AnimaColorSiderealSecretsBrightGreen", hex: "#20C040" }
      ],
      endings: [
        { key: "siderealEndingsBrightViolet", label: "EX2E.AnimaColorSiderealEndingsBrightViolet", hex: "#8020C0" }
      ]
    }
  },
  terrestrial: {
    castes: {
      air: [
        { key: "airWhite",    label: "EX2E.AnimaColorAirWhite",    hex: "#FFFFFF" },
        { key: "airPaleBlue", label: "EX2E.AnimaColorAirPaleBlue", hex: "#B0D0F0" }
      ],
      earth: [
        { key: "earthYellow", label: "EX2E.AnimaColorEarthYellow", hex: "#E0C030" },
        { key: "earthWhite",  label: "EX2E.AnimaColorEarthWhite",  hex: "#F0F0E0" }
      ],
      fire: [
        { key: "fireRed",    label: "EX2E.AnimaColorFireRed",    hex: "#DC143C" },
        { key: "fireOrange", label: "EX2E.AnimaColorFireOrange", hex: "#FF8020" },
        { key: "fireYellow", label: "EX2E.AnimaColorFireYellow", hex: "#FFD700" },
        { key: "fireWhite",  label: "EX2E.AnimaColorFireWhite",  hex: "#FFFFFF" }
      ],
      water: [
        { key: "waterDeepBlue", label: "EX2E.AnimaColorWaterDeepBlue", hex: "#2050A0" },
        { key: "waterTeal",     label: "EX2E.AnimaColorWaterTeal",     hex: "#00CED1" },
        { key: "waterSeaGreen", label: "EX2E.AnimaColorWaterSeaGreen", hex: "#208060" },
        { key: "waterDeepBlack", label: "EX2E.AnimaColorWaterDeepBlack", hex: "#1A2A40" }
      ],
      wood: [
        { key: "woodForestGreen", label: "EX2E.AnimaColorWoodForestGreen", hex: "#30B050" },
        { key: "woodSage",        label: "EX2E.AnimaColorWoodSage",        hex: "#7DB17D" }
      ]
    }
  },
  alchemical: {
    castes: {
      orichalcum: [
        { key: "orichalcumGoldenFire",     label: "EX2E.AnimaColorOrichalcumGoldenFire",     hex: "#FFD700" },
        { key: "orichalcumWhiteLightning", label: "EX2E.AnimaColorOrichalcumWhiteLightning", hex: "#FFFFFF" }
      ],
      moonsilver: [
        { key: "moonsilverPaleSilver", label: "EX2E.AnimaColorMoonsilverPaleSilver", hex: "#D0D0D8" },
        { key: "moonsilverWhite",      label: "EX2E.AnimaColorMoonsilverWhite",      hex: "#F0F0F8" }
      ],
      jade: [
        { key: "jadeGreen",  label: "EX2E.AnimaColorJadeGreen",  hex: "#30A060" },
        { key: "jadeRed",    label: "EX2E.AnimaColorJadeRed",    hex: "#C03030" },
        { key: "jadeWhite",  label: "EX2E.AnimaColorJadeWhite",  hex: "#F0F0F0" },
        { key: "jadeBlue",   label: "EX2E.AnimaColorJadeBlue",   hex: "#2060C0" },
        { key: "jadeBlack",  label: "EX2E.AnimaColorJadeBlack",  hex: "#1A1A1A" }
      ],
      starmetal: [
        { key: "starmetalDeepBlue",   label: "EX2E.AnimaColorStarmetalDeepBlue",   hex: "#102060" },
        { key: "starmetalPrismatic",  label: "EX2E.AnimaColorStarmetalPrismatic",  hex: "#7060C0" }
      ],
      soulsteel: [
        { key: "soulsteelSmokyBlack",     label: "EX2E.AnimaColorSoulsteelSmokyBlack",     hex: "#2A2A30" },
        { key: "soulsteelBlueLightning",  label: "EX2E.AnimaColorSoulsteelBlueLightning",  hex: "#3060C0" }
      ],
      adamant: [
        { key: "adamantPiercingWhite", label: "EX2E.AnimaColorAdamantPiercingWhite", hex: "#F0F0FF" },
        { key: "adamantPurple",        label: "EX2E.AnimaColorAdamantPurple",        hex: "#8040C0" }
      ]
    }
  }
};

/**
 * Returns the palette entries available to an actor based on exalt type + caste.
 * Solar/Lunar/Abyssal/Infernal: base + caste extras.
 * Sidereal/Terrestrial/Alchemical: caste-only.
 */
export function getAnimaPalette(actor) {
  const entry = EX2E.animaColors[actor.system.exaltType];
  if (!entry) return [];
  return [
    ...(entry.base ?? []),
    ...(entry.castes?.[actor.system.caste] ?? [])
  ];
}

EX2E.animaEffects = {
  none:    "EX2E.AnimaEffectNone",
  pulse:   "EX2E.AnimaEffectPulse",
  flicker: "EX2E.AnimaEffectFlicker",
};

// ── Ability Groupings by Exalt Type ──────────────────────────────────────
// Each entry is an array of { key, label (i18n), abilities[] }.
// "terrestrial" is keyed by aspect instead (built dynamically in the sheet).

const warriorGroup = ["archery","martialArts","melee","thrown","war"];
const priestGroup = ["integrity","performance","presence","resistance", "survival"];
const savantGroup = ["craft","investigation","lore","medicine","occult"];
const criminalGroup = ["athletics", "awareness","dodge","larceny","stealth"];
const brokerGroup = ["bureaucracy", "linguistics","ride","sail","socialize"];

const warGroup = ["archery","athletics","awareness","dodge","integrity","martialArts", "melee", "resistance", "thrown", "war"]
const lifeGroup = ["craft","larceny","linguistics","performance", "presence", "ride", "sail", "socialize", "stealth", "survival"]
const wisdomGroup = ["bureaucracy","investigation", "lore","medicine","occult"];

EX2E.abilityGroups = {
  solar: [
    { key: "dawn",     label: "EX2E.CasteDawn",     abilities: warriorGroup },
    { key: "zenith",   label: "EX2E.CasteZenith",   abilities: priestGroup },
    { key: "twilight", label: "EX2E.CasteTwilight", abilities: savantGroup },
    { key: "night",    label: "EX2E.CasteNight",    abilities: criminalGroup },
    { key: "eclipse",  label: "EX2E.CasteEclipse",  abilities: brokerGroup }
  ],
  abyssal: [
    { key: "dawn",     label: "EX2E.CasteDeathknight_Dusk",       abilities: warriorGroup },
    { key: "zenith",   label: "EX2E.CasteDeathknight_Midnight",   abilities: priestGroup },
    { key: "twilight", label: "EX2E.CasteDeathknight_Daybreak",   abilities: savantGroup },
    { key: "night",    label: "EX2E.CasteDeathknight_Day",        abilities: criminalGroup },
    { key: "eclipse",  label: "EX2E.CasteDeathknight_Moonshadow", abilities: brokerGroup }
  ],
  infernal: [
    { key: "slayer",     label: "EX2E.CasteSlayer",     abilities: warriorGroup },
    { key: "malefactor", label: "EX2E.CasteMalefactor", abilities: priestGroup },
    { key: "defiler",    label: "EX2E.CasteDefiler",    abilities: savantGroup },
    { key: "scourge",    label: "EX2E.CasteScourge",    abilities: criminalGroup },
    { key: "fiend",      label: "EX2E.CasteFiend",      abilities: brokerGroup }
  ],
  mortal: [
    { key: "warrior",  label: "EX2E.AbilityGroupWarrior",  abilities: warriorGroup },
    { key: "priest",   label: "EX2E.AbilityGroupPriest",   abilities: priestGroup },
    { key: "savant",   label: "EX2E.AbilityGroupSavant",   abilities: savantGroup },
    { key: "criminal", label: "EX2E.AbilityGroupCriminal", abilities: criminalGroup },
    { key: "broker",   label: "EX2E.AbilityGroupBroker",   abilities: brokerGroup }
  ],
  lunar: [
    { key: "war",    label: "EX2E.AbilityGroupWar",    abilities: warGroup },
    { key: "life",   label: "EX2E.AbilityGroupLife",   abilities: lifeGroup },
    { key: "wisdom", label: "EX2E.AbilityGroupWisdom", abilities: wisdomGroup }
  ],
  alchemical: [
    { key: "warfare",  label: "EX2E.AbilityGroupWarfare",  abilities: warGroup },
    { key: "labor",    label: "EX2E.AbilityGroupLabor",    abilities: lifeGroup },
    { key: "learning", label: "EX2E.AbilityGroupLearning", abilities: wisdomGroup },
  ],
  sidereal: [
    { key: "journeys", label: "EX2E.CasteJourneys", abilities: ["resistance","ride","sail","survival","thrown"] },
    { key: "serenity", label: "EX2E.CasteSerenity", abilities: ["craft","dodge","linguistics","performance","socialize"] },
    { key: "battles",  label: "EX2E.CasteBattles",  abilities: ["archery","athletics","melee","presence","war"] },
    { key: "secrets",  label: "EX2E.CasteSecrets",  abilities: ["investigation","larceny","lore","occult","stealth"] },
    { key: "endings",  label: "EX2E.CasteEndings",  abilities: ["awareness","bureaucracy","integrity","martialArts","medicine"] }
  ],
  terrestrial: [
    { key: "air",   label: "EX2E.CasteAir",   abilities: ["linguistics","lore","occult","stealth","thrown"] },
    { key: "earth", label: "EX2E.CasteEarth", abilities: ["awareness","craft","integrity","resistance","war"] },
    { key: "fire",  label: "EX2E.CasteFire",  abilities: ["athletics","dodge","melee","presence","socialize"] },
    { key: "water", label: "EX2E.CasteWater", abilities: ["bureaucracy","investigation","larceny","martialArts","sail"] },
    { key: "wood",  label: "EX2E.CasteWood",  abilities: ["archery","medicine","performance","ride","survival"] }
  ]
};

// Caste-attribute mappings for attribute-based exalts. Mirrors the shape
// of EX2E.abilityGroups but uses attributes instead of abilities. Consumed
// by ExaltedActor._preUpdate (caste auto-assignment) and the attribute
// caste/favored badge UI on the character sheet.
EX2E.attributeGroups = {
  lunar: [
    { key: "full",      label: "EX2E.CasteFullMoon",     attributes: ["strength",  "dexterity",    "stamina"] },
    { key: "changing",  label: "EX2E.CasteChangingMoon", attributes: ["charisma",  "manipulation", "appearance"] },
    { key: "no",        label: "EX2E.CasteNoMoon",       attributes: ["perception","intelligence", "wits"] },
    { key: "casteless", label: "EX2E.CasteCasteless",    attributes: [] }
  ],
  alchemical: [
    { key: "orichalcum", label: "EX2E.CasteOrichalcum", attributes: ["strength",  "charisma",     "intelligence"] },
    { key: "moonsilver", label: "EX2E.CasteMoonsilver", attributes: ["dexterity", "appearance",   "wits"] },
    { key: "jade",       label: "EX2E.CasteJade",       attributes: ["stamina",   "charisma",     "wits"] },
    { key: "starmetal",  label: "EX2E.CasteStarmetal",  attributes: ["dexterity", "manipulation", "intelligence"] },
    { key: "soulsteel",  label: "EX2E.CasteSoulsteel",  attributes: ["stamina",   "manipulation", "perception"] },
    { key: "adamant",    label: "EX2E.CasteAdamant",    attributes: ["strength",  "appearance",   "perception"] }
  ]
};

// ── Combat actions ──────────────────────────────────────────────────────
// Canonical 2e miscellaneous actions, keyed so the Finish Turn presets and
// the Flurry Declaration dialog can share one list. `dvMod` is stored as a
// positive magnitude — consumers subtract it from DV (keeps downstream math
// consistent with how DV penalty AEs are stored on the actor).
//
// `preset: true` flags actions that should appear in the Finish Turn
// preset strip (common single-action cases). All actions are selectable in
// the Flurry dialog row dropdown.
EX2E.actions = {
  guard:       { labelKey: "EX2E.ActionGuard",       icon: "fa-solid fa-shield",             speed: 3, dvMod: 0, preset: true,  isFlurry: false, abortable: true  },
  move:        { labelKey: "EX2E.ActionMove",        icon: "fa-solid fa-person-walking",     speed: 0, dvMod: 0, preset: true,  isFlurry: true,  abortable: false },
  dash:        { labelKey: "EX2E.ActionDash",        icon: "fa-solid fa-person-running",     speed: 3, dvMod: 2, preset: true,  isFlurry: true,  abortable: false },
  aim:         { labelKey: "EX2E.ActionAim",         icon: "fa-solid fa-bullseye",           speed: 3, dvMod: 1, preset: true,  isFlurry: false, abortable: true  },
  simpleCharm: { labelKey: "EX2E.ActionSimple",      icon: "fa-solid fa-wand-sparkles",      speed: 6, dvMod: 1, preset: true,  isFlurry: true,  abortable: false },
  draw:        { labelKey: "EX2E.ActionDraw",        icon: "fa-solid fa-hand-fist",          speed: 5, dvMod: 1, preset: false, isFlurry: true,  abortable: false },
  rise:        { labelKey: "EX2E.ActionRise",        icon: "fa-solid fa-arrow-up-from-bracket", speed: 5, dvMod: 1, preset: false, isFlurry: true, abortable: false },
  jump:        { labelKey: "EX2E.ActionJump",        icon: "fa-solid fa-up-long",            speed: 5, dvMod: 1, preset: false, isFlurry: true,  abortable: false },
  coordinate:  { labelKey: "EX2E.ActionCoordinate",  icon: "fa-solid fa-users",              speed: 5, dvMod: 0, preset: false, isFlurry: true,  abortable: false },
  inactive:    { labelKey: "EX2E.ActionInactive",    icon: "fa-solid fa-pause",              speed: 5, dvMod: 0, preset: false, isFlurry: false, abortable: false },
  shapeshift:  { labelKey: "EX2E.ActionShapeshift",  icon: "fa-solid fa-paw",                speed: 5, dvMod: 1, preset: true,  isFlurry: false, abortable: false }
};

/** List view of EX2E.actions as [{ key, label, icon, speed, dvMod, preset, isFlurry }] (localized). */
EX2E.getActionList = function () {
  return Object.entries(EX2E.actions).map(([key, a]) => ({
    key,
    label:    game.i18n.localize(a.labelKey),
    icon:     a.icon ?? "",
    speed:    a.speed,
    dvMod:    a.dvMod,
    preset:   !!a.preset,
    isFlurry: !!a.isFlurry
  }));
};

// ── Active Bonus Table Helpers ──────────────────────────────────────────
// These return the correct bonus table based on the "Use Errata Materials" setting.
// Errata tables are sparse (only overridden materials); base table fills the gaps.

/**
 * Get the active melee magical material bonuses, merging errata overrides if enabled.
 */
EX2E.getActiveMeleeMaterialBonuses = function () {
  if (game.settings.get("exalted2e", "useErrataMaterials")) {
    return { ...EX2E.meleeMagicalMaterialBonuses, ...EX2E.errataMeleeMagicalMaterialBonuses };
  }
  return EX2E.meleeMagicalMaterialBonuses;
};

/**
 * Get the active armor magical material bonuses, merging errata overrides if enabled.
 */
EX2E.getActiveArmorMaterialBonuses = function () {
  if (game.settings.get("exalted2e", "useErrataMaterials")) {
    return { ...EX2E.magicalMaterialArmorBonuses, ...EX2E.errataMagicalMaterialArmorBonuses };
  }
  return EX2E.magicalMaterialArmorBonuses;
};

// ── Martial Arts Access by Exalt Type ──────────────────────────────────────
// Maps exalt types to their standard MA tier access. Used to derive the
// effective MA tier of a charm when martialArtsTier is blank.

EX2E.maAccessByExaltType = {
  mortal:       "",
  terrestrial:  "",
  lunar:        "celestial",
  alchemical:   "celestial",
  infernal:     "celestial",
  solar:        "sidereal",
  abyssal:      "sidereal",
  sidereal:     "sidereal",
  martialarts:  "celestial", //Not really necessary but it's a placeholder
};

// ── Sidereal Colleges ──────────────────────────────────────────────────────
EX2E.siderealColleges = {
  the_captain:        { labelKey: "EX2E.CollegeTheCaptain",       maiden: "journeys" },
  the_gull:           { labelKey: "EX2E.CollegeTheGull",          maiden: "journeys" },
  the_mast:           { labelKey: "EX2E.CollegeTheMast",          maiden: "journeys" },
  the_messenger:      { labelKey: "EX2E.CollegeTheMessenger",     maiden: "journeys" },
  the_ships_wheel:    { labelKey: "EX2E.CollegeTheShipsWheel",    maiden: "journeys" },
  the_ewer:           { labelKey: "EX2E.CollegeTheEwer",          maiden: "serenity" },
  the_lovers:         { labelKey: "EX2E.CollegeTheLovers",        maiden: "serenity" },
  the_musician:       { labelKey: "EX2E.CollegeTheMusician",      maiden: "serenity" },
  the_peacock:        { labelKey: "EX2E.CollegeThePeacock",       maiden: "serenity" },
  the_pillar:         { labelKey: "EX2E.CollegeThePillar",        maiden: "serenity" },
  the_banner:         { labelKey: "EX2E.CollegeTheBanner",        maiden: "battles"  },
  the_gauntlet:       { labelKey: "EX2E.CollegeTheGauntlet",      maiden: "battles"  },
  the_quiver:         { labelKey: "EX2E.CollegeTheQuiver",        maiden: "battles"  },
  the_shield:         { labelKey: "EX2E.CollegeTheShield",        maiden: "battles"  },
  the_spear:          { labelKey: "EX2E.CollegeTheSpear",         maiden: "battles"  },
  the_guardians:      { labelKey: "EX2E.CollegeTheGuardians",     maiden: "secrets"  },
  the_key:            { labelKey: "EX2E.CollegeTheKey",           maiden: "secrets"  },
  the_mask:           { labelKey: "EX2E.CollegeTheMask",          maiden: "secrets"  },
  the_sorcerer:       { labelKey: "EX2E.CollegeTheSorcerer",      maiden: "secrets"  },
  the_treasure_trove: { labelKey: "EX2E.CollegeTheTreasureTrove", maiden: "secrets"  },
  the_corpse:         { labelKey: "EX2E.CollegeTheCorpse",        maiden: "endings"  },
  the_crow:           { labelKey: "EX2E.CollegeTheCrow",          maiden: "endings"  },
  the_haywain:        { labelKey: "EX2E.CollegeTheHaywain",       maiden: "endings"  },
  the_rising_smoke:   { labelKey: "EX2E.CollegeTheRisingSmoke",   maiden: "endings"  },
  the_sword:          { labelKey: "EX2E.CollegeTheSword",         maiden: "endings"  },
};

EX2E.siderealMaidens = {
  journeys: "EX2E.HouseOfJourneys",
  serenity: "EX2E.HouseOfSerenity",
  battles:  "EX2E.HouseOfBattles",
  secrets:  "EX2E.HouseOfSecrets",
  endings:  "EX2E.HouseOfEndings",
};

EX2E.destinyProvidence = {
  artless_prodigy_blessing:      { labelKey: "EX2E.ProvidenceArtlessProdigy",      type: "blessing", requiresVirtue: false },
  blissful_idiot_blessing:       { labelKey: "EX2E.ProvidenceBlissfulIdiot",       type: "blessing", requiresVirtue: false },
  hound_chases_rabbit_blessing:  { labelKey: "EX2E.ProvidenceHoundChasesRabbit",  type: "blessing", requiresVirtue: false },
  fortified_spirit_blessing:     { labelKey: "EX2E.ProvidenceFortifiedSpirit",     type: "blessing", requiresVirtue: true  },
  sloped_floor_curse:            { labelKey: "EX2E.ProvidenceSlopedFloor",         type: "curse",    requiresVirtue: false },
  ruin_without_failure_curse:    { labelKey: "EX2E.ProvidenceRuinWithoutFailure",  type: "curse",    requiresVirtue: false },
  heart_piercing_curse:          { labelKey: "EX2E.ProvidenceHeartPiercing",       type: "curse",    requiresVirtue: false },
  name_destroying_curse:         { labelKey: "EX2E.ProvidenceNameDestroying",      type: "curse",    requiresVirtue: true  },
};

EX2E.destinyTrigger = {
  simple:      { labelKey: "EX2E.TriggerSimple",      paradoxDice: 1 },
  intelligent: { labelKey: "EX2E.TriggerIntelligent", paradoxDice: 3 },
};

// effectPoints = cost to buy this level; paradoxDice = dice from THIS level only (not cumulative)
EX2E.destinyScope = {
  0:  { labelKey: "EX2E.ScopeIndividual",      effectPoints: 0,  paradoxDice: 0, invitesCensure: false },
  1:  { labelKey: "EX2E.ScopeIndividualAlone", effectPoints: 1,  paradoxDice: 0, invitesCensure: false },
  2:  { labelKey: "EX2E.ScopeSmallGroup",      effectPoints: 2,  paradoxDice: 0, invitesCensure: false },
  3:  { labelKey: "EX2E.ScopeExtendedFamily",  effectPoints: 3,  paradoxDice: 0, invitesCensure: false },
  4:  { labelKey: "EX2E.ScopeClanVillage",     effectPoints: 4,  paradoxDice: 1, invitesCensure: false },
  5:  { labelKey: "EX2E.ScopeTown",            effectPoints: 5,  paradoxDice: 1, invitesCensure: false },
  6:  { labelKey: "EX2E.ScopeCity",            effectPoints: 6,  paradoxDice: 1, invitesCensure: true  },
  7:  { labelKey: "EX2E.ScopePrincipality",    effectPoints: 7,  paradoxDice: 3, invitesCensure: true  },
  8:  { labelKey: "EX2E.ScopeKingdom",         effectPoints: 8,  paradoxDice: 3, invitesCensure: true  },
  9:  { labelKey: "EX2E.ScopeLocalRegion",     effectPoints: 9,  paradoxDice: 3, invitesCensure: true  },
  10: { labelKey: "EX2E.ScopeDirection",       effectPoints: 10, paradoxDice: 3, invitesCensure: true  },
};

EX2E.destinyDuration = {
  0:  { labelKey: "EX2E.DurationOneMonth",    effectPoints: 0,  paradoxDice: 0, invitesCensure: false },
  1:  { labelKey: "EX2E.DurationOneSeason",   effectPoints: 1,  paradoxDice: 0, invitesCensure: false },
  2:  { labelKey: "EX2E.DurationOneYear",     effectPoints: 2,  paradoxDice: 1, invitesCensure: false },
  3:  { labelKey: "EX2E.Duration10Years",     effectPoints: 3,  paradoxDice: 1, invitesCensure: false },
  4:  { labelKey: "EX2E.Duration20Years",     effectPoints: 4,  paradoxDice: 1, invitesCensure: false },
  5:  { labelKey: "EX2E.Duration60Years",     effectPoints: 5,  paradoxDice: 3, invitesCensure: false },
  6:  { labelKey: "EX2E.Duration140Years",    effectPoints: 6,  paradoxDice: 3, invitesCensure: true  },
  7:  { labelKey: "EX2E.Duration260Years",    effectPoints: 7,  paradoxDice: 3, invitesCensure: true  },
  8:  { labelKey: "EX2E.Duration600Years",    effectPoints: 8,  paradoxDice: 3, invitesCensure: true  },
  9:  { labelKey: "EX2E.Duration1000Years",   effectPoints: 9,  paradoxDice: 3, invitesCensure: true  },
  10: { labelKey: "EX2E.Duration2000Years",   effectPoints: 10, paradoxDice: 3, invitesCensure: true  },
};

EX2E.destinyFrequency = {
  1: { labelKey: "EX2E.FrequencyWeekly",    effectPoints: 1, paradoxDice: 1, invitesCensure: false },
  2: { labelKey: "EX2E.FrequencyDaily",     effectPoints: 2, paradoxDice: 1, invitesCensure: false },
  3: { labelKey: "EX2E.FrequencyPerScene",  effectPoints: 3, paradoxDice: 1, invitesCensure: true  },
  4: { labelKey: "EX2E.FrequencyAlways",    effectPoints: 4, paradoxDice: 3, invitesCensure: true  },
};
