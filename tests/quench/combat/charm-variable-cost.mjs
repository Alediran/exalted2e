import { assertTestWorld }     from "../_helpers/world.mjs";
import { sweep, register }     from "../_helpers/cleanup.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerCharmVariableCost(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("variable mote cost — per-unit", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[265] per-unit charm spends baseline + (units × motesPerUnit) motes on activation", async function () {
      const actor = await createTempCharacter({ name: "VarCost PerUnit Actor" });
      register(actor);

      await actor.update({
        "system.motes.peripheral.value": 20
      });

      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Per-Unit Test Charm",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost: {
            motes:          2,
            motesPerUnit:   3,
            motesUnitLabel: "extra die",
            motesMin:       0
          }
        }
      }]);
      register(charm);

      const motesBefore = actor.system.motes.peripheral.value;

      // explicitMotesOverride = 8 means baseline(2) + 2 units × 3m = 8
      const ok = await charm.activateCharm({ skipChatCard: true, explicitMotesOverride: 8 });
      assert.ok(ok, "activateCharm should return true");

      const deadline = Date.now() + 3000;
      while (actor.system.motes.peripheral.value === motesBefore) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      const spent = motesBefore - actor.system.motes.peripheral.value;
      assert.equal(spent, 8, `should have spent 8 motes (got ${spent})`);
    });
  });

  describe("variable mote cost — tiers", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[266] tiered charm spends the explicitly-selected tier cost on activation", async function () {
      const actor = await createTempCharacter({ name: "VarCost Tier Actor" });
      register(actor);

      await actor.update({
        "system.motes.peripheral.value": 20
      });

      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Tiered Test Charm",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost: {
            motes: 0,
            tiers: [
              { moteCost: 3, label: "Basic" },
              { moteCost: 7, label: "Enhanced" }
            ]
          }
        }
      }]);
      register(charm);

      const motesBefore = actor.system.motes.peripheral.value;

      // explicitMotesOverride = 7 passes the Enhanced tier's cost value as the override.
      const ok = await charm.activateCharm({ skipChatCard: true, explicitMotesOverride: 7 });
      assert.ok(ok, "activateCharm should return true");

      const deadline = Date.now() + 3000;
      while (actor.system.motes.peripheral.value === motesBefore) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      const spent = motesBefore - actor.system.motes.peripheral.value;
      assert.equal(spent, 7, `should have spent 7 motes (got ${spent})`);
    });
  });

  describe("variable mote cost — zero override", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[267] explicitMotesOverride of 0 spends 0 motes (free-cost path)", async function () {
      const actor = await createTempCharacter({ name: "VarCost Zero Actor" });
      register(actor);

      await actor.update({
        "system.motes.peripheral.value": 10
      });

      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Free Variable Charm",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost: {
            motes:        0,
            motesPerUnit: 2,
            motesMin:     0
          }
        }
      }]);
      register(charm);

      const motesBefore = actor.system.motes.peripheral.value;

      const ok = await charm.activateCharm({ skipChatCard: true, explicitMotesOverride: 0 });
      assert.ok(ok, "activateCharm should return true even for 0 motes");
      assert.equal(
        actor.system.motes.peripheral.value,
        motesBefore,
        "no motes should be spent when override is 0"
      );
    });
  });
}
