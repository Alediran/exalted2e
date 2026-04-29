import { cleanupOnAfter, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { stubPurchaseConfirm } from "../_helpers/dialogs.mjs";

function stubWarn() {
  const calls = [];
  const orig = ui.notifications.warn;
  ui.notifications.warn = (...args) => { calls.push(args); };
  cleanupOnAfter(() => { ui.notifications.warn = orig; });
  return calls;
}

export function registerPurchaseMode(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("purchase mode — enforcement", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // Test 1: Lock off → no dialog
    it("does not open the dialog when purchaseLocked is false", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Off", str: 2 });
      await actor.update({
        "system.purchaseLocked": false,
        "system.experience.value": 20
      });
      // Empty stub queue: if the dialog ever opens, it will throw on exhaustion
      const queue = await stubPurchaseConfirm([]);

      await actor.update({ "system.attributes.strength.value": 3 });

      assert.equal(actor.system.attributes.strength.value, 3);
      assert.equal((actor.system.purchaseLog ?? []).length, 0);
      assert.equal(actor.system.experience.value, 20);
      assert.equal(queue.length, 0); // queue never consumed
    });

    // Test 2: Increase confirmed
    it("logs an entry and decrements XP when an increase is confirmed", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Confirm", str: 2 });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 20
      });
      await stubPurchaseConfirm([{ xpCost: 8, note: "test note" }]);

      await actor.update({ "system.attributes.strength.value": 3 });

      assert.equal(actor.system.attributes.strength.value, 3);
      assert.equal(actor.system.experience.value, 12);

      const log = actor.system.purchaseLog ?? [];
      assert.equal(log.length, 1);
      const entry = log[0];
      assert.equal(entry.traitPath, "system.attributes.strength.value");
      assert.equal(entry.oldValue, "2");
      assert.equal(entry.newValue, "3");
      assert.equal(entry.xpCost, 8);
      assert.equal(entry.note, "test note");
      assert.ok(entry.timestamp);
      assert.ok(entry.userId);
    });

    // Test 3: Increase cancelled aborts whole update
    it("aborts the update when the dialog returns null", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Cancel", str: 2 });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 20
      });
      await stubPurchaseConfirm([null]);

      await actor.update({ "system.attributes.strength.value": 3 });

      assert.equal(actor.system.attributes.strength.value, 2,
        "strength reverted because update aborted");
      assert.equal((actor.system.purchaseLog ?? []).length, 0);
      assert.equal(actor.system.experience.value, 20);
    });

    // Test 4: Reduction rejected with notification
    it("rejects a permanent-trait reduction with a warning", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Reduce", str: 3 });
      await actor.update({ "system.purchaseLocked": true });
      const warnCalls = stubWarn();

      await actor.update({ "system.attributes.strength.value": 2 });

      assert.equal(actor.system.attributes.strength.value, 3,
        "strength unchanged");
      assert.equal((actor.system.purchaseLog ?? []).length, 0);
      assert.equal(warnCalls.length, 1,
        "ui.notifications.warn called exactly once");
    });

    // Test 5: Multi-trait single update
    it("opens dialogs in order and writes both log entries on a multi-trait update", async () => {
      const actor = await createTempCharacter({
        name: "Q-Purchase-Multi", str: 2, ath: 1
      });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 30
      });
      await stubPurchaseConfirm([
        { xpCost: 8, note: "str" },
        { xpCost: 3, note: "athletics" }
      ]);

      await actor.update({
        "system.attributes.strength.value": 3,
        "system.abilities.athletics.value": 2
      });

      assert.equal(actor.system.attributes.strength.value, 3);
      assert.equal(actor.system.abilities.athletics.value, 2);
      assert.equal(actor.system.experience.value, 19);

      const log = actor.system.purchaseLog ?? [];
      assert.equal(log.length, 2);
      // Order is whichever flattenObject iterates first; both must be present.
      const paths = log.map(e => e.traitPath).sort();
      assert.deepEqual(paths, [
        "system.abilities.athletics.value",
        "system.attributes.strength.value"
      ].sort());
    });

    // Test 6: bypassPurchaseLock skips check
    it("skips the lock check when bypassPurchaseLock: true is passed", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Bypass", str: 3 });
      await actor.update({ "system.purchaseLocked": true });
      // Empty queue: if the dialog ever opens, throw
      const queue = await stubPurchaseConfirm([]);
      const warnCalls = stubWarn();

      await actor.update(
        { "system.attributes.strength.value": 2 },
        { bypassPurchaseLock: true }
      );

      assert.equal(actor.system.attributes.strength.value, 2,
        "reduction permitted via bypass");
      assert.equal((actor.system.purchaseLog ?? []).length, 0);
      assert.equal(queue.length, 0, "dialog never opened");
      assert.equal(warnCalls.length, 0, "no warning issued");
    });
  });
}
