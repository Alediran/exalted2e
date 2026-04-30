import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerSubmodules(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Alchemical Submodules", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("permanent submodule with parent installed and essence met → effectivelyActive = true", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-ActivePerm" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Parent Module", type: "charm",
          system: { installed: true, installedSlotType: "general" } },
        { name: "Perm Submod", type: "charm",
          system: { isSubmodule: true, charmType: "permanent", essence: 2 } }
      ]);
      const parent = actor.items.find(i => i.name === "Parent Module");
      const sub    = actor.items.find(i => i.name === "Perm Submod");
      await sub.update({ "system.parentCharmId": parent.id });

      assert.equal(sub.system.effectivelyActive, true);
    });

    it("permanent submodule with parent not installed → effectivelyActive = false", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-ParentOff" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Uninstalled Parent", type: "charm",
          system: { installed: false } },
        { name: "Submod B", type: "charm",
          system: { isSubmodule: true, charmType: "permanent" } }
      ]);
      const parent = actor.items.find(i => i.name === "Uninstalled Parent");
      const sub    = actor.items.find(i => i.name === "Submod B");
      await sub.update({ "system.parentCharmId": parent.id });

      assert.equal(sub.system.effectivelyActive, false);
    });

    it("permanent submodule with essence requirement not met → effectivelyActive = false", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-EssLow" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 2 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Installed Parent C", type: "charm",
          system: { installed: true, installedSlotType: "general" } },
        { name: "Submod C", type: "charm",
          system: { isSubmodule: true, charmType: "permanent", essence: 3 } }
      ]);
      const parent = actor.items.find(i => i.name === "Installed Parent C");
      const sub    = actor.items.find(i => i.name === "Submod C");
      await sub.update({ "system.parentCharmId": parent.id });

      assert.equal(sub.system.requirementsMet, false);
      assert.equal(sub.system.effectivelyActive, false);
    });

    it("supplemental submodule with active = false → effectivelyActive = false", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-InactiveSupp" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Installed Parent D", type: "charm",
          system: { installed: true, installedSlotType: "general" } },
        { name: "Supp Submod D", type: "charm",
          system: { isSubmodule: true, charmType: "supplemental", active: false } }
      ]);
      const parent = actor.items.find(i => i.name === "Installed Parent D");
      const sub    = actor.items.find(i => i.name === "Supp Submod D");
      await sub.update({ "system.parentCharmId": parent.id });

      assert.equal(sub.system.effectivelyActive, false);
    });

    it("supplemental submodule with active = true → effectivelyActive = true", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-ActiveSupp" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Installed Parent E", type: "charm",
          system: { installed: true, installedSlotType: "general" } },
        { name: "Supp Submod E", type: "charm",
          system: { isSubmodule: true, charmType: "supplemental", active: true } }
      ]);
      const parent = actor.items.find(i => i.name === "Installed Parent E");
      const sub    = actor.items.find(i => i.name === "Supp Submod E");
      await sub.update({ "system.parentCharmId": parent.id });

      assert.equal(sub.system.effectivelyActive, true);
    });

    it("activateCharm returns false when submodule is inactive", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-ActGuard" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Uninstalled Parent F", type: "charm",
          system: { installed: false } },
        { name: "Guarded Submod F", type: "charm",
          system: { isSubmodule: true, charmType: "permanent" } }
      ]);
      const parent = actor.items.find(i => i.name === "Uninstalled Parent F");
      const sub    = actor.items.find(i => i.name === "Guarded Submod F");
      await sub.update({ "system.parentCharmId": parent.id });

      const result = await sub.activateCharm();
      assert.equal(result, false);
    });

    it("activateCharm succeeds (does not return false) for permanent submodule with parent installed", async () => {
      const actor = await createTempCharacter({ name: "Q-Submod-ActOk" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Installed Parent G", type: "charm",
          system: { installed: true, installedSlotType: "general" } },
        { name: "Zero-Cost Perm Submod G", type: "charm",
          system: { isSubmodule: true, charmType: "permanent",
                    cost: { motes: 0, willpower: 0, xp: 0 } } }
      ]);
      const parent = actor.items.find(i => i.name === "Installed Parent G");
      const sub    = actor.items.find(i => i.name === "Zero-Cost Perm Submod G");
      await sub.update({ "system.parentCharmId": parent.id });

      const result = await sub.activateCharm();
      assert.equal(result, true);
    });
  });
}
