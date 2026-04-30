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
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerDBT(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Deadly Beastman Transformation", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("substitutes physical attributes when activeFormId points to a warform item", async () => {
      const actor = await createTempCharacter({
        name: "Q-DBT-Subst",
        str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Dire Warform",
        type: "form",
        system: {
          formType: "warform",
          attributes: { strength: 6, dexterity: 5, stamina: 6 }
        }
      }]);
      const warform = actor.items.find(i => i.name === "Dire Warform");
      assert.ok(warform, "warform item created");

      await actor.update({ "system.splat.lunar.activeFormId": warform.id });

      assert.equal(actor.system.attributes.strength.value,  6);
      assert.equal(actor.system.attributes.dexterity.value, 5);
      assert.equal(actor.system.attributes.stamina.value,   6);
    });

    it("clearing activeFormId from a warform reverts attributes to base", async () => {
      const actor = await createTempCharacter({
        name: "Q-DBT-Revert",
        str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Dire Warform",
        type: "form",
        system: {
          formType: "warform",
          attributes: { strength: 6, dexterity: 5, stamina: 6 }
        }
      }]);
      const warform = actor.items.find(i => i.name === "Dire Warform");
      await actor.update({ "system.splat.lunar.activeFormId": warform.id });
      assert.equal(actor.system.attributes.strength.value, 6);

      await actor.update({ "system.splat.lunar.activeFormId": "" });

      assert.equal(actor.system.attributes.strength.value,  2);
      assert.equal(actor.system.attributes.dexterity.value, 2);
      assert.equal(actor.system.attributes.stamina.value,   2);
    });

    it("deleting the active warform clears activeFormId", async () => {
      const actor = await createTempCharacter({
        name: "Q-DBT-Delete",
        str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Dire Warform",
        type: "form",
        system: {
          formType: "warform",
          attributes: { strength: 6, dexterity: 5, stamina: 6 }
        }
      }]);
      const warform = actor.items.find(i => i.name === "Dire Warform");
      await actor.update({ "system.splat.lunar.activeFormId": warform.id });
      assert.equal(actor.system.attributes.strength.value, 6);

      await warform.delete();
      await waitFor(() => actor.system.splat.lunar.activeFormId === "");

      assert.equal(actor.system.splat.lunar.activeFormId, "");
      assert.equal(actor.system.attributes.strength.value, 2);
    });

    it("dbtActive is false when no form is active", async () => {
      const actor = await createTempCharacter({ name: "Q-DBT-Inactive", str: 2, dex: 2, sta: 2 });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Dire Warform",
        type: "form",
        system: { formType: "warform", attributes: { strength: 6, dexterity: 5, stamina: 6 } }
      }]);
      const warform = actor.items.find(i => i.name === "Dire Warform");
      // activeFormId is "" by default — DBT not active
      const dbtActive = !!warform && actor.system.splat.lunar.activeFormId === warform.id;
      assert.equal(dbtActive, false);
    });
  });
}
