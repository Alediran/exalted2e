/** Unarmed natural-attack weapon item data. Foundry-bound (uses game.i18n). */
export function unarmedWeaponData() {
  return {
    name: game.i18n.localize("EX2E.UnarmedAttacks"),
    type: "weapon",
    flags: { exalted2e: { unarmed: true } },
    system: {
      equipped: true,
      artifact: false,
      modes: [
        {
          name: game.i18n.localize("EX2E.UnarmedClinch"),
          speed: 6, accuracy: 0, damage: 0, damageType: "bashing",
          overwhelming: 1, defense: 0, rate: 1, range: 0,
          minStrength: 1, minDexterity: 0, minMartialArts: 0,
          tags: ["Clinch", "Natural", "Piercing"]
        },
        {
          name: game.i18n.localize("EX2E.UnarmedKick"),
          speed: 5, accuracy: 0, damage: 3, damageType: "bashing",
          overwhelming: 1, defense: -2, rate: 2, range: 0,
          minStrength: 1, minDexterity: 2, minMartialArts: 0,
          tags: ["Natural"]
        },
        {
          name: game.i18n.localize("EX2E.UnarmedPunch"),
          speed: 5, accuracy: 1, damage: 0, damageType: "bashing",
          overwhelming: 1, defense: 2, rate: 3, range: 0,
          minStrength: 1, minDexterity: 0, minMartialArts: 0,
          tags: ["Natural"]
        }
      ]
    }
  };
}
