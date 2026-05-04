import { register, sweep }    from "../_helpers/cleanup.mjs";
import { assertTestWorld }      from "../_helpers/world.mjs";
import { createTempCharacter }  from "../_helpers/actors.mjs";

async function makeInfernal(name) {
  const actor = await createTempCharacter({ name });
  await actor.update({ "system.exaltType": "infernal" });
  return actor;
}

export function registerInfernalUrge(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Infernal Urge trait", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[180] system.splat.infernal.urge defaults to empty string", async () => {
      const actor = await makeInfernal("Q-Urge-Default");
      assert.equal(actor.system.splat.infernal.urge, "");
    });

    it("[181] urge text persists after actor.update", async () => {
      const actor = await makeInfernal("Q-Urge-Text");
      await actor.update({ "system.splat.infernal.urge": "devour the Sun" });
      assert.equal(actor.system.splat.infernal.urge, "devour the Sun");
    });

    it("[182] an urge item created on an actor has type 'urge'", async () => {
      const actor = await makeInfernal("Q-Urge-ItemType");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Test Urge",
        type: "urge",
      }]);
      register(item);
      assert.equal(item.type, "urge");
    });

    it("[183] urge item system.description defaults to empty string", async () => {
      const actor = await makeInfernal("Q-Urge-Desc");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Test Urge Desc",
        type: "urge",
      }]);
      register(item);
      assert.equal(item.system.description, "");
    });

    it("[184] actor.items.find locates the urge item after creation", async () => {
      const actor = await makeInfernal("Q-Urge-Find");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Urge Find",
        type: "urge",
      }]);
      register(item);
      const found = actor.items.find(i => i.type === "urge");
      assert.ok(found, "urge item found on actor");
      assert.equal(found.id, item.id);
    });

    it("[185] a fresh non-Infernal actor has no urge items", async () => {
      const actor = await createTempCharacter({ name: "Q-Urge-NonInfernal" });
      await actor.update({ "system.exaltType": "solar" });
      const found = actor.items.find(i => i.type === "urge");
      assert.equal(found, undefined, "solar actor has no urge item");
    });
  });
}
