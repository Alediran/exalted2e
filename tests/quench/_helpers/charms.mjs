import { register } from "./cleanup.mjs";

/**
 * Create a temporary charm Item embedded on the given actor.
 *
 * Sparse-override pattern. The cost block matches CharmData's actual
 * field names (`bashingHealth` / `lethalHealth` / `aggravatedHealth` —
 * NOT `health.bashing` / `health.lethal`).
 *
 * The optional `attack` parameter accepts a partial weapon-mode-shaped
 * object. Any provided fields override the StringField defaults; numbers
 * get coerced to strings (CharmData's attack stats are StringFields so
 * they can carry formulas like "@str + @essence / 2"). Setting `attack`
 * implies `attack.enabled = true` unless the caller explicitly says
 * otherwise.
 *
 * Auto-registered for cleanup via `register(item)`.
 *
 * @param {Actor} actor — owner; charm embedded via createEmbeddedDocuments
 * @returns {Promise<Item>} the created charm Item
 */
export async function createTempCharm(actor, {
  name        = "Quench Charm",
  charmType   = "supplemental",         // "simple" | "supplemental" | "reflexive"
  duration    = "instant",              // "instant" | "oneScene" | "indefinite" | ...
  keywords    = [],
  ability     = "melee",
  excellency  = "",                     // "" | "first" | "second" | "third"
  essence     = 1,
  minAbility  = 1,
  speed       = 6,
  steps       = [],
  // Cost block — fields match CharmData.cost schema exactly
  cost        = {},
  // Attack block — partial override; any provided field overrides the
  // StringField default. Non-string values are coerced via String().
  attack      = null
} = {}) {
  // If caller passes { formula }, use it directly.
  // Otherwise synthesise a formula from the legacy individual fields.
  let costFormula = cost.formula ?? "";
  if (!costFormula) {
    const parts = [];
    if (cost.motes > 0)            parts.push(`${cost.motes}m`);
    if (cost.willpower > 0)        parts.push(`${cost.willpower}wp`);
    if (cost.bashingHealth > 0)    parts.push(`${cost.bashingHealth}bhl`);
    if (cost.lethalHealth > 0)     parts.push(`${cost.lethalHealth}lhl`);
    if (cost.aggravatedHealth > 0) parts.push(`${cost.aggravatedHealth}ahl`);
    if (cost.xp > 0)               parts.push(`${cost.xp}xp`);
    if (cost.permanentEssence > 0) parts.push("perm ess");
    if (cost.permanentWillpower > 0) parts.push("perm wp");
    costFormula = parts.join(", ") || "—";
  }
  const fullCost = { formula: costFormula };

  const system = {
    cost: fullCost,
    charmType, duration, keywords, ability, excellency,
    essence, minAbility, speed, steps
  };

  if (attack) {
    const tags = attack.tags ?? [];
    // Coerce numbers → strings so the test ergonomics stay nice while
    // honoring the StringField schema. Skip undefined keys so we don't
    // overwrite the schema's initial values.
    const sStr = v => v === undefined ? undefined : String(v);
    const built = {
      enabled:        attack.enabled        ?? true,
      name:           attack.name           ?? "",
      speed:          sStr(attack.speed),
      accuracy:       sStr(attack.accuracy),
      damage:         sStr(attack.damage),
      damageType:     attack.damageType     ?? "lethal",
      overwhelming:   sStr(attack.overwhelming),
      defense:        sStr(attack.defense),
      rate:           sStr(attack.rate),
      range:          sStr(attack.range),
      minStrength:    sStr(attack.minStrength),
      minDexterity:   sStr(attack.minDexterity),
      minMartialArts: sStr(attack.minMartialArts),
      tags
    };
    // Drop undefined keys so the schema initials win for unspecified fields.
    for (const k of Object.keys(built)) {
      if (built[k] === undefined) delete built[k];
    }
    system.attack = built;
  }

  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "charm",
    system
  }]);
  register(item);
  return item;
}
