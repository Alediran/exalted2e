import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { register }            from "../_helpers/cleanup.mjs";

async function createTempHearthstone(actor, { name = "Quench Stone", rating = 3 } = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "hearthstone",
    system: { rating }
  }]);
  register(item);
  return item;
}

async function createTempArtifactWeapon(actor, { hearthstoneSlots = 1 } = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: "Quench Artifact Weapon",
    type: "weapon",
    system: {
      modes:            [{ name: "Standard", accuracy: 2, damage: 5, rate: 3, speed: 5, damageType: "lethal", tags: [], range: 0, minStrength: 0, minDexterity: 0, minMartialArts: 0 }],
      artifact:         true,
      attuned:          false,
      attunementCost:   0,
      hearthstoneSlots,
      hearthstones:     []
    }
  }]);
  register(item);
  return item;
}

export function registerHearthstone(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("hearthstone socketing and mote regen", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[HS-1] socketing a hearthstone into a weapon contributes 2×rating mote regen", async () => {
      const actor  = await createTempCharacter({ name: "Q-HS-1" });
      const weapon = await createTempArtifactWeapon(actor, { hearthstoneSlots: 1 });
      const stone  = await createTempHearthstone(actor, { rating: 3 });

      const stones = foundry.utils.deepClone(weapon.system.hearthstones ?? []);
      stones[0] = stone.id;
      await weapon.update({ "system.hearthstones": stones });

      assert.equal(actor.system.hearthstoneMoteRegen, 6);
    });

    it("[HS-2] unsocketing resets regen to 0", async () => {
      const actor  = await createTempCharacter({ name: "Q-HS-2" });
      const weapon = await createTempArtifactWeapon(actor, { hearthstoneSlots: 1 });
      const stone  = await createTempHearthstone(actor, { rating: 2 });

      await weapon.update({ "system.hearthstones": [stone.id] });
      assert.equal(actor.system.hearthstoneMoteRegen, 4);

      await weapon.update({ "system.hearthstones": [""] });
      assert.equal(actor.system.hearthstoneMoteRegen, 0);
    });

    it("[HS-3] two stones across two artifacts sum correctly", async () => {
      const actor   = await createTempCharacter({ name: "Q-HS-3" });
      const weapon1 = await createTempArtifactWeapon(actor, { hearthstoneSlots: 1 });
      const weapon2 = await createTempArtifactWeapon(actor, { hearthstoneSlots: 1 });
      const stone1  = await createTempHearthstone(actor, { rating: 1 });
      const stone2  = await createTempHearthstone(actor, { rating: 4 });

      await weapon1.update({ "system.hearthstones": [stone1.id] });
      await weapon2.update({ "system.hearthstones": [stone2.id] });

      assert.equal(actor.system.hearthstoneMoteRegen, 10);
    });

    it("[HS-4] a stone not in any artifact slot does not contribute regen", async () => {
      const actor = await createTempCharacter({ name: "Q-HS-4" });
      await createTempHearthstone(actor, { rating: 5 });
      assert.equal(actor.system.hearthstoneMoteRegen, 0);
    });
  });
}
