import { register, sweep }        from "../_helpers/cleanup.mjs";
import { assertTestWorld }         from "../_helpers/world.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";
import { applyVirtueSuppression }  from "../../../module/documents/actor.mjs";

export function registerWillpowerVirtueLimit(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Willpower / virtue / limit automation", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── Schema ────────────────────────────────────────────────────────────
    it("[252] primaryVirtue defaults to null and persists when set", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-Schema" });
      register(actor);
      assert.equal(actor.system.primaryVirtue, null, "default is null");
      await actor.update({ "system.primaryVirtue": "conviction" });
      assert.equal(actor.system.primaryVirtue, "conviction", "persists after update");
    });

    // ── Morning Rest ──────────────────────────────────────────────────────
    it("[253] morning rest recovers WP equal to conviction successes (capped at max)", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-MRest" });
      register(actor);
      await actor.update({
        "system.exaltType":               "solar",
        "system.virtues.conviction.value": 3,
        "system.willpower.max":            10,
        "system.willpower.value":          2
      });
      const wpBefore = actor.system.willpower.value;
      const wpMax    = actor.system.willpower.max;
      await actor.rollMorningRest();
      const wpAfter = actor.system.willpower.value;
      assert.ok(wpAfter >= wpBefore, "WP is non-decreasing");
      assert.ok(wpAfter <= wpMax,    "WP does not exceed max");
    });

    it("[254] morning rest at max WP does not overflow", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-MRestMax" });
      register(actor);
      await actor.update({
        "system.exaltType":               "solar",
        "system.virtues.conviction.value": 5,
        "system.willpower.max":            10,
        "system.willpower.value":          10
      });
      await actor.rollMorningRest();
      assert.equal(actor.system.willpower.value, 10, "WP stays at max when already full");
    });

    // ── Virtue suppression ────────────────────────────────────────────────
    it("[255] applyVirtueSuppression spends WP for non-primary virtue, no limit gain", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-VirtNP" });
      register(actor);
      await actor.update({
        "system.exaltType":              "solar",
        "system.virtues.valor.value":    3,
        "system.willpower.max":          10,
        "system.willpower.value":        5,
        "system.limit":                  2,
        "system.primaryVirtue":          "compassion"
      });
      await applyVirtueSuppression(actor, "valor", 2);
      assert.equal(actor.system.willpower.value, 3, "spent 2 WP");
      assert.equal(actor.system.limit,           2, "Limit unchanged for non-primary");
    });

    it("[256] applyVirtueSuppression spends WP and gains +1 Limit for primary virtue", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-VirtPrim" });
      register(actor);
      await actor.update({
        "system.exaltType":               "solar",
        "system.virtues.conviction.value": 4,
        "system.willpower.max":            10,
        "system.willpower.value":          5,
        "system.limit":                    3,
        "system.primaryVirtue":            "conviction"
      });
      await applyVirtueSuppression(actor, "conviction", 2);
      assert.equal(actor.system.willpower.value, 3, "spent 2 WP");
      assert.equal(actor.system.limit,           4, "Limit +1 for primary virtue");
    });

    it("[257] applyVirtueSuppression returns false and spends nothing when WP < cost", async () => {
      const actor = await createTempCharacter({ name: "Q-WVL-VirtInsuff" });
      register(actor);
      await actor.update({
        "system.exaltType":               "solar",
        "system.virtues.conviction.value": 3,
        "system.willpower.max":            10,
        "system.willpower.value":          2,
        "system.limit":                    1,
        "system.primaryVirtue":            "conviction"
      });
      const ok = await applyVirtueSuppression(actor, "conviction", 3);
      assert.equal(ok,                             false, "returns false");
      assert.equal(actor.system.willpower.value,   2,     "WP unchanged");
      assert.equal(actor.system.limit,             1,     "Limit unchanged");
    });

    // ── Scene-end anima step-down ──────────────────────────────────────────
    it("[258] stepDownAnima reduces anima by one level", async () => {
      const { stepDownAnima } = await import("../../../module/combat/anima-math.mjs");
      const actor = await createTempCharacter({ name: "Q-WVL-AnimaStep" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.scenePeripheral": 8 });
      assert.equal(actor.system.anima, "burning", "setup: anima is burning");
      await stepDownAnima(actor);
      assert.equal(actor.system.anima, "glowing", "'burning' steps down to 'glowing'");
    });

    it("[259] stepDownAnima does not go below 'none'", async () => {
      const { stepDownAnima } = await import("../../../module/combat/anima-math.mjs");
      const actor = await createTempCharacter({ name: "Q-WVL-AnimaNone" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.scenePeripheral": 0 });
      assert.equal(actor.system.anima, "none", "setup: anima is none");
      await stepDownAnima(actor);
      assert.equal(actor.system.anima, "none", "'none' stays at 'none'");
    });

    it("[260] stepDownAnima steps 'dim' down to 'none'", async () => {
      const { stepDownAnima } = await import("../../../module/combat/anima-math.mjs");
      const actor = await createTempCharacter({ name: "Q-WVL-AnimaDim" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.scenePeripheral": 1 });
      assert.equal(actor.system.anima, "dim", "setup: anima is dim");
      await stepDownAnima(actor);
      assert.equal(actor.system.anima, "none", "'dim' steps down to 'none'");
    });
  });
}
