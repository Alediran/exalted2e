import { sweep }             from "../_helpers/cleanup.mjs";
import { assertTestWorld }   from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { exceedsCraftCap }   from "../../../module/helpers/crafting-helpers.mjs";

export function registerCrafting(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("crafting projects — data layer", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[CR-1] new project is appended with correct fields", async () => {
      const actor = await createTempCharacter({ name: "Crafting Test Actor" });

      const projects = foundry.utils.deepClone(actor.system.craftingProjects ?? []);
      projects.push({
        id:              "cr1-test-id",
        name:            "Exceptional Straight Sword",
        size:            "small",
        targetResources: 3,
        isPerfect:       false,
        bonusDice:       0,
        status:          "active"
      });
      await actor.update({ "system.craftingProjects": projects });

      const stored = actor.system.craftingProjects;
      assert.equal(stored.length, 1, "one project stored");
      assert.equal(stored[0].name, "Exceptional Straight Sword");
      assert.equal(stored[0].size, "small");
      assert.equal(stored[0].targetResources, 3);
      assert.equal(stored[0].bonusDice, 0);
      assert.equal(stored[0].status, "active");
    });

    it("[CR-2] only non-excellency craft charms pass the dialog filter", async () => {
      const actor = await createTempCharacter({ name: "Crafting Charm Actor" });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Fire-Forged Excellence", type: "charm", system: { ability: "craft", excellency: "" } },
        { name: "Melee Charm",            type: "charm", system: { ability: "melee", excellency: "" } },
        { name: "Craft Excellency",       type: "charm", system: { ability: "craft", excellency: "first" } },
      ]);

      const craftCharms = actor.items.filter(
        i => i.type === "charm"
          && i.system.ability === "craft"
          && i.system.excellency !== "first"
          && i.system.excellency !== "second"
          && i.system.excellency !== "third"
      );
      assert.equal(craftCharms.length, 1, "only one non-excellency craft charm passes the filter");
      assert.equal(craftCharms[0].name, "Fire-Forged Excellence");
    });

    it("[CR-3] retry path writes bonusDice to project, status stays active", async () => {
      const actor = await createTempCharacter({ name: "Crafting Retry Actor" });

      await actor.update({
        "system.craftingProjects": [{
          id: "cr3-id", name: "Longbow", size: "large",
          targetResources: 2, isPerfect: false, bonusDice: 0, status: "active"
        }]
      });

      const cloned = foundry.utils.deepClone(actor.system.craftingProjects);
      const idx = cloned.findIndex(p => p.id === "cr3-id");
      cloned[idx].bonusDice = 1;
      cloned[idx].status    = "active";
      await actor.update({ "system.craftingProjects": cloned });

      const updated = actor.system.craftingProjects.find(p => p.id === "cr3-id");
      assert.equal(updated.bonusDice, 1, "bonusDice updated to last successes");
      assert.equal(updated.status, "active", "status remains active after retry");
    });

    it("[CR-4] complete path sets status to completed", async () => {
      const actor = await createTempCharacter({ name: "Crafting Complete Actor" });

      await actor.update({
        "system.craftingProjects": [{
          id: "cr4-id", name: "Fine Dagger", size: "small",
          targetResources: 2, isPerfect: false, bonusDice: 0, status: "active"
        }]
      });

      const cloned = foundry.utils.deepClone(actor.system.craftingProjects);
      cloned[0].status = "completed";
      await actor.update({ "system.craftingProjects": cloned });

      assert.equal(actor.system.craftingProjects[0].status, "completed", "status set to completed");
    });

    it("[CR-5] exceedsCraftCap returns true when targetResources exceeds craft + specialty", async () => {
      const actor = await createTempCharacter({ name: "Crafting Cap Actor" });
      await actor.update({ "system.abilities.craft.value": 2 });

      assert.isTrue(exceedsCraftCap(actor, 4),  "cap exceeded when craft=2, targetResources=4");
      assert.isFalse(exceedsCraftCap(actor, 2), "cap not exceeded when craft=2, targetResources=2");
    });
  });
}
