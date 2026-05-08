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
  lunar:        "celestial",
  alchemical:   "celestial",
  infernal:     "celestial",
  solar:        "sidereal",
  abyssal:      "sidereal",
  sidereal:     "sidereal",
  martialarts:  "celestial",
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

  if (ability === "martialarts") {
    const tier = _effectiveMATier(charm);
    if (tier === "celestial" || tier === "sidereal") return 0;
    // Terrestrial-tier MA: apply surcharge unless martialArts is a caste ability.
    // The actor schema keys this under "martialArts" (camelCase), not "martialarts".
    const maData = actor.system.abilities?.martialArts;
    if (!maData) return 0;
    return maData.caste ? 0 : 1;
  }

  const abilityData = actor.system.abilities?.[ability];
  if (!abilityData) return 0;

  return abilityData.caste ? 0 : 1;
}

/**
 * Return the foreign-charm mote surcharge for Eclipse / Moonshadow / Fiend
 * activating a charm from another exalt type.
 *
 * Rules:
 *  - Only applies to Solar Eclipse, Abyssal Moonshadow (caste key "eclipse"),
 *    and Infernal Fiend.
 *  - The Solar↔Abyssal mirror pair are not foreign to each other.
 *  - Fiend has no mirror exemptions — every non-Infernal charm is foreign.
 *  - Permanent charms are skipped (no activation cost to surcharge).
 *
 * @param {object} actor  Foundry Actor document (or synthetic with .system).
 * @param {object} charm  Foundry Item document (or synthetic with .system).
 * @returns {0|2}
 */
export function getForeignCharmSurcharge(actor, charm) {
  const exaltType = actor?.system?.exaltType;
  const caste     = actor?.system?.caste;

  const isEclipseLike = caste === "eclipse" ||
    (exaltType === "infernal" && caste === "fiend");
  if (!isEclipseLike) return 0;

  if (charm?.system?.duration === "permanent") return 0;

  const charmExalt = charm?.system?.exaltType ?? "";
  if (!charmExalt || charmExalt === exaltType) return 0;

  // MA-style charms are not foreign charms for Eclipse-type casters
  if (charmExalt === "martialarts") return 0;

  // Solar↔Abyssal mirror: not foreign to each other
  if (exaltType === "solar"   && charmExalt === "abyssal") return 0;
  if (exaltType === "abyssal" && charmExalt === "solar")   return 0;

  return 2;
}
