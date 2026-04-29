import { describe, it, expect, vi } from "vitest";
import { ExaltedActor } from "../../module/documents/actor.mjs";

/**
 * Build a synthetic actor whose `_preUpdate` we can call directly via prototype.
 * Includes the read-side surface the method consumes plus `update` and the
 * underlying system data with attribute caste/favored fields.
 */
function makeFakeActor({
  exaltType = "solar",
  caste     = "",
  attributes = null,
  abilities  = null,
  system     = {}
} = {}) {
  const allAttrs = ["strength","dexterity","stamina","charisma","manipulation","appearance","perception","intelligence","wits"];
  const attrs = {};
  for (const k of allAttrs) {
    attrs[k] = { value: 1, caste: false, favored: false };
  }
  if (attributes) Object.assign(attrs, attributes);
  return {
    type: "character",
    system: {
      exaltType,
      caste,
      attributes: attrs,
      abilities:  abilities ?? {},
      virtues: {
        compassion: { value: 1, current: 1 },
        conviction: { value: 1, current: 1 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 1, current: 1 }
      },
      willpower: { value: 5, max: 10 },
      purchaseLocked: false,
      ...system
    }
  };
}

describe("ExaltedActor._preUpdate caste auto-assign", () => {
  it("Lunar fullMoon caste sets caste:true on Str/Dex/Sta and false on others", async () => {
    const actor = makeFakeActor({ exaltType: "lunar" });
    const changed = { system: { caste: "full" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.attributes.strength.caste).toBe(true);
    expect(changed.system.attributes.dexterity.caste).toBe(true);
    expect(changed.system.attributes.stamina.caste).toBe(true);
    expect(changed.system.attributes.charisma.caste).toBe(false);
    expect(changed.system.attributes.appearance.caste).toBe(false);
    expect(changed.system.attributes.wits.caste).toBe(false);
  });

  it("Lunar caste switch (full → changing) clears prior physical flags", async () => {
    const actor = makeFakeActor({
      exaltType: "lunar", caste: "full",
      attributes: {
        strength:  { value: 3, caste: true,  favored: false },
        dexterity: { value: 3, caste: true,  favored: false },
        stamina:   { value: 3, caste: true,  favored: false }
      }
    });
    const changed = { system: { caste: "changing" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.attributes.strength.caste).toBe(false);
    expect(changed.system.attributes.dexterity.caste).toBe(false);
    expect(changed.system.attributes.stamina.caste).toBe(false);
    expect(changed.system.attributes.charisma.caste).toBe(true);
    expect(changed.system.attributes.manipulation.caste).toBe(true);
    expect(changed.system.attributes.appearance.caste).toBe(true);
  });

  it("Lunar Casteless clears all attribute caste flags", async () => {
    const actor = makeFakeActor({
      exaltType: "lunar", caste: "no",
      attributes: {
        perception:   { value: 3, caste: true, favored: false },
        intelligence: { value: 3, caste: true, favored: false },
        wits:         { value: 3, caste: true, favored: false }
      }
    });
    const changed = { system: { caste: "casteless" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    for (const k of ["strength","dexterity","stamina","charisma","manipulation","appearance","perception","intelligence","wits"]) {
      expect(changed.system.attributes[k].caste).toBe(false);
    }
  });

  it("Caste change preserves user-set favored flag", async () => {
    const actor = makeFakeActor({
      exaltType: "lunar",
      attributes: {
        strength: { value: 3, caste: false, favored: true }
      }
    });
    const changed = { system: { caste: "no" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.attributes.strength.caste).toBe(false);
    // favored is NOT in the caste auto-assign payload — preserved (undefined in changed.system)
    expect(changed.system.attributes.strength.favored).toBeUndefined();
  });

  it("Alchemical Adamant sets caste:true on Str/App/Per", async () => {
    const actor = makeFakeActor({ exaltType: "alchemical" });
    const changed = { system: { caste: "adamant" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    expect(changed.system.attributes.strength.caste).toBe(true);
    expect(changed.system.attributes.appearance.caste).toBe(true);
    expect(changed.system.attributes.perception.caste).toBe(true);
    expect(changed.system.attributes.dexterity.caste).toBe(false);
    expect(changed.system.attributes.charisma.caste).toBe(false);
  });

  it("Solar caste change still rewrites ABILITY flags (existing behavior)", async () => {
    const actor = makeFakeActor({
      exaltType: "solar",
      abilities: {
        archery:   { value: 3, caste: false, favored: false },
        athletics: { value: 3, caste: false, favored: false },
        melee:     { value: 3, caste: false, favored: false },
        presence:  { value: 3, caste: false, favored: false },
        thrown:    { value: 3, caste: false, favored: false },
        war:       { value: 3, caste: false, favored: false }
      }
    });
    const changed = { system: { caste: "dawn" } };
    await ExaltedActor.prototype._preUpdate.call(actor, changed, {}, "user-id");
    // Sanity: Dawn caste covers warriorGroup ⊃ {archery, melee, war, ...}
    expect(changed.system.abilities.archery.caste).toBe(true);
    expect(changed.system.abilities.melee.caste).toBe(true);
    expect(changed.system.abilities.war.caste).toBe(true);
    // ATTRIBUTE caste flags should NOT be touched for ability-based exalts
    expect(changed.system.attributes?.strength?.caste).toBeUndefined();
  });
});
