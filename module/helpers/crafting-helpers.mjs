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
