import { evaluateCharmFormula } from "./item.mjs";

/**
 * Shape a charm's attack config into a weapon-item creation payload.
 *
 * Pure: the caller gathers all dependencies (the charm's attack subobject,
 * its display fields, its duration flag, and the roll data needed to
 * resolve formula stats) and the helper produces the createDocument-shaped
 * object.
 *
 * `attack.name` falls back to the charm's `name` when blank or missing.
 * Numeric fields run through `evaluateCharmFormula` with documented per-
 * field fallbacks (5/0/1/lethal/1/0/1/0/0/0/0).
 *
 * @param {object} args
 * @param {object} [args.attack] - Charm `system.attack` subobject
 * @param {string} args.name - Charm display name (used when attack.name blank)
 * @param {string} [args.img] - Charm image path; falls back to a sword icon
 * @param {string} args.id - Charm document id (stamped onto flags.charmSource)
 * @param {string} [args.duration] - Charm duration ("instant" / longer)
 * @param {object} [args.rollData] - Roll-data map for formula resolution
 * @returns {object} createDocument payload for an Item of type "weapon"
 */
export function buildCharmWeaponData({ attack, name, img, id, duration, rollData }) {
  const a = attack ?? {};
  const displayName = a.name?.trim() ? a.name : name;
  const data = rollData ?? {};
  const num = (formula, fallback = 0) => evaluateCharmFormula(formula, data, fallback);

  return {
    name: displayName,
    type: "weapon",
    img:  img || "icons/svg/sword.svg",
    flags: { exalted2e: {
      charmSource:   id,
      charmDuration: duration
    } },
    system: {
      equipped:  false,
      artifact:  false,
      modes: [{
        name:           displayName,
        speed:          num(a.speed,          5),
        accuracy:       num(a.accuracy,       0),
        damage:         num(a.damage,         1),
        damageType:     a.damageType     ?? "lethal",
        overwhelming:   num(a.overwhelming,   1),
        defense:        num(a.defense,        0),
        rate:           num(a.rate,           1),
        range:          num(a.range,          0),
        minStrength:    num(a.minStrength,    0),
        minDexterity:   num(a.minDexterity,   0),
        minMartialArts: num(a.minMartialArts, 0),
        tags:           [...(a.tags ?? [])]
      }]
    }
  };
}
