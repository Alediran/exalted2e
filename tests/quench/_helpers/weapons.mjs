import { register } from "./cleanup.mjs";

/**
 * Create a temporary weapon Item embedded on the given actor.
 *
 * Sparse-override pattern: when `modes` is not provided, build a single
 * mode from the inline params (accuracy / damage / range / defense /
 * rate / speed / damageType / tags). Persisted fields, not derived —
 * `accuracy: 2` becomes `system.modes[0].accuracy = 2`, and
 * prepareDerivedData will compute `effectiveAccuracy` from it (plus
 * material bonuses, wielder penalty, etc.) on read.
 *
 * Top-level fields control attunement and the charm-source plumbing
 * (so Sub-project B's weapon-artifact tests can assert flag presence
 * without spawning a charm first).
 *
 * Auto-registered for cleanup via `register(item)`.
 *
 * @param {Actor} actor — owner; weapon embedded via createEmbeddedDocuments
 * @returns {Promise<Item>} the created weapon Item
 */
export async function createTempWeapon(actor, {
  name             = "Quench Weapon",
  modes            = null,
  // Single-mode sparse overrides (only used when `modes` is null)
  modeName         = "Standard",
  accuracy         = 2,
  damage           = 5,
  range            = 0,            // 0 = melee
  defense          = 0,
  rate             = 3,
  speed            = 5,
  damageType       = "lethal",
  tags             = [],
  minStrength      = 0,
  minDexterity     = 0,
  minMartialArts   = 0,
  // Top-level weapon fields
  artifact              = false,
  attuned               = false,
  attunementCost        = 0,
  attunementMotesCover  = 0,
  attunedViaAttunement  = false,
  magicalMaterial       = "",
  equipped              = true,
  // Charm-source plumbing (mirrors what _spawnCharmWeaponArtifacts /
  // _rollCharmInstantAttack stamp on real charm-spawned weapons).
  charmSource      = null,
  charmDuration    = null
} = {}) {
  const builtModes = modes ?? [{
    name: modeName, accuracy, damage, range, defense, rate, speed,
    damageType, tags,
    minStrength, minDexterity, minMartialArts
  }];

  const flags = {};
  if (charmSource || charmDuration) {
    flags.exalted2e = {};
    if (charmSource)   flags.exalted2e.charmSource   = charmSource;
    if (charmDuration) flags.exalted2e.charmDuration = charmDuration;
  }

  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "weapon",
    flags,
    system: {
      modes: builtModes,
      artifact, attuned, attunementCost, attunementMotesCover,
      attunedViaAttunement, magicalMaterial, equipped
    }
  }]);
  register(item);
  return item;
}
