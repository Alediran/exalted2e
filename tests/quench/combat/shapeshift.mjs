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

export function registerShapeshift(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Lunar shapeshift — active form substitution", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("substitutes physical attributes when activeFormId points to a form item", async () => {
      const actor = await createTempCharacter({
        name: "Q-Lunar-Shift",
        str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      const [form] = await actor.createEmbeddedDocuments("Item", [{
        name: "Tigress",
        type: "form",
        system: {
          formType: "animal",
          attributes: {
            strength: 5, dexterity: 4, stamina: 5,
            charisma: 1, manipulation: 1, appearance: 1,
            perception: 1, intelligence: 1, wits: 1
          }
        }
      }]);

      await actor.update({ "system.splat.lunar.activeFormId": form.id });

      assert.equal(actor.system.attributes.strength.value, 5);
      assert.equal(actor.system.attributes.dexterity.value, 4);
      assert.equal(actor.system.attributes.stamina.value, 5);
    });

    it("switching active form updates the substituted attributes", async () => {
      const actor = await createTempCharacter({
        name: "Q-Lunar-Switch", str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.createEmbeddedDocuments("Item", [
        { name: "Tigress", type: "form", system: { attributes: { strength: 5, dexterity: 4, stamina: 5 } } },
        { name: "Eagle",   type: "form", system: { attributes: { strength: 3, dexterity: 6, stamina: 3 } } }
      ]);
      // Look up by name — Foundry v13's createEmbeddedDocuments may not
      // return items in input order, so destructure-order is unreliable.
      const tigress = actor.items.find(i => i.name === "Tigress");
      const eagle   = actor.items.find(i => i.name === "Eagle");
      assert.ok(tigress && eagle, "both forms created");

      await actor.update({ "system.splat.lunar.activeFormId": tigress.id });
      assert.equal(actor.system.attributes.strength.value, 5);

      await actor.update({ "system.splat.lunar.activeFormId": eagle.id });
      assert.equal(actor.system.attributes.strength.value, 3);
      assert.equal(actor.system.attributes.dexterity.value, 6);
    });

    it("deleting the active form clears activeFormId and reverts attributes", async () => {
      const actor = await createTempCharacter({
        name: "Q-Lunar-Delete", str: 2, dex: 2, sta: 2
      });
      await actor.update({ "system.exaltType": "lunar" });

      const [form] = await actor.createEmbeddedDocuments("Item", [{
        name: "Tigress",
        type: "form",
        system: { attributes: { strength: 5 } }
      }]);
      await actor.update({ "system.splat.lunar.activeFormId": form.id });
      assert.equal(actor.system.attributes.strength.value, 5);

      await form.delete();
      // _preDelete clears activeFormId; substitution no-ops; attribute reverts.
      await waitFor(() => actor.system.splat.lunar.activeFormId === "");
      assert.equal(actor.system.splat.lunar.activeFormId, "");
      assert.equal(actor.system.attributes.strength.value, 2);
    });
  });
}
