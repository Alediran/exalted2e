import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempWeapon } from "../_helpers/weapons.mjs";

async function fullPeripheral(actor) {
  // Bump essence so prepareDerivedData computes a generous peripheral.max,
  // then set value equal to that derived max so tests can assert exact deltas.
  // (motes.*.max is clobbered by prepareDerivedData on every read — never trust
  // a persisted max value.)
  await actor.update({ "system.essence.value": 5 });
  const max = actor.system.motes.peripheral.max;
  await actor.update({ "system.motes.peripheral.value": max });
}

export function registerAttunement(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("attunement — artifact commitment side effects", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // Test 1: Attune drops motes
    it("[104] drops peripheral motes by attunementCost when attuned flips true", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-On" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const item = await createTempWeapon(actor, {
        name: "Q-Artifact-Sword",
        artifact: true, attuned: false, attunementCost: 5
      });

      await item.update({ "system.attuned": true });

      assert.equal(actor.system.motes.peripheral.value, startMax - 5);
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 5);
      assert.equal(actor.system.motes.peripheral.totalCommitted, 5);
      assert.equal(actor.system.motes.peripheral.effectiveMax, startMax - 5);
    });

    // Test 2: De-attune returns motes (clamped at max)
    it("[105] returns motes on de-attune, clamped at peripheral.max", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-Off" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const item = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5
      });
      // After embedding an attuned artifact, peripheral.value sits at startMax - 5
      // (because Item._preUpdate only fires on UPDATE, not on creation —
      //  so we need to manually drop the pool here for the test setup).
      await actor.update({
        "system.motes.peripheral.value": startMax - 5
      });

      await item.update({ "system.attuned": false });

      assert.equal(actor.system.motes.peripheral.value, startMax);
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 0);
    });

    // Test 3: Cost-change delta while attuned
    it("[106] applies a delta when attunementCost changes on an already-attuned artifact", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-CostChange" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const item = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5
      });
      await actor.update({ "system.motes.peripheral.value": startMax - 5 });

      await item.update({ "system.attunementCost": 7 });

      // Delta: new commit (7) - old commit (5) = +2 → pool drops by 2
      assert.equal(actor.system.motes.peripheral.value, startMax - 7);
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 7);
    });

    // Test 4: Delete attuned artifact returns motes
    it("[107] returns committed motes when an attuned artifact is deleted", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-Delete" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const item = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5
      });
      await actor.update({ "system.motes.peripheral.value": startMax - 5 });

      await item.delete();

      assert.equal(actor.system.motes.peripheral.value, startMax);
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 0);
    });

    // Test 5: Multi-artifact totalCommitted aggregation
    it("[108] aggregates multiple attuned artifacts into peripheral.totalCommitted", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-Multi" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const a = await createTempWeapon(actor, {
        name: "Q-Art-A", artifact: true, attuned: false, attunementCost: 3
      });
      const b = await createTempWeapon(actor, {
        name: "Q-Art-B", artifact: true, attuned: false, attunementCost: 5
      });

      await a.update({ "system.attuned": true });
      await b.update({ "system.attuned": true });

      assert.equal(actor.system.motes.peripheral.value, startMax - 8);
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 8);
      assert.equal(actor.system.motes.peripheral.totalCommitted, 8);
      assert.equal(actor.system.motes.peripheral.effectiveMax, startMax - 8);
    });

    // Test 6: Non-artifact attune is no-op
    it("[109] does not touch the pool when attune flips on a non-artifact weapon", async () => {
      const actor = await createTempCharacter({ name: "Q-Attune-NonArt" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const item = await createTempWeapon(actor, {
        name: "Q-NonArt", artifact: false, attuned: false, attunementCost: 5
      });

      await item.update({ "system.attuned": true });

      assert.equal(actor.system.motes.peripheral.value, startMax,
        "pool unchanged because the early-return prevented any delta");
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 0);
    });
  });
}
