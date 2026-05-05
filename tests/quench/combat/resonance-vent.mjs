import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerResonanceVent(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Abyssal eruption scripts", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[210] bankedResonance field no longer exists on abyssal actors", async () => {
      const actor = await createTempCharacter({ name: "Q-Eruption-Schema" });
      await actor.update({ "system.exaltType": "abyssal" });
      assert.isUndefined(
        actor.system.splat?.abyssal?.bankedResonance,
        "bankedResonance must be absent from schema"
      );
    });

    it("[211] allocation creates one AE per non-zero category and resets limit to 0", async () => {
      const actor = await createTempCharacter({ name: "Q-Eruption-AEs" });
      await actor.update({ "system.exaltType": "abyssal", "system.limit": 10 });

      const { _applyEruptionScripts } = await import(
        "../../../module/dialogs/eruption-allocation-dialog.mjs"
      );
      await _applyEruptionScripts(actor, { blight: 3, branding: 2, conduit: 0, stigmata: 0 });

      const eruption = actor.effects.filter(e => e.flags?.exalted2e?.eruptionScript);
      assert.equal(eruption.length, 2, "two AEs created (blight + branding)");
      assert.ok(
        eruption.some(e => e.flags.exalted2e.eruptionScript.type === "blight" && e.flags.exalted2e.eruptionScript.tier === 3),
        "blight AE at tier 3"
      );
      assert.ok(
        eruption.some(e => e.flags.exalted2e.eruptionScript.type === "branding" && e.flags.exalted2e.eruptionScript.tier === 2),
        "branding AE at tier 2"
      );
      assert.equal(actor.system.limit, 0, "limit resets to 0");
    });

    it("[212] stigmata tier 2 applies 2 levels of lethal damage and resets limit", async () => {
      const actor = await createTempCharacter({ name: "Q-Eruption-Stigmata2" });
      await actor.update({ "system.exaltType": "abyssal", "system.limit": 10 });
      const lethalBefore = actor.system.health.lethal ?? 0;

      const { _applyEruptionScripts } = await import(
        "../../../module/dialogs/eruption-allocation-dialog.mjs"
      );
      await _applyEruptionScripts(actor, { blight: 0, branding: 0, conduit: 0, stigmata: 2 });

      assert.isAbove(actor.system.health.lethal ?? 0, lethalBefore, "lethal damage applied");
      assert.equal(actor.system.limit, 0, "limit resets to 0");
    });

    it("[213] stigmata tier 4 adds a Crippling AE in addition to damage", async () => {
      const actor = await createTempCharacter({ name: "Q-Eruption-Crippling" });
      await actor.update({ "system.exaltType": "abyssal", "system.limit": 10 });

      const { _applyEruptionScripts } = await import(
        "../../../module/dialogs/eruption-allocation-dialog.mjs"
      );
      await _applyEruptionScripts(actor, { blight: 0, branding: 0, conduit: 0, stigmata: 4 });

      const crippling = actor.effects.find(
        e => e.flags?.exalted2e?.eruptionScript?.type === "stigmata-crippling"
      );
      assert.ok(crippling, "stigmata-crippling AE must be present");
    });

    it("[214] categories with zero allocation produce no AE", async () => {
      const actor = await createTempCharacter({ name: "Q-Eruption-ZeroAlloc" });
      await actor.update({ "system.exaltType": "abyssal", "system.limit": 10 });

      const { _applyEruptionScripts } = await import(
        "../../../module/dialogs/eruption-allocation-dialog.mjs"
      );
      await _applyEruptionScripts(actor, { blight: 5, branding: 5, conduit: 0, stigmata: 0 });

      const conduitAe  = actor.effects.find(e => e.flags?.exalted2e?.eruptionScript?.type === "conduit");
      const stigmataAe = actor.effects.find(e => e.flags?.exalted2e?.eruptionScript?.type === "stigmata");
      assert.isUndefined(conduitAe,  "no conduit AE when allocation is 0");
      assert.isUndefined(stigmataAe, "no stigmata AE when allocation is 0");
    });
  });
}
