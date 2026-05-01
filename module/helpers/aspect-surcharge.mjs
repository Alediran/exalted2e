/**
 * MA tier access by exalt type. Used to derive the effective MA tier of a
 * charm when the charm's `martialArtsTier` field is blank — i.e. when the
 * charm author relied on the standard exalt-type access rather than setting
 * an explicit override.
 *
 * Mirrors EX2E.maAccessByExaltType in config.mjs. Kept local here so this
 * module stays import-free (pure function, no Foundry globals, fully
 * testable in Vitest without mocks).
 */
const MA_TIER_BY_EXALT = {
  mortal:      "",
  terrestrial: "",
  lunar:       "celestial",
  alchemical:  "celestial",
  infernal:    "celestial",
  solar:       "sidereal",
  abyssal:     "sidereal",
  sidereal:    "sidereal"
};

/**
 * Compute the effective MA tier for a charm.
 * Explicit `martialArtsTier` overrides; otherwise derived from `exaltType`.
 */
function _effectiveMATier(charm) {
  const explicit = charm?.system?.martialArtsTier;
  if (explicit) return explicit;
  return MA_TIER_BY_EXALT[charm?.system?.exaltType ?? ""] ?? "";
}

/**
 * Return the out-of-aspect mote surcharge for a Dragon-Blooded activating
 * a charm.
 *
 * Rules:
 *  - Only applies to terrestrial exalts.
 *  - MA tier is derived from the charm's `martialArtsTier` field when set,
 *    otherwise from the charm's `exaltType` (Solar/Abyssal/Sidereal → sidereal;
 *    Lunar/Alchemical/Infernal → celestial; others → terrestrial).
 *  - Celestial and Sidereal MA charms are always exempt (Glorious Dragon
 *    Style per-element rules are deferred to the MA implementation phase).
 *  - Only the five caste (aspect) abilities are free. Favored abilities
 *    still incur the surcharge.
 *
 * @param {object} actor  Foundry Actor document (or synthetic with .system).
 * @param {object} charm  Foundry Item document (or synthetic with .system).
 * @returns {0|1}
 */
export function getOutOfAspectSurcharge(actor, charm) {
  if (actor?.system?.exaltType !== "terrestrial") return 0;

  const ability = charm?.system?.ability;
  if (!ability) return 0;

  if (ability === "martialArts") {
    const tier = _effectiveMATier(charm);
    if (tier === "celestial" || tier === "sidereal") return 0;
  }

  const abilityData = actor.system.abilities?.[ability];
  if (!abilityData) return 0;

  return abilityData.caste ? 0 : 1;
}
