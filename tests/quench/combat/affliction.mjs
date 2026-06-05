import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerAffliction(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Poison/Disease afflictions", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[AF-1] afflictTargets stamps a flagged affliction AE with remaining intervals", async () => {
      const victim = await createTempCharacter({ name: "Q-AF-Victim" });
      const [poison] = await victim.createEmbeddedDocuments("Item", [{
        name: "Test Venom", type: "poison",
        system: { damage: "3", damageType: "lethal", interval: "hour", duration: "5 hours" }
      }]);
      const { afflictTargets } = await import("../../../module/combat/affliction.mjs");
      await afflictTargets(poison, [victim], { intervals: 3 });
      const ae = victim.effects.find(e => e.flags?.exalted2e?.affliction);
      assert.ok(ae, "affliction AE created");
      assert.equal(ae.flags.exalted2e.affliction.kind, "poison", "kind poison");
      assert.equal(ae.flags.exalted2e.affliction.remainingIntervals, 3, "remaining intervals stored");
      assert.ok(ae.statuses.has("poison"), "poison status present");
    });

    it("[AF-2] poison advanceAffliction expires the AE at the last interval", async () => {
      const victim = await createTempCharacter({ name: "Q-AF-Expire" });
      const [poison] = await victim.createEmbeddedDocuments("Item", [{
        name: "Brief Venom", type: "poison",
        system: { damage: "1", damageType: "bashing", interval: "action", duration: "1" }
      }]);
      const { afflictTargets, advanceAffliction } = await import("../../../module/combat/affliction.mjs");
      await afflictTargets(poison, [victim], { intervals: 1 });
      const ae = victim.effects.find(e => e.flags?.exalted2e?.affliction);
      await advanceAffliction(victim, ae.id);
      assert.notOk(victim.effects.get(ae.id), "AE removed when intervals hit 0");
    });

    it("[AF-3] removeAffliction deletes the AE", async () => {
      const victim = await createTempCharacter({ name: "Q-AF-Remove" });
      const [disease] = await victim.createEmbeddedDocuments("Item", [{
        name: "Test Pox", type: "disease", system: { morbidity: 2, trauma: "-1 fatigue" }
      }]);
      const { afflictTargets, removeAffliction } = await import("../../../module/combat/affliction.mjs");
      await afflictTargets(disease, [victim], {});
      const ae = victim.effects.find(e => e.flags?.exalted2e?.affliction);
      assert.ok(ae, "disease AE created");
      await removeAffliction(victim, ae.id);
      assert.notOk(victim.effects.get(ae.id), "AE removed");
    });
  });
}
