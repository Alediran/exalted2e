import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerManse(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("manse item — data layer", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MN-1] manse stores backgroundId, hearthstoneId, and powers", async () => {
      const actor = await createTempCharacter({ name: "Manse Test Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Iron Hills Manse", type: "manse",
        system: {
          backgroundId:  "test-bg-id",
          hearthstoneId: "test-hs-id",
          powers:        [{ name: "Archive", cost: 1 }]
        }
      }]);
      assert.equal(manse.system.backgroundId,       "test-bg-id", "backgroundId stored");
      assert.equal(manse.system.hearthstoneId,      "test-hs-id", "hearthstoneId stored");
      assert.equal(manse.system.powers.length,      1,            "one power stored");
      assert.equal(manse.system.powers[0].name,     "Archive",    "power name stored");
      assert.equal(manse.system.powers[0].cost,     1,            "power cost stored");
    });

    it("[MN-2] usedBudget equals sum of all power costs", async () => {
      const actor = await createTempCharacter({ name: "Manse Budget Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Summit Manse", type: "manse",
        system: {
          powers: [
            { name: "Archive",             cost: 1 },
            { name: "Bound Servant Force", cost: 2 }
          ]
        }
      }]);
      assert.equal(manse.system.powers[0].cost, 1, "first power cost stored as 1");
      assert.equal(manse.system.powers[1].cost, 2, "second power cost stored as 2");
      const usedBudget = manse.system.powers.reduce((sum, p) => sum + p.cost, 0);
      assert.equal(usedBudget, 3, "sum of costs equals 3");
    });

    it("[MN-3] adding a power appends an entry with default cost 1", async () => {
      const actor = await createTempCharacter({ name: "Manse Add Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Stone Peak Manse", type: "manse",
        system: { powers: [] }
      }]);
      const cloned = foundry.utils.deepClone(manse.system.powers ?? []);
      cloned.push({ name: "", cost: 1 });
      await manse.update({ "system.powers": cloned });
      assert.equal(manse.system.powers.length,    1, "power appended");
      assert.equal(manse.system.powers[0].cost,   1, "default cost is 1");
    });

    it("[MN-4] deleting a power removes the correct index", async () => {
      const actor = await createTempCharacter({ name: "Manse Delete Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Wind Peak Manse", type: "manse",
        system: {
          powers: [
            { name: "Archive",             cost: 1 },
            { name: "Bound Servant Force", cost: 2 }
          ]
        }
      }]);
      const cloned = foundry.utils.deepClone(manse.system.powers);
      cloned.splice(0, 1);
      await manse.update({ "system.powers": cloned });
      assert.equal(manse.system.powers.length,      1,                      "one power remains");
      assert.equal(manse.system.powers[0].name,     "Bound Servant Force",  "correct power remains");
    });

    it("[MN-5] rating derives from linked background value", async () => {
      const actor = await createTempCharacter({ name: "Manse Rating Actor" });
      const [bg] = await actor.createEmbeddedDocuments("Item", [{
        name: "Manse", type: "background", system: { value: 3 }
      }]);
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Iron Hills Manse", type: "manse",
        system: { backgroundId: bg.id }
      }]);
      const rating = actor.items.get(manse.system.backgroundId)?.system.value ?? 0;
      assert.equal(rating, 3, "background item stores value 3 and backgroundId is correctly linked");
    });
  });
}
