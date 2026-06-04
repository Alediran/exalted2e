/** Success targets for artifact creation by rating (Oadenol's Codex). */
export const ARTIFACT_SUCCESS_TARGETS = { 1: 5, 2: 10, 3: 20, 4: 40, 5: 60 };

/**
 * Minimum Craft / Lore / Occult ratings required to begin an artifact project
 * of the given rating (Oadenol's Codex, p. 47).
 */
export const ARTIFACT_ABILITY_REQS = {
  1: { craft: 3, lore: 3, occult: 3 },
  2: { craft: 3, lore: 3, occult: 3 },
  3: { craft: 3, lore: 3, occult: 3 },
  4: { craft: 6, lore: 6, occult: 6 },
  5: { craft: 7, lore: 7, occult: 7 },
};

/**
 * Returns the cumulative success target for an artifact of the given rating.
 * @param {number} rating  Artifact rating (1–5)
 */
export function artifactSuccessTarget(rating) {
  return ARTIFACT_SUCCESS_TARGETS[Math.max(1, Math.min(5, rating))] ?? 5;
}

/**
 * Compute the artifact crafting dice pool: chosen attribute + Craft.
 * @param {ExaltedActor} actor
 * @param {string} [attribute="dexterity"]  "dexterity" or "intelligence"
 */
export function artifactPool(actor, attribute = "dexterity") {
  const sys = actor.system;
  return (sys.attributes[attribute]?.value ?? 0)
       + (sys.abilities.craft.value        ?? 0);
}

/**
 * Resolve the outcome of one season's artifact crafting roll.
 *
 * @param {number}  successes  Net successes from this roll
 * @param {boolean} botch      Whether the roll was a botch
 * @param {object}  project    The artifact project record
 * @returns {{ tier: string, newSuccesses: number, completed: boolean }}
 *
 * tier values: "botched" | "setback" | "progress" | "completed"
 */
export function resolveArtifactRoll(successes, botch, project) {
  const current = project.currentSuccesses ?? 0;
  if (botch) {
    const reduced = Math.max(0, current - 5);
    if (current === 0) {
      return { tier: "botched", newSuccesses: 0, completed: false };
    }
    return { tier: "setback", newSuccesses: reduced, completed: false };
  }
  const total  = current + successes;
  const target = project.targetSuccesses;
  if (total >= target) {
    return { tier: "completed", newSuccesses: total, completed: true };
  }
  return { tier: "progress", newSuccesses: total, completed: false };
}

/**
 * Auto-calculate the crafting dice pool for ability-based exalts.
 * Small items:  min(Dex, Per, Int) + Craft
 * Large items:  min(Per, Int) + Craft
 * Lunar/Alchemical actors call this with a manually chosen attrVal instead.
 */
export function craftingPool(actor, size) {
  const { dexterity, perception, intelligence } = actor.system.attributes;
  const craft = actor.system.abilities.craft.value;
  const attr = size === "small"
    ? Math.min(dexterity.value, perception.value, intelligence.value)
    : Math.min(perception.value, intelligence.value);
  return attr + craft;
}

/**
 * Returns true when targetResources exceeds (craft + best specialty),
 * the character's cap on what they can produce without a Charm or stunt.
 */
export function exceedsCraftCap(actor, targetResources) {
  const craft = actor.system.abilities.craft.value;
  const bestSpecialty = Math.max(0, ...(actor.system.abilities.craft.specialties ?? []).map(s => s.value));
  return targetResources > craft + bestSpecialty;
}

/**
 * Compute the difficulty of a crafting project roll.
 * @param {object} project  The crafting project record (targetResources, isPerfect)
 * @returns {number}
 */
export function craftingDifficulty(project) {
  return project.targetResources + (project.isPerfect ? 5 : 0);
}

/**
 * Resolve the outcome of a crafting roll.
 *
 * @param {number}  successes  Net successes from ExaltedRollResult.successes
 * @param {boolean} botch      Whether the roll was a botch
 * @param {object}  project    The crafting project record (targetResources, isPerfect)
 * @returns {{ tier: string, finalResources: number|null, canRetry: boolean }}
 *
 * tier values: "botched" | "failed" | "partial" | "success" | "fine" | "exceptional"
 */
export function resolveOutcome(successes, botch, project) {
  if (botch) {
    return { tier: "botched", finalResources: null, canRetry: false };
  }

  const difficulty  = craftingDifficulty(project);
  const threshold   = successes - difficulty;

  if (threshold < 0) {
    const finalResources = project.targetResources + threshold; // threshold is negative
    if (finalResources < 1) {
      return { tier: "failed", finalResources: null, canRetry: true };
    }
    return { tier: "partial", finalResources, canRetry: true };
  }

  if (threshold >= 5) {
    return { tier: "exceptional", finalResources: Math.min(project.targetResources + 1, 5), canRetry: false };
  }
  if (threshold >= 3) {
    return { tier: "fine", finalResources: project.targetResources, canRetry: false };
  }
  return { tier: "success", finalResources: project.targetResources, canRetry: false };
}

