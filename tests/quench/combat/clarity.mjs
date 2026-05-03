import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out`);
}

export function registerClarity(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Alchemical Clarity & Module Installation", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── Clarity derived data ─────────────────────────────────────────────

    it("[127] permanent Clarity = 0 for Essence 5 Alchemical with no Exemplar Charms", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Base" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 5 });
      assert.equal(actor.system.splat.alchemical.clarity.permanent, 0);
    });

    it("[128] permanent Clarity = 1 for Essence 6 Alchemical", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Ess6" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 6 });
      assert.equal(actor.system.splat.alchemical.clarity.permanent, 1);
    });

    it("[129] permanent Clarity increases when an Exemplar Charm is installed", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Exemplar" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 5 });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Exemplar Module",
        type: "charm",
        system: { keywords: ["Exemplar"], installed: true, installedSlotType: "general" }
      }]);

      // prepareDerivedData is called automatically after the item is created
      assert.equal(actor.system.splat.alchemical.clarity.permanent, 1);
    });

    it("[130] permanent Clarity decreases when an Exemplar Charm is uninstalled", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Uninstall" });
      await actor.update({ "system.exaltType": "alchemical", "system.essence.value": 5 });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Exemplar Module",
        type: "charm",
        system: { keywords: ["Exemplar"], installed: true, installedSlotType: "general" }
      }]);
      const charm = actor.items.find(i => i.name === "Exemplar Module");
      assert.equal(actor.system.splat.alchemical.clarity.permanent, 1, "starts with 1 permanent");

      await charm.update({ "system.installed": false, "system.installedSlotType": "" });
      assert.equal(actor.system.splat.alchemical.clarity.permanent, 0, "drops to 0 after uninstall");
    });

    it("[131] clarityModifiers.socialPenalty = 1 at Clarity 3", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Band34" });
      await actor.update({
        "system.exaltType":   "alchemical",
        "system.limit": 3
      });
      assert.equal(actor.system.clarityModifiers.socialPenalty, 1);
    });

    it("[132] clarityModifiers.compassionAutoFail = true at Clarity 10", async () => {
      const actor = await createTempCharacter({ name: "Q-Clarity-Band10" });
      await actor.update({
        "system.exaltType":   "alchemical",
        "system.limit": 10
      });
      assert.equal(actor.system.clarityModifiers.compassionAutoFail, true);
    });

    // ── Module installation ──────────────────────────────────────────────

    it("[133] installing a non-caste Charm uses a general slot", async () => {
      const actor = await createTempCharacter({ name: "Q-Module-General" });
      await actor.update({ "system.exaltType": "alchemical" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Generic Module",
        type: "charm",
        system: { ability: "strength", essenceCommitment: 0 }
      }]);
      const charm = actor.items.find(i => i.name === "Generic Module");

      // strength is not caste/favored by default → general slot
      await actor.installCharm(charm.id);

      assert.equal(charm.system.installed, true);
      assert.equal(charm.system.installedSlotType, "general");
      assert.equal(actor.system.generalSlotsUsed, 1);
    });

    it("[134] installing a caste-favored Charm uses a dedicated slot", async () => {
      const actor = await createTempCharacter({ name: "Q-Module-Dedicated" });
      await actor.update({
        "system.exaltType":                       "alchemical",
        "system.attributes.strength.caste":       true
      });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Caste Module",
        type: "charm",
        system: { ability: "strength", essenceCommitment: 0 }
      }]);
      const charm = actor.items.find(i => i.name === "Caste Module");

      await actor.installCharm(charm.id);

      assert.equal(charm.system.installedSlotType, "dedicated");
      assert.equal(actor.system.dedicatedSlotsUsed, 1);
    });

    it("[135] warns and aborts when no slots are available", async () => {
      const actor = await createTempCharacter({ name: "Q-Module-NoSlots" });
      await actor.update({
        "system.exaltType":                     "alchemical",
        "system.splat.alchemical.dedicatedSlots": 0,
        "system.splat.alchemical.generalSlots":   0
      });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Blocked Module",
        type: "charm",
        system: { ability: "strength", essenceCommitment: 0 }
      }]);
      const charm = actor.items.find(i => i.name === "Blocked Module");

      await actor.installCharm(charm.id);

      assert.equal(charm.system.installed, false, "charm should not be installed");
    });

    it("[136] uninstalling a Charm frees the slot", async () => {
      const actor = await createTempCharacter({ name: "Q-Module-Uninstall" });
      await actor.update({ "system.exaltType": "alchemical" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Removable Module",
        type: "charm",
        system: { ability: "strength", essenceCommitment: 0, installed: true, installedSlotType: "general" }
      }]);
      const charm = actor.items.find(i => i.name === "Removable Module");
      assert.equal(actor.system.generalSlotsUsed, 1, "starts at 1 used");

      await actor.uninstallCharm(charm.id);

      assert.equal(charm.system.installed, false);
      assert.equal(charm.system.installedSlotType, "");
      assert.equal(actor.system.generalSlotsUsed, 0);
    });
  });
}
