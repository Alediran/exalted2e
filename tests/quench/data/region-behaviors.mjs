import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";
import { HazardDamageBehaviorType } from "../../../module/data/region-behaviors/hazard-damage.mjs";

// The behavior types `hazardDamage` / `terrainModifier` are registered in
// system.json (documentTypes.RegionBehavior) + CONFIG.RegionBehavior.dataModels,
// so they can be created normally. Behaviors are embedded in the Region's
// `behaviors` array (seeded in preCreateRegion, module/exalted2e.mjs; read back via
// [...region.behaviors] in module/helpers/terrain.mjs). These create-based tests
// also guard that registration — they fail if the documentTypes entry is dropped.

export function registerRegionBehaviors(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Region behaviors (hazard/terrain)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    async function makeRegionWithBehavior(name, behaviorData) {
      const scene = getTestScene();
      const [region] = await scene.createEmbeddedDocuments("Region", [{
        name,
        behaviors: [behaviorData],
      }]);
      register(region);   // sweep cascades to embedded behaviors
      const beh = [...region.behaviors].find(b => b.type === behaviorData.type);
      return { region, beh };
    }

    // ── [RB-1] TerrainModifier schema defaults ───────────────────────────────

    it("[RB-1] terrainModifier behavior has correct schema defaults", async () => {
      const { beh } = await makeRegionWithBehavior("Q-TerrainModifier-Region", {
        name: "Q-TerrainModifier",
        type: "terrainModifier",
        system: {},
      });
      assert.ok(beh, "terrainModifier behavior was created on the region");
      assert.equal(beh.system.terrainType,   "elevation", "terrainType default is 'elevation'");
      assert.equal(beh.system.accuracyBonus, 0,           "accuracyBonus default is 0");
      assert.equal(beh.system.dvBonus,       0,           "dvBonus default is 0");
      assert.equal(beh.system.soakBonus,     0,           "soakBonus default is 0");
      assert.equal(beh.system.label,         "",          "label default is ''");
    });

    // ── [RB-2] hazardDamage apply path posts a chat card ────────────────────
    // Test split: the three-way immune/resist/apply branch decision and the pool
    // floor are unit-tested in tests/data/region-behaviors/hazard-math.test.mjs
    // (pure, exhaustive). This in-Foundry smoke exercises the "apply" path wiring —
    // that the turn-start handler rolls against a real actor and posts a card.

    it("[RB-2] hazardDamage apply path rolls against an actor and posts a chat card", async () => {
      // createTempCharacter defaults to playerOwner: false, so hazardAction
      // returns "apply" when resistDifficulty === 0 (no player-owner resist path).
      const actor = await createTempCharacter({ name: "Q-HazardDamage-Actor" });

      const { beh } = await makeRegionWithBehavior("Q-HazardDamage-Region", {
        name: "Q-HazardDamage",
        type: "hazardDamage",
        system: {
          damagePool:       "3",
          traumaType:       "bashing",
          resistDifficulty: 0,
          damageOnEntry:    false,
          isSupernatural:   false,
        },
      });
      assert.ok(beh, "hazardDamage behavior was created on the region");

      // Invoke the registered TOKEN_TURN_START handler with the real behavior
      // document as `this` (the chain reads this.system / this.parent.parent).
      const handler = HazardDamageBehaviorType.events[CONST.REGION_EVENTS.TOKEN_TURN_START];
      assert.isFunction(handler, "TOKEN_TURN_START handler is registered");

      const before = game.messages.size;
      await handler.call(beh, {
        name: CONST.REGION_EVENTS.TOKEN_TURN_START,
        data: { token: { actor } },   // the handler reads only token.actor
        user: game.user,
      });
      assert.ok(game.messages.size > before, "a chat card was posted after hazard-damage apply");
    });

  });
}
