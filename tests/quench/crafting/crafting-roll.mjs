import { sweep }             from "../_helpers/cleanup.mjs";
import { assertTestWorld }   from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { exceedsCraftCap }   from "../../../module/helpers/crafting-helpers.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { const ok = await predicate(); if (ok) return ok; await new Promise(r => setTimeout(r, intervalMs)); }
  throw new Error("waitFor: timed out");
}

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

  describe("Crafting workshop & assistants", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[CW-1] workshop + assistants persist on a crafting project", async () => {
      const actor = await createTempCharacter({ name: "Q-CW-Persist" });
      await actor.update({ "system.craftingProjects": [{
        id: "p1", name: "Sword", size: "small", targetResources: 2, status: "active",
        workshop: "basic", assistants: { mortalAides: 10, lesserArtisans: 0, greaterArtisans: 0, mightyArtisans: 0 },
      }]});
      const p = actor.system.craftingProjects[0];
      assert.equal(p.workshop, "basic", "workshop persisted");
      assert.equal(p.assistants.mortalAides, 10, "assistants persisted");
    });

    it("[CW-2] actorHasWordsAsWorkshop detects an active charm, ignores an inactive one", async () => {
      const actor = await createTempCharacter({ name: "Q-CW-Waiver" });
      const { actorHasWordsAsWorkshop } = await import("../../../module/helpers/crafting-helpers.mjs");
      await actor.createEmbeddedDocuments("Item", [{
        name: "Dormant WaW", type: "charm",
        system: { ability: "craft", duration: "instant", wordsAsWorkshop: true, active: false }
      }]);
      assert.equal(actorHasWordsAsWorkshop(actor), null, "inactive instant charm not detected");
      const [perm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Words-as-Workshop Method", type: "charm",
        system: { ability: "craft", duration: "permanent", wordsAsWorkshop: true }
      }]);
      const found = actorHasWordsAsWorkshop(actor);
      assert.ok(found, "permanent WaW charm detected");
      assert.equal(found.id, perm.id, "returns the permanent charm");
    });

    it("[CW-3] artifact ingredients soft-warn: declining aborts the roll", async () => {
      const actor = await createTempCharacter({ name: "Q-CW-Warn" });
      await actor.update({ "system.exaltType": "solar", "system.artifactProjects": [{
        id: "a1", name: "Daiklave", rating: 2, hasIngredients: false,
        targetSuccesses: 10, currentSuccesses: 0, status: "active",
      }]});

      const { ArtifactCraftingDialog } = await import("../../../module/dialogs/artifact-crafting-dialog.mjs");
      const origOpen    = ArtifactCraftingDialog.open;
      const origConfirm = foundry.applications.api.DialogV2.confirm;
      let opened = false, confirmCalled = false;
      ArtifactCraftingDialog.open = async () => { opened = true; };
      foundry.applications.api.DialogV2.confirm = async () => { confirmCalled = true; return false; };
      try {
        await actor.sheet.render(true);
        await waitFor(() => actor.sheet.rendered && !!actor.sheet.element);
        const btn = await waitFor(() => actor.sheet.element.querySelector("[data-action='rollArtifactProject'][data-project-id='a1']"));
        btn.click();
        await waitFor(() => confirmCalled);
        assert.ok(confirmCalled, "confirm shown for missing ingredients");
        assert.equal(opened, false, "declining aborted before opening the craft dialog");
      } finally {
        ArtifactCraftingDialog.open = origOpen;
        foundry.applications.api.DialogV2.confirm = origConfirm;
        await actor.sheet.close();
      }
    });
  });
}
