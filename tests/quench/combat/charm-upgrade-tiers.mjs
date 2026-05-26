import { assertTestWorld }     from "../_helpers/world.mjs";
import { sweep }               from "../_helpers/cleanup.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempCharm }     from "../_helpers/charms.mjs";

export function registerCharmUpgradeTiersSchema(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm upgrade tiers — schema", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[T1-01] upgradeTiers defaults to [] and modeExclusive defaults false", async function () {
      const actor = await createTempCharacter({ name: "TierActor" });
      const charm = await createTempCharm(actor, { duration: "instant" });
      assert.deepEqual(charm.system.upgradeTiers, []);
      assert.strictEqual(charm.system.attackBonus.modeExclusive, false);
    });

    it("[T1-02] _qualifyingTiers returns empty arrays for a charm with no tiers", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      const charm = await createTempCharm(actor, { duration: "instant" });
      const result = _qualifyingTiers(actor, charm);
      assert.deepEqual(result.passive, []);
      assert.deepEqual(result.active, []);
    });

    it("[T1-03] essence gate: Ess 3 qualifies, Ess 2 does not", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      await actor.update({ "system.essence.value": 3 });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        upgradeTiers: [{ essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: true,
                         abilityGate: { min: 0 }, attributeGate: { min: 0 } }]
      });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
      await actor.update({ "system.essence.value": 2 });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 0);
    });

    it("[T1-04] ability gate: Dodge 4 qualifies, Dodge 3 does not", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      await actor.update({ "system.abilities.dodge.value": 4 });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        ability: "dodge",
        upgradeTiers: [{ essenceRequired: 0, autoApply: true, passive: true, gateRequiresAll: true,
                         abilityGate: { min: 4 }, attributeGate: { min: 0 } }]
      });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
      await actor.update({ "system.abilities.dodge.value": 3 });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 0);
    });

    it("[T1-05] AND gate fails when either condition misses", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      await actor.update({ "system.essence.value": 3, "system.attributes.strength.value": 2 });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        ability: "strength",
        upgradeTiers: [{ essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: true,
                         abilityGate: { min: 0 }, attributeGate: { min: 3 } }]
      });
      // strength 2 < 3 → fails AND
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 0);
      await actor.update({ "system.attributes.strength.value": 3 });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
    });

    it("[T1-06] OR gate qualifies via ability when Essence fails", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      await actor.update({ "system.essence.value": 2, "system.abilities.dodge.value": 4 });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        ability: "dodge",
        upgradeTiers: [{ essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: false,
                         abilityGate: { min: 4 }, attributeGate: { min: 0 } }]
      });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
    });

    it("[T1-07] autoApply false: purchaseLevel 1 fails, level 2 qualifies", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await createTempCharacter({ name: "TierActor" });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        upgradeTiers: [{ essenceRequired: 0, autoApply: false, passive: true, gateRequiresAll: true,
                         purchaseLevelRequired: 2,
                         abilityGate: { min: 0 }, attributeGate: { min: 0 } }]
      });
      // default purchaseLevel is 1 → checks = [purchaseLevel check] = [false]
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 0);
      await charm.update({ "system.purchaseLevel": 2 });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
    });
  });
}

