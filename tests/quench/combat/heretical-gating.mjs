import { cleanupOnAfter, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld }       from "../_helpers/world.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";

function stubWarn() {
  const calls = [];
  const orig = ui.notifications.warn;
  ui.notifications.warn = (...args) => { calls.push(args); };
  cleanupOnAfter(() => { ui.notifications.warn = orig; });
  return calls;
}

export function registerHereticalGating(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Heretical charm gating", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[200] blocks a non-Infernal actor from adding a Heretical charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Heretical-Solar", str: 2 });
      await actor.update({ "system.exaltType": "solar", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name:   "Test Heretical",
        type:   "charm",
        system: { ability: "melee", exaltType: "infernal", keywords: ["Heretical"] }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created for a non-Infernal");
      assert.equal(warns.length, 1, "ui.notifications.warn must fire exactly once");
    });

    it("[201] allows an Infernal actor to add a Heretical charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Heretical-GSP", str: 2 });
      await actor.update({ "system.exaltType": "infernal", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name:   "Test Heretical",
        type:   "charm",
        system: { ability: "melee", exaltType: "infernal", keywords: ["Heretical"] }
      }]);

      assert.equal(actor.items.size, sizeBefore + 1, "charm must be created for a GSP");
      assert.equal(warns.length, 0, "no warning must fire for an Infernal");
    });
  });
}
