import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerLunarTell(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Lunar Tell trait", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[176] tell defaults to empty string and tellHidden defaults to false", async () => {
      const actor = await createTempCharacter({ name: "Q-Tell-Defaults" });
      await actor.update({ "system.exaltType": "lunar" });

      assert.equal(actor.system.splat.lunar.tell, "");
      assert.equal(actor.system.splat.lunar.tellHidden, false);
    });

    it("[177] tell text persists after actor.update", async () => {
      const actor = await createTempCharacter({ name: "Q-Tell-Text" });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.update({ "system.splat.lunar.tell": "a glint of silver in her eyes" });

      assert.equal(actor.system.splat.lunar.tell, "a glint of silver in her eyes");
    });

    it("[178] tellHidden persists when set to true", async () => {
      const actor = await createTempCharacter({ name: "Q-Tell-Hide" });
      await actor.update({ "system.exaltType": "lunar" });

      await actor.update({ "system.splat.lunar.tellHidden": true });

      assert.equal(actor.system.splat.lunar.tellHidden, true);
    });

    it("[179] tellHidden persists when toggled back to false", async () => {
      const actor = await createTempCharacter({ name: "Q-Tell-Unhide" });
      await actor.update({ "system.exaltType": "lunar" });
      await actor.update({ "system.splat.lunar.tellHidden": true });

      await actor.update({ "system.splat.lunar.tellHidden": false });

      assert.equal(actor.system.splat.lunar.tellHidden, false);
    });
  });
}
