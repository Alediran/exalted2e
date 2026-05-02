import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerTerrestrialBreeding(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Terrestrial Breeding", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[144] no Breeding background → breedingBonus all zeros, motes use base formula", async () => {
      const actor = await createTempCharacter({ name: "Q-Breeding-None" });
      await actor.update({
        "system.exaltType":      "terrestrial",
        "system.essence.value":  3,
        "system.willpower.max":  5,
        "system.virtues.compassion.value": 1,
        "system.virtues.conviction.value": 2,
        "system.virtues.temperance.value": 1,
        "system.virtues.valor.value":      3
      });

      assert.deepEqual(actor.system.breedingBonus,
        { rating: 0, personal: 0, peripheral: 0, animaReduction: 0 });

      // sorted [3,2,1,1] → highest=3, twoHighest=5; no breeding → +0/+0
      // personal = 3+5+3 = 11; peripheral = 12+5+5 = 22
      assert.equal(actor.system.motes.personal.max,   11);
      assert.equal(actor.system.motes.peripheral.max, 22);
    });

    it("[145] Breeding 3 Background item → breedingBonus matches table, mote maxima updated", async () => {
      const actor = await createTempCharacter({ name: "Q-Breeding-3" });
      await actor.update({
        "system.exaltType":      "terrestrial",
        "system.essence.value":  3,
        "system.willpower.max":  7,  // minPermanent = conviction(3)+valor(4) = 7; can't set below that
        "system.virtues.compassion.value": 2,
        "system.virtues.conviction.value": 3,
        "system.virtues.temperance.value": 1,
        "system.virtues.valor.value":      4
      });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Breeding",
        type: "background",
        system: { value: 3 },
        flags: { exalted2e: { isBreeding: true, gmOnlyRemoval: true } }
      }]);

      assert.deepEqual(actor.system.breedingBonus,
        { rating: 3, personal: 3, peripheral: 5, animaReduction: 0 });

      // sorted [4,3,2,1] → highest=4, twoHighest=7; bp.personal=3, bp.peripheral=5
      // personal = 3+7+4+3 = 17; peripheral = 12+7+7+5 = 31
      assert.equal(actor.system.motes.personal.max,   17);
      assert.equal(actor.system.motes.peripheral.max, 31);
    });

    it("[146] changing Breeding rating updates derived values", async () => {
      const actor = await createTempCharacter({ name: "Q-Breeding-Change" });
      await actor.update({
        "system.exaltType":      "terrestrial",
        "system.essence.value":  2,
        "system.willpower.max":  4,
        "system.virtues.compassion.value": 2,
        "system.virtues.conviction.value": 2,
        "system.virtues.temperance.value": 2,
        "system.virtues.valor.value":      2
      });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Breeding",
        type: "background",
        system: { value: 1 },
        flags: { exalted2e: { isBreeding: true, gmOnlyRemoval: true } }
      }]);

      // After rating 1
      assert.equal(actor.system.breedingBonus.rating, 1);
      const bg = actor.items.find(i => i.type === "background" && i.getFlag("exalted2e", "isBreeding"));

      await bg.update({ "system.value": 4 });

      await waitFor(() => actor.system.breedingBonus.rating === 4);
      assert.deepEqual(actor.system.breedingBonus,
        { rating: 4, personal: 4, peripheral: 7, animaReduction: 1 });
      assert.equal(actor.system.motes.personal.max,   12);
      assert.equal(actor.system.motes.peripheral.max, 23);
    });

    it("[147] non-terrestrial actor with flagged Background → breedingBonus all zeros", async () => {
      const actor = await createTempCharacter({ name: "Q-Breeding-Solar" });
      await actor.update({ "system.exaltType": "solar", "system.essence.value": 3 });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Breeding",
        type: "background",
        system: { value: 5 },
        flags: { exalted2e: { isBreeding: true } }
      }]);

      assert.deepEqual(actor.system.breedingBonus,
        { rating: 0, personal: 0, peripheral: 0, animaReduction: 0 });
    });
  });
}
