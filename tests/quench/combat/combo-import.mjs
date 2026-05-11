import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { register }            from "../_helpers/cleanup.mjs";
import { createTempCharm }     from "../_helpers/charms.mjs";

async function createTempCombo(actor, { charmUids = [], charmNames = [] } = {}) {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: "Quench Combo",
    type: "combo",
    system: { charmUids, charmNames }
  }]);
  register(item);
  return item;
}

export function registerComboImport(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("combo charmNames parallel array and import remap", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[CI-1] combo stores charmUids and charmNames when created with both", async () => {
      const actor = await createTempCharacter({ name: "Q-CI-1" });
      const charm = await createTempCharm(actor, { name: "Iron Whirlwind" });
      const uid   = charm.system.charmUid;

      const combo = await createTempCombo(actor, {
        charmUids:  [uid],
        charmNames: ["Iron Whirlwind"]
      });

      assert.deepEqual(combo.system.charmUids,  [uid]);
      assert.deepEqual(combo.system.charmNames, ["Iron Whirlwind"]);
    });

    it("[CI-2] preCreateItem remaps UID to matching-name charm on the target actor", async () => {
      const actorA = await createTempCharacter({ name: "Q-CI-2A" });
      const charmA = await createTempCharm(actorA, { name: "Iron Whirlwind" });
      const uidA   = charmA.system.charmUid;

      const actorB = await createTempCharacter({ name: "Q-CI-2B" });
      const charmB = await createTempCharm(actorB, { name: "Iron Whirlwind" });
      const uidB   = charmB.system.charmUid;

      assert.notEqual(uidA, uidB, "UIDs must differ for this test to be meaningful");

      const combo = await createTempCombo(actorB, {
        charmUids:  [uidA],
        charmNames: ["Iron Whirlwind"]
      });

      assert.deepEqual(combo.system.charmUids, [uidB]);
    });

    it("[CI-3] UID that already resolves on the target actor is not changed", async () => {
      const actor = await createTempCharacter({ name: "Q-CI-3" });
      const charm = await createTempCharm(actor, { name: "Iron Whirlwind" });
      const uid   = charm.system.charmUid;

      const combo = await createTempCombo(actor, {
        charmUids:  [uid],
        charmNames: ["Iron Whirlwind"]
      });

      assert.deepEqual(combo.system.charmUids, [uid]);
    });

    it("[CI-4] combo without charmNames skips remap entirely (backward compat)", async () => {
      const actorA = await createTempCharacter({ name: "Q-CI-4A" });
      const charmA = await createTempCharm(actorA, { name: "Iron Whirlwind" });
      const uidA   = charmA.system.charmUid;

      const actorB = await createTempCharacter({ name: "Q-CI-4B" });
      await createTempCharm(actorB, { name: "Iron Whirlwind" });

      // Empty charmNames → hook condition `names.length > 0` is false → no remap
      const combo = await createTempCombo(actorB, {
        charmUids:  [uidA],
        charmNames: []
      });

      assert.deepEqual(combo.system.charmUids, [uidA]);
    });

    it("[CI-5] unresolvable name leaves the original UID unchanged", async () => {
      const actorA = await createTempCharacter({ name: "Q-CI-5A" });
      const charmA = await createTempCharm(actorA, { name: "Iron Whirlwind" });
      const uidA   = charmA.system.charmUid;

      // Actor B has no charm named "Iron Whirlwind"
      const actorB = await createTempCharacter({ name: "Q-CI-5B" });

      const combo = await createTempCombo(actorB, {
        charmUids:  [uidA],
        charmNames: ["Iron Whirlwind"]
      });

      assert.deepEqual(combo.system.charmUids, [uidA]);
    });

    it("[CI-6] mixed list: matched UIDs remapped, unresolvable UIDs left unchanged", async () => {
      const actorA = await createTempCharacter({ name: "Q-CI-6A" });
      const charm1A = await createTempCharm(actorA, { name: "Iron Whirlwind" });
      const charm2A = await createTempCharm(actorA, { name: "Golden Essence" });
      const uid1A   = charm1A.system.charmUid;
      const uid2A   = charm2A.system.charmUid;

      const actorB  = await createTempCharacter({ name: "Q-CI-6B" });
      const charm1B = await createTempCharm(actorB, { name: "Iron Whirlwind" });
      const uid1B   = charm1B.system.charmUid;
      // Actor B has no "Golden Essence"

      const combo = await createTempCombo(actorB, {
        charmUids:  [uid1A, uid2A],
        charmNames: ["Iron Whirlwind", "Golden Essence"]
      });

      assert.deepEqual(combo.system.charmUids, [uid1B, uid2A]);
    });
  });
}
