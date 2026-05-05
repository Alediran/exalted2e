import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerGreaterSigns(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Sidereal Greater Signs", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[220] prereq fails when essence < 4", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Prereq1" });
      await actor.update({ "system.exaltType": "sidereal", "system.essence.value": 3 });
      const { _greaterSignPrereqMet } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      assert.isFalse(_greaterSignPrereqMet(actor, "journeys"), "should fail at essence 3");
    });

    it("[221] prereq fails when college sum < 15", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Prereq2" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.splat.sidereal.colleges.journeys.the_captain": 3,
      });
      const { _greaterSignPrereqMet } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      assert.isFalse(_greaterSignPrereqMet(actor, "journeys"), "should fail at 3 college dots");
    });

    it("[222] prereq passes with essence >= 4 and college sum >= 15", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Prereq3" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      const { _greaterSignPrereqMet } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      assert.isTrue(_greaterSignPrereqMet(actor, "journeys"), "should pass at essence 4 + 15 dots");
    });

    it("[223] activation creates pending cost AE and sets item active", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Activate" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.motes.peripheral.value": 20,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Greater Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: true, active: false },
      }]);
      const { _activateGreaterSign } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      await _activateGreaterSign(actor, item);

      const fresh = actor.items.get(item.id);
      assert.isTrue(fresh.system.active, "item should be active");
      const ae = actor.effects.find(e =>
        e.flags?.exalted2e?.permanentCost && e.flags?.exalted2e?.sourceItem === item.id
      );
      assert.ok(ae, "pending cost AE must exist");
      assert.equal(ae.flags.exalted2e.permanentCost.essence,   1, "essence cost = 1");
      assert.equal(ae.flags.exalted2e.permanentCost.willpower, 1, "willpower cost = 1");
    });

    it("[224] mutual exclusion blocks when Lesser Sign of same caste is active", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Conflict" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.motes.peripheral.value": 20,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      await actor.createEmbeddedDocuments("Item", [{
        name: "Lesser Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: false, active: true },
      }]);
      const [greaterSign] = await actor.createEmbeddedDocuments("Item", [{
        name: "Greater Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: true, active: false },
      }]);
      const { _activateGreaterSign } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      const result = await _activateGreaterSign(actor, greaterSign);

      assert.isFalse(result, "should return false when blocked");
      assert.isFalse(actor.items.get(greaterSign.id).system.active, "Greater Sign must not activate");
      assert.isUndefined(
        actor.effects.find(e => e.flags?.exalted2e?.permanentCost),
        "no pending cost AE created"
      );
    });

    it("[225] normal deactivation applies permanent cost", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Deactivate" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.willpower.max": 8,
        "system.motes.peripheral.value": 20,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Greater Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: true, active: false },
      }]);
      const { _activateGreaterSign, _deactivateGreaterSign } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      await _activateGreaterSign(actor, item);
      const essenceBefore = actor.system.essence.value;  // 4
      const wpMaxBefore   = actor.system.willpower.max;  // 8

      await _deactivateGreaterSign(actor, actor.items.get(item.id));
      await new Promise(r => setTimeout(r, 150)); // wait for async hook

      assert.equal(actor.system.essence.value,  essenceBefore - 1, "essence reduced by 1");
      assert.equal(actor.system.willpower.max,   wpMaxBefore   - 1, "willpower.max reduced by 1");
      assert.isFalse(actor.items.get(item.id).system.active,        "item deactivated");
    });

    it("[226] reversal recovers motes without permanent cost", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-Reverse" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.willpower.max": 8,
        "system.motes.peripheral.value": 20,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Greater Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: true, active: false },
      }]);
      const { _activateGreaterSign, _reverseGreaterSignActivation } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      await _activateGreaterSign(actor, item);
      const essenceBefore = actor.system.essence.value;
      const wpMaxBefore   = actor.system.willpower.max;
      const motesBefore   = actor.system.motes.peripheral.value; // 10 less than before activation

      await _reverseGreaterSignActivation(actor, actor.items.get(item.id));
      await new Promise(r => setTimeout(r, 150)); // wait for async hook

      assert.equal(actor.system.essence.value,             essenceBefore,       "essence unchanged");
      assert.equal(actor.system.willpower.max,              wpMaxBefore,         "willpower.max unchanged");
      assert.isAbove(actor.system.motes.peripheral.value,  motesBefore,         "motes recovered");
      assert.isFalse(actor.items.get(item.id).system.active,                     "item deactivated");
    });

    it("[227] direct AE deletion applies permanent cost and deactivates item", async () => {
      const actor = await createTempCharacter({ name: "Q-GS-DirectDelete" });
      await actor.update({
        "system.exaltType":    "sidereal",
        "system.essence.value": 4,
        "system.willpower.max": 8,
        "system.motes.peripheral.value": 20,
        "system.splat.sidereal.colleges.journeys.the_captain":     3,
        "system.splat.sidereal.colleges.journeys.the_gull":        3,
        "system.splat.sidereal.colleges.journeys.the_mast":        3,
        "system.splat.sidereal.colleges.journeys.the_messenger":   3,
        "system.splat.sidereal.colleges.journeys.the_ships_wheel": 3,
      });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Greater Sign of Mercury",
        type: "animapower",
        system: { exaltType: "sidereal", caste: "journeys", isGreaterSign: true, active: false },
      }]);
      const { _activateGreaterSign } = await import(
        "../../../module/sheets/actor/character-sheet.mjs"
      );
      await _activateGreaterSign(actor, item);
      const essenceBefore = actor.system.essence.value;
      const wpMaxBefore   = actor.system.willpower.max;

      // Simulate GM directly deleting the AE from the effects panel
      const ae = actor.effects.find(e =>
        e.flags?.exalted2e?.permanentCost && e.flags?.exalted2e?.sourceItem === item.id
      );
      assert.ok(ae, "pending cost AE must exist before direct deletion");
      await ae.delete();
      await new Promise(r => setTimeout(r, 150));

      assert.equal(actor.system.essence.value, essenceBefore - 1, "essence reduced by 1");
      assert.equal(actor.system.willpower.max,  wpMaxBefore   - 1, "willpower.max reduced by 1");
      assert.isFalse(actor.items.get(item.id).system.active,        "item deactivated by hook");
    });
  });
}
