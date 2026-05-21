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
