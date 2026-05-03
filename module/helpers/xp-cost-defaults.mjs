/**
 * Default XP costs for the XP Cost Engine.
 *
 * The world setting `exalted2e.xpCosts` stores the GM's overrides with
 * the same shape. Any key absent from the stored setting falls back to
 * the defaults here, so a GM can tweak one number without needing to
 * re-specify the whole ruleset.
 *
 * Layout:
 *   general.*         — values applied to every exalt type.
 *   <exaltType>.*     — values that only apply to that exalt type,
 *                       overriding anything shared in general.
 *
 * Formula encoding:
 *   attributeMult / willpowerMult / virtueMult
 *     → cost per dot = current_rating × mult
 *   backgroundFlat
 *     → cost per dot = flat (same price for every dot)
 *   abilityFavoredMult + abilityFavoredSub
 *     → cost per dot (favored/caste) = new_rating × mult − sub
 *   abilityOtherMult
 *     → cost per dot (other) = new_rating × mult
 *   essenceMult
 *     → cost per dot = new_rating × mult
 *   collegePerDotMult (Sidereal)
 *     → cost per dot above 1 = new_rating × mult
 *   Everything else (charmFavored, knack, spellFlat, slotGeneral, …) is
 *   a flat per-purchase price.
 */
export const XP_COST_DEFAULTS = Object.freeze({

  general: {
    attributeMult:  4,   // new × 4 for everyone (Lunar/Alchemical override on caste/favored attrs)
    abilityNewFlat: 3,   // 0 → 1 on any new ability
    specialtyFlat:  3,   // per specialty added
    willpowerMult:  2,   // current × 2
    virtueMult:     3,   // current × 3
    backgroundFlat: 3    // flat per dot (3 + 3 + 3 + …)
  },

  solar: {
    essenceMult:        8,
    abilityFavoredMult: 2, abilityFavoredSub: 1,   // (2n − 1) per favored/caste dot
    abilityOtherMult:   2,                          // 2n per out-of-caste dot
    charmFavored:       8, charmOther: 10,
    spellFavored:       8, spellOther: 10,
    foreignCharm:      16,                          // Eclipse buying non-Solar/Abyssal charms
    siderealMaFavored: 12, siderealMaOther: 15       // Solar learning Sidereal MA
  },

  abyssal: {
    essenceMult:        8,
    abilityFavoredMult: 2, abilityFavoredSub: 1,
    abilityOtherMult:   2,
    charmFavored:       8, charmOther: 10,
    spellFavored:       8, spellOther: 10,
    foreignCharm:      16,                          // Moonshadow buying non-Solar/Abyssal charms
    siderealMaFavored: 12, siderealMaOther: 15
  },

  lunar: {
    essenceMult:               9,
    attributeCasteFavoredMult: 3,                   // new × 3 for caste/favored attrs
    abilityFavoredMult:        1, abilityFavoredSub: 0,
    abilityOtherMult:          2,
    charmFavored:             10, charmOther: 12,
    spellFavored:             10, spellOther: 12,
    knack:                    11
  },

  sidereal: {
    essenceMult:              9,
    abilityFavoredMult:       1, abilityFavoredSub: 0,
    abilityOtherMult:         2,
    charmFavored:            10, charmOther: 12,
    spellFavored:            10, spellOther: 12,
    collegeNew:               5, collegePerDotMult: 3
  },

  terrestrial: {
    essenceMult:            10,
    abilityFavoredMult:      1, abilityFavoredSub: 0,
    abilityOtherMult:        2,
    charmFavored:           10, charmOther: 12,
    spellFavored:           10, spellOther: 12,
    celestialMaFavored:     12, celestialMaOther: 15,
    maUnfavored:            15                       // MA ability not Favored/Aspect
  },

  alchemical: {
    essenceMult:               9,
    attributeCasteFavoredMult: 3,
    abilityFavoredMult:        1, abilityFavoredSub: 0,
    abilityOtherMult:          2,
    charm:                     6,                    // flat — slot system handles caste/favored
    martialArtsCharm:         11,
    spell:                     6,                    // procedures
    slotGeneral:               6,
    slotDedicated:             4,
    slotUpgrade:               2,
    protocolManMachine:        3,
    protocolGodMachine:        6,
    submodule:                 6
  },

  infernal: {
    essenceMult:        8,
    abilityFavoredMult: 1, abilityFavoredSub: 0,
    abilityOtherMult:   2,
    charmFavored:       8, charmOther: 10,
    spellFlat:          9,                           // sorcery — flat for Infernals
    maFavored:          8, maOther: 10,
    foreignCharm:      16                            // Fiend buying non-Infernal charms
  }
});

/**
 * Deep-clone the defaults and overlay numeric overrides from a stored
 * settings object. Empty strings / null / non-finite values fall back
 * to defaults, so the Config dialog can persist partial overrides only.
 *
 * Never mutates the defaults.
 *
 * @param {object|null} overrides  the raw object read from game.settings
 * @returns {object}               resolved costs with the same shape as XP_COST_DEFAULTS
 */
export function resolveXpCosts(overrides) {
  const out = foundry.utils.deepClone(XP_COST_DEFAULTS);
  if (!overrides || typeof overrides !== "object") return out;
  for (const section of Object.keys(out)) {
    const src = overrides[section];
    if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src)) {
      if (v === "" || v === null || v === undefined) continue;
      const n = Number(v);
      if (Number.isFinite(n)) out[section][k] = n;
    }
  }
  return out;
}

/**
 * Section ordering displayed in the Config dialog. Kept here so the
 * dialog doesn't need to import the defaults object just to enumerate.
 */
export const XP_COST_EXALT_ORDER = Object.freeze([
  "solar", "abyssal", "lunar", "sidereal",
  "terrestrial", "alchemical", "infernal"
]);
