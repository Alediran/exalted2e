import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { createTempCharacter }           from "../_helpers/actors.mjs";
import { createTempWeapon }              from "../_helpers/weapons.mjs";
import { placeToken }                    from "../_helpers/scenes.mjs";
import { startTempCombat }               from "../_helpers/combat.mjs";

/** Bump actor to Ess 5 and fill peripheral so cover-delta tests start clean. */
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

export function registerAttunementMotes(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("attunement motes — Surging Essence Reactor pool", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // [120] applyAttunementMotes covers artifact cost and deducts pool
    it("[120] applyAttunementMotes sets attunedViaAttunement, deducts attunementMotes", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-Cover" });
      await actor.update({ "system.essence.value": 5, "system.attunementMotes": 8 });
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: false, attunementCost: 5
      });

      const result = await actor.applyAttunementMotes(weapon.id);

      assert.equal(result, true, "returns true on success");
      assert.equal(weapon.system.attuned,               true,  "weapon attuned");
      assert.equal(weapon.system.attunementMotesCover,  5,     "cover = full cost");
      assert.equal(weapon.system.attunedViaAttunement,  true,  "marked as attunement-mote attuned");
      assert.equal(actor.system.attunementMotes,        3,     "8 − 5 = 3 remaining");
    });

    // [121] applyAttunementMotes on already-attuned artifact replaces committed motes
    it("[121] applyAttunementMotes on already-attuned artifact sets cover without re-attunement flag", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-Replace" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5
      });
      // Manually deduct peripheral as if it was committed via real attunement
      await actor.update({
        "system.motes.peripheral.value": startMax - 5,
        "system.attunementMotes":        6
      });

      const result = await actor.applyAttunementMotes(weapon.id);

      assert.equal(result, true);
      assert.equal(weapon.system.attunementMotesCover, 5,     "cover = full cost");
      assert.equal(weapon.system.attunedViaAttunement, false, "already attuned — not a new attunement");
      assert.equal(actor.system.attunementMotes,       1,     "6 − 5 = 1 remaining");
    });

    // [122] cover reduces artifactPeripheral commitment
    it("[122] attunementMotesCover reduces peripheral.artifactCommitted", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-CommitDelta" });
      await fullPeripheral(actor);
      const startMax = actor.system.motes.peripheral.max;
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 6
      });
      // Simulate 6 motes committed: drop peripheral by 6 to match
      await actor.update({ "system.motes.peripheral.value": startMax - 6 });

      // Now apply 4 attunement motes of cover — reduces commitment from 6 to 2
      await actor.update({ "system.attunementMotes": 4 });
      await weapon.update({ "system.attunementMotesCover": 4 });

      // artifactCommitted should now be 2 (= cost 6 - cover 4)
      assert.equal(actor.system.motes.peripheral.artifactCommitted, 2,
        "cover of 4 reduces committed from 6 to 2");
      assert.equal(actor.system.motes.peripheral.effectiveMax, startMax - 2,
        "effectiveMax recovers by 4 motes");
    });

    // [123] applyAttunementMotes returns null when pool is insufficient
    it("[123] applyAttunementMotes returns null when attunementMotes < remaining cost", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-Insuff" });
      await actor.update({ "system.essence.value": 5, "system.attunementMotes": 2 });
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: false, attunementCost: 5
      });

      const result = await actor.applyAttunementMotes(weapon.id);

      assert.equal(result, null, "returns null on insufficient pool");
      assert.equal(weapon.system.attuned, false,  "weapon not attuned");
      assert.equal(actor.system.attunementMotes, 2, "pool unchanged");
    });

    // [124] endCombat un-attunes attunedViaAttunement artifacts and clears pool
    it("[124] endCombat un-attunes attunedViaAttunement artifacts and clears attunementMotes", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-SceneEnd" });
      await actor.update({ "system.essence.value": 5, "system.attunementMotes": 5 });
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5,
        attunementMotesCover: 5, attunedViaAttunement: true
      });

      const scene = getTestScene();
      await placeToken(actor, scene);
      const combat = await startTempCombat([actor]);

      // super.endCombat() shows an "End Encounter?" confirm dialog; auto-confirm it.
      // Pattern matches anima.mjs [163-165].
      const DV2 = foundry.applications.api.DialogV2;
      const origConfirm = DV2.confirm.bind(DV2);
      DV2.confirm = () => Promise.resolve(true);
      try {
        await combat.endCombat();
      } finally {
        DV2.confirm = origConfirm;
      }

      assert.equal(weapon.system.attuned,              false, "un-attuned at scene end");
      assert.equal(weapon.system.attunementMotesCover, 0,     "cover reset");
      assert.equal(weapon.system.attunedViaAttunement, false, "flag cleared");
      assert.equal(actor.system.attunementMotes,       0,     "pool drained to 0");
    });

    // [125] endCombat resets cover on replacement artifacts but leaves them attuned
    it("[125] endCombat resets cover but keeps attuned for replacement artifacts", async () => {
      const actor = await createTempCharacter({ name: "Q-AM-Replace-End" });
      await actor.update({ "system.essence.value": 5, "system.attunementMotes": 3 });
      const weapon = await createTempWeapon(actor, {
        artifact: true, attuned: true, attunementCost: 5,
        attunementMotesCover: 3, attunedViaAttunement: false
      });

      const scene = getTestScene();
      await placeToken(actor, scene);
      const combat = await startTempCombat([actor]);

      const DV2 = foundry.applications.api.DialogV2;
      const origConfirm = DV2.confirm.bind(DV2);
      DV2.confirm = () => Promise.resolve(true);
      try {
        await combat.endCombat();
      } finally {
        DV2.confirm = origConfirm;
      }

      // attunedViaAttunement was false → stays attuned; cover resets; own motes re-committed
      assert.equal(weapon.system.attuned,              true,  "remains attuned (real motes take over)");
      assert.equal(weapon.system.attunementMotesCover, 0,     "cover reset");
      assert.equal(weapon.system.attunedViaAttunement, false, "flag stays false");
      assert.equal(actor.system.attunementMotes,       0,     "attunement motes pool cleared");
    });
  });
}
