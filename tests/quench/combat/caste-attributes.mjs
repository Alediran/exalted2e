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

export function registerCasteAttributes(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("caste attributes — Lunar / Alchemical", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[117] Lunar Full Moon caste sets attribute caste flags on physical attrs", async () => {
      const actor = await createTempCharacter({ name: "Q-Lunar-Full" });
      await actor.update({ "system.exaltType": "lunar" });
      await actor.update({ "system.caste": "full" });

      assert.equal(actor.system.attributes.strength.caste, true);
      assert.equal(actor.system.attributes.dexterity.caste, true);
      assert.equal(actor.system.attributes.stamina.caste, true);
      assert.equal(actor.system.attributes.charisma.caste, false);
      assert.equal(actor.system.attributes.wits.caste, false);
    });

    it("[118] Switching Lunar caste rewrites attribute caste flags", async () => {
      const actor = await createTempCharacter({ name: "Q-Lunar-Switch" });
      await actor.update({ "system.exaltType": "lunar" });
      await actor.update({ "system.caste": "full" });
      assert.equal(actor.system.attributes.strength.caste, true);

      await actor.update({ "system.caste": "no" });
      assert.equal(actor.system.attributes.strength.caste, false);
      assert.equal(actor.system.attributes.perception.caste, true);
      assert.equal(actor.system.attributes.intelligence.caste, true);
      assert.equal(actor.system.attributes.wits.caste, true);
    });

    it("[119] Heart's Blood form item persists and active-form linkage round-trips", async () => {
      const actor = await createTempCharacter({ name: "Q-Lunar-HeartsBlood" });
      await actor.update({ "system.exaltType": "lunar" });

      const [form] = await actor.createEmbeddedDocuments("Item", [{
        name: "Tigress",
        type: "form",
        system: { formType: "animal", source: "Test fixture" }
      }]);
      assert.ok(form, "form item created");
      assert.equal(form.system.formType, "animal");

      await actor.update({ "system.splat.lunar.activeFormId": form.id });
      assert.equal(actor.system.splat.lunar.activeFormId, form.id);
    });
  });
}
