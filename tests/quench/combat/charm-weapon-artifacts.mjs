import { assertTestWorld }                from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter }          from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { createTempCharm }                from "../_helpers/charms.mjs";

/**
 * Stub `ExaltedRoll.rollAttack` to a no-op that returns null, so
 * `_rollCharmInstantAttack` can run end-to-end without opening the
 * AttackDialog or needing a target. The try/finally still deletes the
 * transient weapon; we just skip the actual attack pipeline. Restored
 * via cleanupOnAfter.
 */
async function stubRollAttack() {
  const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
  const orig = ExaltedRoll.rollAttack;
  cleanupOnAfter(() => { ExaltedRoll.rollAttack = orig; });
  ExaltedRoll.rollAttack = async (..._args) => null;
}

/**
 * Build a minimal-attack-block charm. The charm's `attack.enabled = true`
 * is what triggers the spawn / instant-roll branches in activateCharm.
 */
async function makeAttackCharm(actor, { duration, name = "Charm Weapon" }) {
  return createTempCharm(actor, {
    name,
    duration,
    attack: {
      enabled: true,
      name:    name,
      speed:   "5",
      accuracy:"3",
      damage:  "5",
      range:   "0"
    }
  });
}

/** Fresh actor with enough motes for any test in this batch. */
async function setupActor() {
  const actor = await createTempCharacter({ name: "ArtifactSpawner" });
  await actor.update({
    "system.essence.value": 5,
    "system.motes.peripheral.value": 30,
    "system.motes.peripheral.max":   30
  });
  return actor;
}

/** Count weapons + AEs flagged charmSource === charmId on the actor. */
function countArtifacts(actor, charmId) {
  const weapons = actor.items.filter(i =>
    i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === charmId
  ).length;
  const effects = actor.effects.filter(e =>
    e.flags?.exalted2e?.charmSource === charmId
  ).length;
  return { weapons, effects };
}

export function registerCharmWeaponArtifacts(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm weapon artifacts (spawn / teardown)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Instant charm: transient weapon created and deleted in one activation.
    it("instant charm: creates a transient weapon and deletes it after the attack", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "instant" });
      await stubRollAttack();
      const weaponsBefore = actor.items.filter(i => i.type === "weapon").length;
      const ok = await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(ok, true, "activation succeeded");
      const weaponsAfter = actor.items.filter(i => i.type === "weapon").length;
      assert.equal(weaponsAfter, weaponsBefore,
        "transient weapon deleted (try/finally cleanup)");
      // No persistent artifacts left over for this charm.
      const { weapons, effects } = countArtifacts(actor, charm.id);
      assert.equal(weapons, 0, "no charmSource weapon left");
      assert.equal(effects, 0, "no tracking AE left");
    });

    // 2. Longer-duration charm: persistent weapon + tracking AE, both flagged.
    it("oneScene charm: spawns a charmSource weapon AND a tracking AE", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "oneScene" });
      const ok = await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(ok, true, "activation succeeded");
      const { weapons, effects } = countArtifacts(actor, charm.id);
      assert.equal(weapons, 1, "weapon item with charmSource flag spawned");
      assert.equal(effects, 1, "tracking AE with charmSource flag spawned");
      // Sustained-duration toggle flipped to active.
      assert.equal(charm.system.active, true,
        "charm toggled active for sustained duration");
    });

    // 3. Toggle-off: re-activating an active sustained charm clears artifacts.
    it("toggle-off: re-activating clears the spawned weapon and AE", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "oneScene" });
      await charm.activateCharm({ skipXpConfirm: true });   // ON
      assert.equal(charm.system.active, true);

      await charm.activateCharm({ skipXpConfirm: true });   // OFF
      assert.equal(charm.system.active, false, "charm toggled back off");
      const { weapons, effects } = countArtifacts(actor, charm.id);
      assert.equal(weapons, 0, "weapon removed on toggle-off");
      assert.equal(effects, 0, "tracking AE removed on toggle-off");
    });

    // 4. Charm preDelete: deleting the charm tears down the spawned weapon + AE.
    it("charm preDelete: deleting the charm cleans up its weapon artifacts", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "oneScene" });
      await charm.activateCharm({ skipXpConfirm: true });
      const before = countArtifacts(actor, charm.id);
      assert.equal(before.weapons, 1);
      assert.equal(before.effects, 1);
      const charmId = charm.id;
      await charm.delete();
      // Look the AE/Item up post-delete by the original charm id; both should be gone.
      const remainingWeapons = actor.items.filter(i =>
        i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === charmId
      ).length;
      const remainingEffects = actor.effects.filter(e =>
        e.flags?.exalted2e?.charmSource === charmId
      ).length;
      assert.equal(remainingWeapons, 0, "weapon deleted by _preDelete cleanup");
      assert.equal(remainingEffects, 0, "tracking AE deleted by _preDelete cleanup");
    });

    // 5. AE deleteActiveEffect hook: deleting the tracking AE removes the weapon
    //    AND flips the charm's `active` back to false. Foundry doesn't await
    //    hook callbacks, so we poll for the cascading weapon delete + active
    //    flip rather than reading state immediately after `ae.delete()`.
    it("AE delete hook: deleting the tracking AE removes the weapon and untoggles the charm", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "oneScene" });
      await charm.activateCharm({ skipXpConfirm: true });
      const trackingAe = actor.effects.find(e =>
        e.flags?.exalted2e?.charmSource === charm.id
      );
      assert.ok(trackingAe, "tracking AE present before delete");
      await trackingAe.delete();

      // The deleteActiveEffect hook (module/exalted2e.mjs:397) runs async
      // and is not awaited by Foundry — poll until both side effects land.
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const remaining = actor.items.filter(i =>
          i.type === "weapon"
          && i.getFlag("exalted2e", "charmSource") === charm.id
        ).length;
        if (remaining === 0 && charm.system.active === false) break;
        await new Promise(r => setTimeout(r, 25));
      }

      const remainingWeapons = actor.items.filter(i =>
        i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === charm.id
      ).length;
      assert.equal(remainingWeapons, 0,
        "weapon deleted by deleteActiveEffect hook");
      assert.equal(charm.system.active, false,
        "charm.active flipped to false");
    });

    // 6. Idempotency: running cleanup twice doesn't error and leaves zero artifacts.
    it("idempotency: a second teardown is a clean no-op", async function () {
      const actor = await setupActor();
      const charm = await makeAttackCharm(actor, { duration: "oneScene" });
      await charm.activateCharm({ skipXpConfirm: true });
      // First teardown: toggle off (which calls _removeCharmWeaponArtifacts).
      await charm.activateCharm({ skipXpConfirm: true });
      // Second teardown: call _removeCharmWeaponArtifacts directly. Should
      // not throw and leave no leftovers.
      await charm._removeCharmWeaponArtifacts();
      const { weapons, effects } = countArtifacts(actor, charm.id);
      assert.equal(weapons, 0);
      assert.equal(effects, 0);
    });
  });
}