export function registerCharmUpgradeTiersPipeline(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm upgrade tiers — activation pipeline", function () {
    before(assertTestWorld);
    afterEach(sweep);

    async function setupActor() {
      const actor = await createTempCharacter({ name: "TierPipeActor" });
      await actor.update({
        "system.essence.value":          3,
        "system.motes.peripheral.value": 40,
        "system.motes.peripheral.max":   40,
        "system.motes.personal.value":   10,
        "system.motes.personal.max":     10,
        "system.willpower.value":         5,
        "system.willpower.max":           5,
      });
      return actor;
    }

    it("[T2-01] passive tier fires: merged attackBonus in synth AE flags; tiersApplied listed", async function () {
      const actor = await setupActor();
      const charm = await createTempCharm(actor, {
        duration: "oneScene",
        cost: { formula: "2m" },
        attackBonus: { enabled: true, accuracyDice: "2" },
        upgradeTiers: [{
          label: "Essence 3 Upgrade",
          essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: true,
          abilityGate: { min: 0 }, attributeGate: { min: 0 },
          cost: { formula: "" },
          attackBonus: { enabled: true, accuracyDice: "1" },
        }],
      });
      const before = game.messages.size;
      await charm.activateCharm();

      const synthAE = actor.effects.find(e =>
        !e.disabled && e.flags?.exalted2e?.charmSource === charm.id && e.flags?.exalted2e?.synthAE
      );
      assert.ok(synthAE, "synth AE should exist");
      const tab = synthAE?.flags?.exalted2e?.tierAttackBonus;
      assert.ok(tab?.enabled, "tierAttackBonus should be enabled");
      // base 2 + tier 1 = 3
      assert.strictEqual(tab?.accuracyDice, "3");

      const msg = game.messages.contents.at(-1);
      const tiers = msg?.flags?.exalted2e?.charmActivation?.ledger?.tiersApplied;
      assert.ok(Array.isArray(tiers) && tiers.length === 1, "tiersApplied should have 1 entry");
      assert.strictEqual(tiers[0].label, "Essence 3 Upgrade");
      assert.strictEqual(tiers[0].type, "passive");
    });

    it("[T2-02] passive tier skipped when actor below gate: base values only", async function () {
      const actor = await setupActor();
      await actor.update({ "system.essence.value": 2 }); // below gate
      const charm = await createTempCharm(actor, {
        duration: "oneScene",
        cost: { formula: "2m" },
        attackBonus: { enabled: true, accuracyDice: "2" },
        upgradeTiers: [{
          label: "Essence 3 Upgrade",
          essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: true,
          abilityGate: { min: 0 }, attributeGate: { min: 0 },
          cost: { formula: "" },
          attackBonus: { enabled: true, accuracyDice: "1" },
        }],
      });
      await charm.activateCharm();

      const synthAE = actor.effects.find(e =>
        !e.disabled && e.flags?.exalted2e?.charmSource === charm.id && e.flags?.exalted2e?.synthAE
      );
      assert.ok(synthAE, "synth AE should exist (base charm activates normally even when tier is below gate)");
      const tab = synthAE?.flags?.exalted2e?.tierAttackBonus;
      // base only: accuracyDice "2", not summed
      assert.strictEqual(tab?.accuracyDice, "2");

      const msg = game.messages.contents.at(-1);
      const tiers = msg?.flags?.exalted2e?.charmActivation?.ledger?.tiersApplied;
      assert.ok(!tiers?.length, "tiersApplied should be empty when gate fails");
    });

    it("[T2-05] OR gate qualifies via ability when Essence fails", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await setupActor();
      await actor.update({ "system.essence.value": 2, "system.abilities.dodge.value": 4 });
      const charm = await createTempCharm(actor, {
        duration: "instant",
        ability: "dodge",
        upgradeTiers: [{
          essenceRequired: 3, autoApply: true, passive: true, gateRequiresAll: false,
          purchaseLevelRequired: 2,
          abilityGate: { min: 4 }, attributeGate: { min: 0 },
          cost: { formula: "" },
        }],
      });
      const result = _qualifyingTiers(actor, charm);
      assert.strictEqual(result.passive.length, 1, "OR gate should qualify via ability");
    });

    it("[T2-06] purchaseLevelRequired: level 1 not qualifying; level 2 qualifying", async function () {
      const { _qualifyingTiers } = await import("../../../module/rolls/charm-tier-math.mjs");
      const actor = await setupActor();
      const charm = await createTempCharm(actor, {
        duration: "instant",
        upgradeTiers: [{
          essenceRequired: 0, autoApply: false, passive: true, gateRequiresAll: true,
          purchaseLevelRequired: 2,
          abilityGate: { min: 0 }, attributeGate: { min: 0 },
          cost: { formula: "" },
        }],
      });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 0);
      await charm.update({ "system.purchaseLevel": 2 });
      assert.strictEqual(_qualifyingTiers(actor, charm).passive.length, 1);
    });
  });
}
