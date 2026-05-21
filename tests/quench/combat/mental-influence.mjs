import { assertTestWorld }     from "../_helpers/world.mjs";
import { sweep }               from "../_helpers/cleanup.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempItem }      from "../_helpers/items.mjs";

export function registerMentalInfluence(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("mental influence keywords", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[MI-01] applySocialInfluenceEffects stamps Emotion AE with penaltyMinor/penaltyMajor", async function () {
      const { applySocialInfluenceEffects } = await import("../../../module/ui/social-influence-effects.mjs");
      const defender = await createTempCharacter({ name: "Defender" });
      const attacker = await createTempCharacter({ name: "Attacker" });
      const charm = await createTempItem(attacker, {
        type: "charm",
        name: "Iron Whip Principle",
        "system.keywords": ["Emotion"],
      });
      const ids = await applySocialInfluenceEffects(defender, {
        attackerId:      attacker.id,
        sourceByKeyword: { Emotion: charm.id },
        keywords:        ["Emotion"],
      });
      assert.ok(ids.length === 1, "one AE created");
      const ae = defender.effects.get(ids[0]);
      assert.ok(ae, "AE exists on defender");
      assert.equal(ae.flags.exalted2e.keyword, "Emotion");
      assert.equal(ae.flags.exalted2e.penaltyMinor, 1, "default penaltyMinor = 1");
      assert.equal(ae.flags.exalted2e.penaltyMajor, 3, "default penaltyMajor = 3");
      assert.equal(ae.flags.exalted2e.attackerId, attacker.id);
    });

    it("[MI-02] applySocialInfluenceEffects stamps Servitude AE with gmOnlyRemoval=true", async function () {
      const { applySocialInfluenceEffects } = await import("../../../module/ui/social-influence-effects.mjs");
      const defender = await createTempCharacter({ name: "Defender2" });
      const attacker = await createTempCharacter({ name: "Attacker2" });
      const charm = await createTempItem(attacker, {
        type: "charm",
        name: "Binding Covenant",
        "system.keywords": ["Servitude"],
      });
      const ids = await applySocialInfluenceEffects(defender, {
        attackerId:      attacker.id,
        sourceByKeyword: { Servitude: charm.id },
        keywords:        ["Servitude"],
      });
      assert.ok(ids.length === 1, "one AE created");
      const ae = defender.effects.get(ids[0]);
      assert.ok(ae, "AE exists on defender");
      assert.equal(ae.flags.exalted2e.keyword, "Servitude");
      assert.equal(ae.flags.exalted2e.gmOnlyRemoval, true, "gmOnlyRemoval = true");
      assert.equal(ae.flags.exalted2e.wpCostPerResist, 1, "default wpCostPerResist = 1");
    });

    it("[MI-03] applySocialInfluenceEffects stamps Compulsion AE with wpCostPerResist", async function () {
      const { applySocialInfluenceEffects } = await import("../../../module/ui/social-influence-effects.mjs");
      const defender = await createTempCharacter({ name: "Defender3" });
      const attacker = await createTempCharacter({ name: "Attacker3" });
      const charm = await createTempItem(attacker, {
        type: "charm",
        name: "Soul Fire Shaping",
        "system.keywords": ["Compel"],
      });
      const ids = await applySocialInfluenceEffects(defender, {
        attackerId:      attacker.id,
        sourceByKeyword: { Compel: charm.id },
        keywords:        ["Compel"],
      });
      const ae = defender.effects.get(ids[0]);
      assert.ok(ae, "AE exists on defender");
      assert.equal(ae.flags.exalted2e.keyword, "Compel");
      assert.equal(ae.flags.exalted2e.wpCostPerResist, 1);
    });

    it("[MI-04] buildMentalInfluenceEffects excludes Illusion, includes Emotion/Compel/Servitude", async function () {
      const { applySocialInfluenceEffects, buildMentalInfluenceEffects } =
        await import("../../../module/ui/social-influence-effects.mjs");
      const defender = await createTempCharacter({ name: "Defender4" });
      const attacker = await createTempCharacter({ name: "Attacker4" });
      const cEmo  = await createTempItem(attacker, { type: "charm", name: "Fear Binding",     "system.keywords": ["Emotion"] });
      const cIll  = await createTempItem(attacker, { type: "charm", name: "Mirage Weaving",   "system.keywords": ["Illusion"] });
      const cComp = await createTempItem(attacker, { type: "charm", name: "Will Subjugation", "system.keywords": ["Compel"] });
      await applySocialInfluenceEffects(defender, {
        attackerId:      attacker.id,
        sourceByKeyword: { Emotion: cEmo.id, Illusion: cIll.id, Compel: cComp.id },
        keywords:        ["Emotion", "Illusion", "Compel"],
      });
      const effects = buildMentalInfluenceEffects(defender);
      assert.equal(effects.length, 2, "Illusion excluded → 2 entries");
      const keywords = effects.map(e => e.keyword);
      assert.ok(keywords.includes("Emotion"));
      assert.ok(keywords.includes("Compel"));
      assert.ok(!keywords.includes("Illusion"), "Illusion not returned");
    });

    it("[MI-05] clearAllSocialInfluenceEffectsForActor removes all social AEs", async function () {
      const { applySocialInfluenceEffects, clearAllSocialInfluenceEffectsForActor } =
        await import("../../../module/ui/social-influence-effects.mjs");
      const defender = await createTempCharacter({ name: "Defender5" });
      const attacker = await createTempCharacter({ name: "Attacker5" });
      const charm = await createTempItem(attacker, { type: "charm", name: "Emotion X", "system.keywords": ["Emotion"] });
      await applySocialInfluenceEffects(defender, {
        attackerId: attacker.id,
        sourceByKeyword: { Emotion: charm.id },
        keywords: ["Emotion"],
      });
      await clearAllSocialInfluenceEffectsForActor(defender);
      const remaining = defender.effects.filter(ae => ae.flags?.exalted2e?.socialInfluence);
      assert.equal(remaining.length, 0, "all social AEs cleared");
    });
  });
}
