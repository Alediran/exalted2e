const ABILITY_KEYS = [
  "archery", "athletics", "awareness", "bureaucracy", "craft", "dodge",
  "integrity", "investigation", "larceny", "linguistics", "lore",
  "martialArts", "medicine", "melee", "occult", "performance", "presence",
  "resistance", "ride", "sail", "socialize", "stealth", "survival",
  "thrown", "war"
];

function _ability(defaultAttribute = "") {
  return { value: 0, defaultAttribute, caste: false, favored: false, specialties: [] };
}

/**
 * Returns a synthetic CharacterData system object with sensible defaults.
 * Top-level fields can be overridden via shallow merge; nested overrides
 * (e.g., a single attribute value) require spreading the baseline:
 *
 *   makeCharacterSystem({
 *     attributes: { ...makeCharacterSystem().attributes, dexterity: { value: 4 } }
 *   })
 */
export function makeCharacterSystem(overrides = {}) {
  return {
    exaltType: "solar",
    caste: "dawn",
    concept: "",
    anima: "none",
    motivation: "",
    attributes: {
      strength:     { value: 1, caste: false, favored: false }, dexterity:    { value: 1, caste: false, favored: false }, stamina:    { value: 1, caste: false, favored: false },
      charisma:     { value: 1, caste: false, favored: false }, manipulation: { value: 1, caste: false, favored: false }, appearance: { value: 1, caste: false, favored: false },
      perception:   { value: 1, caste: false, favored: false }, intelligence: { value: 1, caste: false, favored: false }, wits:       { value: 1, caste: false, favored: false }
    },
    abilities: Object.fromEntries(ABILITY_KEYS.map(k => [k, _ability()])),
    virtues: {
      compassion: { value: 1, current: 1 },
      conviction: { value: 1, current: 1 },
      temperance: { value: 1, current: 1 },
      valor:      { value: 1, current: 1 }
    },
    essence:   { value: 1, max: 1 },
    willpower: { value: 5, max: 10 },
    motes: {
      personal:   { value: 13, max: 13, committed: 0 },
      peripheral: { value: 33, max: 33, committed: 0 }
    },
    limit:  { value: 0, trigger: "" },
    health: { bashing: 0, lethal: 0, aggravated: 0, bonus: { zero: 0, one: 0, two: 0 } },
    sorcery:    { initiation: 0 },
    necromancy: { initiation: 0 },
    splat: {
      solar: {},
      lunar: { tell: "", activeFormId: "" },
      terrestrial: { breeding: 0 },
      sidereal: { paradox: 0, arcaneFate: 0 },
      abyssal: { whispers: 0 },
      infernal: { patron: "", urge: "", actOfVillainy: 0 },
      alchemical: { dissonance: 0 }
    },
    ...overrides
  };
}

/** Synthetic NpcData system object. */
export function makeNpcSystem(overrides = {}) {
  return {
    npcType: "mortal",
    concept: "",
    essence:   { value: 1 },
    willpower: { value: 3, max: 3 },
    motes:     { value: 0, max: 0 },
    pools:     { combat: 5, social: 3, physical: 4 },
    combat: {
      joinBattle: 4,
      dodgeDV: 2, parryDV: 2,
      dodgeMDV: 2, parryMDV: 2,
      soak: { bashing: 3, lethal: 1, aggravated: 0 },
      hardness: 0
    },
    health: { bashing: 0, lethal: 0, aggravated: 0, totalBoxes: 7 },
    ...overrides
  };
}

/**
 * Synthetic intimacy item for tests that need defender intimacies.
 *
 *   makeIntimacy({ positive: true, intimacyType: "tie" })
 *
 * Defaults to a positive Tie.
 */
export function makeIntimacy(overrides = {}) {
  return {
    type: "intimacy",
    name: "Test Intimacy",
    system: {
      intimacyType: "tie",
      intensity:    "minor",
      subject:      "",
      positive:     true,
      strength:     0,
      ...overrides
    }
  };
}
