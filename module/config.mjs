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

EX2E.exaltTypes = {
  solar:       "EX2E.ExaltSolar",
  lunar:       "EX2E.ExaltLunar",
  terrestrial: "EX2E.ExaltTerrestrial",
  sidereal:    "EX2E.ExaltSidereal",
  abyssal:     "EX2E.ExaltAbyssal",
  infernal:    "EX2E.ExaltInfernal",
  alchemical:  "EX2E.ExaltAlchemical",
  mortal:      "EX2E.ExaltMortal"
};

EX2E.castes = {
  solar:       { dawn: "EX2E.CasteDawn", zenith: "EX2E.CasteZenith", twilight: "EX2E.CasteTwilight", night: "EX2E.CasteNight", eclipse: "EX2E.CasteEclipse" },
  lunar:       { full: "EX2E.CasteFullMoon", changing: "EX2E.CasteChangingMoon", no: "EX2E.CasteNoMoon", castleless: "EX2E.Casteless" },
  terrestrial: { air: "EX2E.CasteAir", earth: "EX2E.CasteEarth", fire: "EX2E.CasteFire", water: "EX2E.CasteWater", wood: "EX2E.CasteWood" },
  sidereal:    { journeys: "EX2E.CasteJourneys", serenity: "EX2E.CasteSerenity", battles: "EX2E.CasteBattles", secrets: "EX2E.CasteSecrets", endings: "EX2E.CasteEndings" },
  abyssal:     { dawn: "EX2E.CasteDeathknight_Dusk", zenith: "EX2E.CasteDeathknight_Midnight", twilight: "EX2E.CasteDeathknight_Daybreak", night: "EX2E.CasteDeathknight_Day", eclipse: "EX2E.CasteDeathknight_Moonshadow" },
  infernal:    { slayer: "EX2E.CasteSlayer", scourge: "EX2E.CasteScourge", defiler: "EX2E.CasteDefiler", malefactor: "EX2E.CasteMalefactor", fiend: "EX2E.CasteFiend" },
  alchemical:  { orichalcum: "EX2E.CasteOrichalcum", moonsilver: "EX2E.CasteMoonsilver", starmetal: "EX2E.CasteStarmetal", soulsteel: "EX2E.CasteSoulsteel", jade: "EX2E.CasteJade", adamant: "EX2E.CasteAdamant" },
  mortal:      {}
};

EX2E.charmTypes = {
  supplemental: "EX2E.CharmSupplemental",
  reflexive:    "EX2E.CharmReflexive",
  simple:       "EX2E.CharmSimple",
  extraAction:  "EX2E.CharmExtraAction",
  permanent:    "EX2E.CharmPermanent"
};

EX2E.durations = {
  instant:     "EX2E.DurationInstant",
  oneScene:    "EX2E.DurationOneScene",
  oneDay:      "EX2E.DurationOneDay",
  indefinite:  "EX2E.DurationIndefinite",
  permanent:   "EX2E.DurationPermanent"
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

// ── Charm Keywords ──────────────────────────────────────────────────────
// Predefined list for autocomplete / dropdown suggestions on Charm sheets.
// Alphabetised and deduped — source categories preserved in comments below
// for reference (Avatar is Abyssal, Axiomatic is Alchemical, etc.).
EX2E.charmKeywords = [
  "Avatar", "Axiomatic",
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
  "Perfect Dodge", "Perfect Parry", "Poison", "Prayer Strip",
  "Rage", "Reactor",
  "Servitude", "Shaping", "Sickness", "Social", "Sorcerous", "Spectral", "Stackable",
  "Taint", "Touch", "Training",
  "Unblockable", "Unbreakable", "Undodgeable", 
  "Variable", "Velocity", "Virtue",
  "War", "Wyld"
];

EX2E.anima = {
  none:    "EX2E.AnimaNone",
  glowing: "EX2E.AnimaGlowing",
  burning: "EX2E.AnimaBurning",
  bonfire: "EX2E.AnimaBonfire",
  iconic:  "EX2E.AnimaIconic"
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
  guard:       { labelKey: "EX2E.ActionGuard",       icon: "fa-solid fa-shield",             speed: 3, dvMod: 0, preset: true,  isFlurry: false },
  move:        { labelKey: "EX2E.ActionMove",        icon: "fa-solid fa-person-walking",     speed: 0, dvMod: 0, preset: true,  isFlurry: true  },
  dash:        { labelKey: "EX2E.ActionDash",        icon: "fa-solid fa-person-running",     speed: 3, dvMod: 2, preset: true,  isFlurry: true  },
  aim:         { labelKey: "EX2E.ActionAim",         icon: "fa-solid fa-bullseye",           speed: 5, dvMod: 2, preset: true,  isFlurry: false },
  simpleCharm: { labelKey: "EX2E.ActionSimple",      icon: "fa-solid fa-wand-sparkles",      speed: 6, dvMod: 1, preset: true,  isFlurry: true  },
  draw:        { labelKey: "EX2E.ActionDraw",        icon: "fa-solid fa-hand-fist",          speed: 5, dvMod: 1, preset: false, isFlurry: true  },
  rise:        { labelKey: "EX2E.ActionRise",        icon: "fa-solid fa-arrow-up-from-bracket", speed: 5, dvMod: 2, preset: false, isFlurry: true },
  jump:        { labelKey: "EX2E.ActionJump",        icon: "fa-solid fa-up-long",            speed: 5, dvMod: 2, preset: false, isFlurry: true  },
  coordinate:  { labelKey: "EX2E.ActionCoordinate",  icon: "fa-solid fa-users",              speed: 5, dvMod: 2, preset: false, isFlurry: true  },
  inactive:    { labelKey: "EX2E.ActionInactive",    icon: "fa-solid fa-pause",              speed: 5, dvMod: 0, preset: false, isFlurry: false }
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
