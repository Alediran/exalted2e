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
 * DB caste element → caste ability keys for that element.
 * Used by mastery-bonus checks: mastering an elemental MA style grants
 * out-of-aspect exemption for the element's non-MA ability charms.
 * Ability keys match charm.system.ability (lowercase).
 */
const ELEMENT_ABILITIES = {
  air:   new Set(["linguistics", "lore", "occult", "stealth", "thrown"]),
  earth: new Set(["awareness", "craft", "integrity", "resistance", "war"]),
  fire:  new Set(["athletics", "dodge", "melee", "presence", "socialize"]),
  water: new Set(["bureaucracy", "investigation", "larceny", "martialarts", "sail"]),
  wood:  new Set(["archery", "medicine", "performance", "ride", "survival"]),
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
 * Return the set of elemental MA styles the actor has mastered.
 * Mastery = owning a charm with `grantsMastery: true` for that element.
 */
function _masteredElements(actor) {
  const items = actor?.items ?? [];
  const elements = new Set();
  for (const item of items) {
    if (item.type !== "charm") continue;
    if (!item.system?.grantsMastery) continue;
    const el = item.system?.martialArtsElement;
    if (el) elements.add(el);
  }
  return elements;
}

/**
 * Return true if the actor is mid-initiation into any Dragon Style —
 * i.e. owns at least one charm from an elemental MA style but has not
 * yet earned mastery (the grantsMastery charm) for that same element.
 * While mid-initiation, ALL MA charm activations incur the +1m surcharge.
 */
function _isInitiatingStyle(actor) {
  const items = actor?.items ?? [];
  const started  = new Set();
  const mastered = new Set();
  for (const item of items) {
    if (item.type !== "charm") continue;
    const el = item.system?.martialArtsElement;
    if (!el) continue;
    started.add(el);
    if (item.system?.grantsMastery) mastered.add(el);
  }
  for (const el of started) {
    if (!mastered.has(el)) return true;
  }
  return false;
}

/**
 * Return the out-of-aspect mote surcharge for a Dragon-Blooded activating
 * a charm.
 *
 * Rules:
 *  - Only applies to terrestrial exalts.
 *  - MA tier is derived from the charm's `martialArtsTier` field when set,
 *    otherwise from the charm's `exaltType`.
 *  - Celestial and Sidereal MA charms are exempt (governed by
 *    getCelestialMASurcharge instead).
 *  - Only the five caste (aspect) abilities are free. Favored abilities
 *    still incur the surcharge.
 *  - Mastery bonus: mastering an elemental MA style (grantsMastery charm
 *    owned with that martialArtsElement) also exempts that element's
 *    non-MA ability charms from the surcharge.
 *
 * @param {object} actor  Foundry Actor document (or synthetic with .system + .items).
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
    // Mid-initiation into any Dragon Style imposes the surcharge on ALL MA
    // charms, overriding even the Water Aspect's in-aspect exemption.
    if (_isInitiatingStyle(actor)) return 1;
    // The actor schema keys martialArts under "martialArts" (camelCase).
    const maData = actor.system.abilities?.martialArts;
    if (!maData) return 0;
    if (maData.caste) return 0;
    // Non-caste: mastering the Dragon Style for this element grants exemption.
    const element = charm?.system?.martialArtsElement;
    if (element) {
      const mastered = _masteredElements(actor);
      if (mastered.has(element)) return 0;
    }
    return 1;
  }

  const abilityData = actor.system.abilities?.[ability];
  if (!abilityData) return 0;
  if (abilityData.caste) return 0;

  // Mastery bonus: mastering an elemental MA style exempts that element's
  // non-MA ability charms from the out-of-aspect surcharge.
  const mastered = _masteredElements(actor);
  if (mastered.size > 0) {
    for (const [element, abilities] of Object.entries(ELEMENT_ABILITIES)) {
      if (mastered.has(element) && abilities.has(ability)) return 0;
    }
  }

  return 1;
}

/**
 * Return the celestial-MA mote surcharge for a Dragon-Blooded activating
 * an elementally-aspected Celestial or Sidereal Martial Arts charm.
 *
 * Rules (Scroll of the Monk):
 *  - Only applies to terrestrial exalts.
 *  - Only applies when the charm has a martialArtsElement set (non-elemental
 *    celestial MA styles do not impose this surcharge).
 *  - No surcharge if the DB's caste matches the style's element.
 *  - No surcharge if the DB has mastered the style (owns a charm with
 *    grantsMastery: true and the same martialArtsElement).
 *  - +1m per activation otherwise.
 *
 * @param {object} actor  Foundry Actor document (or synthetic with .system + .items).
 * @param {object} charm  Foundry Item document (or synthetic with .system).
 * @returns {0|1}
 */
export function getCelestialMASurcharge(actor, charm) {
  if (actor?.system?.exaltType !== "terrestrial") return 0;
  if (charm?.system?.ability !== "martialarts") return 0;

  const tier = _effectiveMATier(charm);
  if (tier !== "celestial" && tier !== "sidereal") return 0;

  // Mid-initiation into any Dragon Style → +1m on ALL MA charms, including
  // in-aspect and non-elemental ones.
  if (_isInitiatingStyle(actor)) return 1;

  const element = charm?.system?.martialArtsElement;
  // Non-Immaculate celestial MA (no element) always costs +1m for DB.
  if (!element) return 1;

  // In-aspect: DB's caste matches the style's element
  if (actor?.system?.caste === element) return 0;

  // Mastery: actor owns the mastery-granting charm for this element
  const mastered = _masteredElements(actor);
  if (mastered.has(element)) return 0;

  return 1;
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
