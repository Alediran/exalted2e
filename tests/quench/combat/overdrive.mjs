import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep }                         from "../_helpers/cleanup.mjs";
import { createTempCharacter }           from "../_helpers/actors.mjs";
import { placeToken }                    from "../_helpers/scenes.mjs";
import { startTempCombat }               from "../_helpers/combat.mjs";
import { createTempCharm }               from "../_helpers/charms.mjs";
import { cleanupOnAfter }                from "../_helpers/cleanup.mjs";

/** Set overdrive directly via update so tests can assert drain behaviour. */
async function setOverdrive(actor, amount) {
  await actor.update({ "system.motes.peripheral.overdrive": amount });
}

/** Ensure actor has a comfortable peripheral pool and given overdrive level. */
async function setupWithOverdrive(actor, { peripheral = 20, overdrive = 10 } = {}) {
  await actor.update({
    "system.essence.value":            5,
    "system.motes.peripheral.value":   peripheral,
    "system.motes.peripheral.overdrive": overdrive
  });
}

export function registerOverdrive(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("overdrive pool", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // ── gainOverdrive routing ──────────────────────────────────────────────

    // [110] gainOverdrive moteRecovery action adds to overdrive, not peripheral
    it("[110] gainOverdrive action routes to addOverdriveMotes, not recoverMotes", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-GainRoute" });
      await actor.update({ "system.essence.value": 5 });
      const startPeripheral = actor.system.motes.peripheral.value;
      const startOverdrive  = actor.system.motes.peripheral.overdrive ?? 0;

      // duration: "permanent" required so isCharmPassivelyActive returns true
      await createTempCharm(actor, {
        duration: "permanent",
        moteRecovery: {
          enabled:       true,
          event:         "onDamageReceived",
          action:        "gainOverdrive",
          formula:       "3",
          maxRecovery:   10,
          perDamageLevel: false
        }
      });

      await actor._fireRecoveryEvent("onDamageReceived");

      assert.equal(
        actor.system.motes.peripheral.overdrive,
        startOverdrive + 3,
        "overdrive increased by 3"
      );
      assert.equal(
        actor.system.motes.peripheral.value,
        startPeripheral,
        "peripheral.value unchanged"
      );
    });

    // [111] perDamageLevel scales overdrive gain by damageLevels
    it("[111] perDamageLevel scales gainOverdrive motes by damageLevels", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-PerDmg" });
      await actor.update({ "system.essence.value": 5 });
      const startOverdrive = actor.system.motes.peripheral.overdrive ?? 0;

      await createTempCharm(actor, {
        duration:     "permanent",
        moteRecovery: {
          enabled:       true,
          event:         "onDamageReceived",
          action:        "gainOverdrive",
          formula:       "2",
          maxRecovery:   20,
          perDamageLevel: true
        }
      });

      await actor._fireRecoveryEvent("onDamageReceived", null, 4);

      assert.equal(
        actor.system.motes.peripheral.overdrive,
        startOverdrive + 8,   // 2 * 4 damage levels
        "overdrive = formula * damageLevels"
      );
    });

    // [112] onAllyAttacked fires on other character combatants when damage applied
    it("[112] onAllyAttacked fires on allies in combat when a combatant takes damage", async function () {
      const victim = await createTempCharacter({ name: "Q-OD-Victim" });
      const ally   = await createTempCharacter({ name: "Q-OD-Ally"   });
      await ally.update({ "system.essence.value": 5 });

      // Ally has a permanent charm that triggers on onAllyAttacked: gain 1 overdrive per HL
      await createTempCharm(ally, {
        duration:     "permanent",
        moteRecovery: {
          enabled:       true,
          event:         "onAllyAttacked",
          action:        "gainOverdrive",
          formula:       "1",
          maxRecovery:   10,
          perDamageLevel: true
        }
      });

      const scene = getTestScene();
      await placeToken(victim, scene, { x: 0,   y: 0 });
      await placeToken(ally,   scene, { x: 100, y: 0 });
      await startTempCombat([victim, ally]);

      const startOverdrive = ally.system.motes.peripheral.overdrive ?? 0;

      // Apply 3 levels of damage to victim — should fire onAllyAttacked on ally
      await victim.applyDamage(3, "bashing");

      assert.equal(
        ally.system.motes.peripheral.overdrive,
        startOverdrive + 3,
        "ally gained 1 overdrive per HL of damage dealt to ally"
      );
    });

    // ── allowOverdrive enforcement ─────────────────────────────────────────

    // [113] offensive charm (attackBonus.enabled) drains overdrive first
    it("[113] offensive charm activation drains overdrive before peripheral", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-Offensive" });
      await setupWithOverdrive(actor, { peripheral: 20, overdrive: 5 });

      // attackBonus.enabled = true marks the charm as offensive
      const charm = await createTempCharm(actor, {
        cost:        { formula: "5m" },
        duration:    "instant",
        attackBonus: { enabled: true, accuracyDice: "2" }
      });

      await charm.activateCharm({ skipXpConfirm: true });

      // 5m cost: should drain 5 from overdrive first
      assert.equal(
        actor.system.motes.peripheral.overdrive,
        0,
        "overdrive drained (5 of 5)"
      );
      assert.equal(
        actor.system.motes.peripheral.value,
        20,
        "peripheral.value untouched when overdrive covered the full cost"
      );
    });

    // [114] non-offensive charm does NOT drain overdrive
    it("[114] non-offensive charm activation skips overdrive, drains peripheral only", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-NonOffensive" });
      await setupWithOverdrive(actor, { peripheral: 20, overdrive: 5 });

      // no attackBonus, no steps → not offensive
      const charm = await createTempCharm(actor, {
        cost:     { formula: "4m" },
        duration: "instant"
      });

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        actor.system.motes.peripheral.overdrive,
        5,
        "overdrive untouched for non-offensive charm"
      );
      assert.equal(
        actor.system.motes.peripheral.value,
        16,
        "peripheral drained by 4m instead"
      );
    });

    // [115] charm with steps[] treated as offensive — drains overdrive
    it("[115] charm with steps[] is treated as offensive and drains overdrive", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-Steps" });
      await setupWithOverdrive(actor, { peripheral: 20, overdrive: 3 });

      const charm = await createTempCharm(actor, {
        cost:     { formula: "3m" },
        duration: "instant",
        steps:    [2]   // step 2 (Charm declaration) — marks charm as offensive
      });

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        actor.system.motes.peripheral.overdrive,
        0,
        "overdrive drained for charm with steps"
      );
      assert.equal(
        actor.system.motes.peripheral.value,
        20,
        "peripheral unchanged when overdrive exactly covered cost"
      );
    });

    // [116] addOverdriveMotes is capped at 25
    it("[116] addOverdriveMotes caps at 25", async function () {
      const actor = await createTempCharacter({ name: "Q-OD-Cap" });
      await actor.update({ "system.essence.value": 5 });
      await setOverdrive(actor, 23);

      await actor.addOverdriveMotes(10);

      assert.equal(
        actor.system.motes.peripheral.overdrive,
        25,
        "overdrive cannot exceed 25"
      );
    });
  });
}