/**
 * Sum the artifact ability reduction granted by all passively-active charms.
 * @param {ExaltedActor} actor
 * @returns {number}
 */
function _artifactAbilityReductionFrom(actor) {
  let total = 0;
  for (const item of (actor.items ?? [])) {
    if (item.type !== "charm") continue;
    const dur = item.system?.duration;
    const type = item.system?.charmType;
    const active = item.system?.active;
    if (dur !== "permanent" && type !== "permanent" && !active) continue;
    const r = item.system?.artifactAbilityReduction;
    if (!r?.enabled) continue;
    total += r.reduction ?? 0;
  }
  return total;
}

/**
 * Returns the effective Craft / Lore / Occult minimums for an artifact of the
 * given rating, after applying any charm-based reduction.
 * @param {ExaltedActor} actor
 * @param {number}       rating  1–5
 * @returns {{ craft: number, lore: number, occult: number }}
 */
export function effectiveArtifactAbilityReqs(actor, rating) {
  const base = ARTIFACT_ABILITY_REQS[Math.max(1, Math.min(5, rating))] ?? ARTIFACT_ABILITY_REQS[5];
  const reduction = _artifactAbilityReductionFrom(actor);
  return {
    craft:  Math.max(0, base.craft  - reduction),
    lore:   Math.max(0, base.lore   - reduction),
    occult: Math.max(0, base.occult - reduction),
  };
}

/**
 * Returns true when the actor meets the (possibly charm-reduced) ability
 * minimums for crafting an artifact of the given rating.
 * @param {ExaltedActor} actor
 * @param {number}       rating  1–5
 * @returns {boolean}
 */
export function meetsArtifactAbilityReqs(actor, rating) {
  const reqs = effectiveArtifactAbilityReqs(actor, rating);
  const sys  = actor.system;
  return (sys.abilities.craft.value  ?? 0) >= reqs.craft
      && (sys.abilities.lore.value   ?? 0) >= reqs.lore
      && (sys.abilities.occult.value ?? 0) >= reqs.occult;
}

/** Workshop quality → dice-pool modifier (Oadenol's Codex). */
export const WORKSHOP_DICE_MOD = {
  rudimentary: -4,
  basic:       -2,
  masters:      0,
  flawless:     2,
  ideal:        4,
};

/** Dice modifier for a workshop tier; unknown/blank → 0. */
export function workshopDiceMod(level) {
  return WORKSHOP_DICE_MOD[level] ?? 0;
}

/**
 * Effective workshop dice modifier after the Words-as-Workshop Method waiver,
 * which floors the workshop at Master's (0) but never lowers a real bonus.
 */
export function effectiveWorkshopMod(level, { wordsAsWorkshop = false } = {}) {
  const mod = workshopDiceMod(level);
  return wordsAsWorkshop ? Math.max(mod, 0) : mod;
}

/**
 * Bonus successes contributed by crafting assistants (Oadenol's Codex).
 *   mortalAides     +1 per 5
 *   lesserArtisans  +1 per 2   (1st-circle demons, DB, Terrestrial gods, elementals, common Fair Folk)
 *   greaterArtisans +4 each    (2nd-circle demons, Celestial Exalted/gods, Fair Folk nobles, Deathlords)
 *   mightyArtisans  +6 each    (3rd-circle demon, Incarna, powerful hekatonkhire)
 * @param {object} [a]
 * @returns {number}
 */
export function assistantBonusSuccesses(a) {
  if (!a) return 0;
  return Math.floor((a.mortalAides ?? 0) / 5)
       + Math.floor((a.lesserArtisans ?? 0) / 2)
       + (a.greaterArtisans ?? 0) * 4
       + (a.mightyArtisans ?? 0) * 6;
}

/**
 * Returns the active/permanent charm granting Words-as-Workshop Method, or null.
 * Mirrors the active/permanent detection used by _artifactAbilityReductionFrom.
 * @param {ExaltedActor} actor
 * @returns {Item|null}
 */
export function actorHasWordsAsWorkshop(actor) {
  for (const item of (actor?.items ?? [])) {
    if (item.type !== "charm") continue;
    const dur    = item.system?.duration;
    const type   = item.system?.charmType;
    const active = item.system?.active;
    if (dur !== "permanent" && type !== "permanent" && !active) continue;
    if (item.system?.wordsAsWorkshop === true) return item;
  }
  return null;
}
