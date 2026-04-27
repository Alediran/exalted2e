/**
 * Compute First/Second Excellency dice/success caps for an attacker rolling
 * (attribute + ability + …). RAW caps differ by exalt type:
 *
 *   - Solar / Sidereal / Abyssal / Infernal: attr + abil
 *   - Lunar / Alchemical:                    attr (attribute-keyed)
 *   - Terrestrial:                           abil + best applicable specialty
 *   - Mortal / unknown:                      0
 *
 * Second Excellency cap is ceil(firstCap / 2).
 *
 * Used by both rollAttack (physical) and rollSocialAttack. The Terrestrial
 * branch is RAW-correct here; pre-3c-1 the physical pipeline mistakenly
 * treated Terrestrial as default (attr + abil). See project memory
 * `project_terrestrial_excellency_cap.md`.
 *
 * @param {object} actor    - Foundry actor-shaped object with `.system.exaltType`,
 *                            `.system.attributes[attribute].value`,
 *                            `.system.abilities[ability].value`,
 *                            `.system.abilities[ability].specialties[]` (Terrestrials only).
 * @param {string} attribute - e.g. "charisma", "manipulation", "dexterity"
 * @param {string} ability   - e.g. "presence", "melee"
 * @returns {{firstExcMax: number, secondExcMax: number}}
 */
export function computeAttackExcellencyCaps(actor, attribute, ability) {
  const sys = actor?.system;
  if (!sys) return { firstExcMax: 0, secondExcMax: 0 };

  const exaltType = sys.exaltType ?? "";
  const attrVal   = sys.attributes?.[attribute]?.value ?? 0;
  const abilVal   = sys.abilities?.[ability]?.value    ?? 0;

  let cap = 0;
  switch (exaltType) {
    case "lunar":
    case "alchemical":
      cap = attrVal;                                // attribute-keyed; ability not theirs
      break;
    case "terrestrial": {
      const specs = sys.abilities?.[ability]?.specialties ?? [];
      const bestSpec = specs.reduce((m, s) => Math.max(m, s?.value ?? 0), 0);
      cap = abilVal + bestSpec;                     // ability + specialty; NO attribute
      break;
    }
    case "solar":
    case "sidereal":
    case "abyssal":
    case "infernal":
      cap = attrVal + abilVal;
      break;
    default:
      cap = 0;                                      // mortal / unknown
      break;
  }

  return { firstExcMax: cap, secondExcMax: Math.ceil(cap / 2) };
}
