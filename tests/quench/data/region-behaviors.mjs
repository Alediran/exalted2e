import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { createTempCharacter }          from "../_helpers/actors.mjs";
import { placeToken }                   from "../_helpers/scenes.mjs";

export function registerRegionBehaviors(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Region behaviors (hazard/terrain)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── [RB-1] TerrainModifier schema defaults ───────────────────────────────

    it("[RB-1] terrainModifier behavior has correct schema defaults", async () => {
      const scene = getTestScene();

      // Create a Region on the fixture scene.
      const [region] = await scene.createEmbeddedDocuments("Region", [{
        name: "Q-TerrainModifier-Region",
      }]);
      register(region);

      // Create the behavior on that region.
      const [beh] = await region.createEmbeddedDocuments("RegionBehavior", [{
        name: "Q-TerrainModifier",
        type: "ex2e.terrainModifier",
        system: {},
      }]);
      // behaviors are embedded in the region; region cleanup cascades to them,
      // but register explicitly to be safe.
      register(beh);

      assert.equal(beh.system.terrainType,   "elevation", "terrainType default is 'elevation'");
      assert.equal(beh.system.accuracyBonus, 0,           "accuracyBonus default is 0");
      assert.equal(beh.system.dvBonus,       0,           "dvBonus default is 0");
      assert.equal(beh.system.soakBonus,     0,           "soakBonus default is 0");
      assert.equal(beh.system.label,         "",          "label default is ''");
    });

    // ── [RB-2] hazardDamage apply path posts a chat card ────────────────────
    // Test split: the three-way immune/resist/apply branch decision and the
    // pool floor are unit-tested in tests/data/region-behaviors/hazard-math.test.mjs
    // (pure, exhaustive). This in-Foundry smoke only exercises the "apply" path's
    // wiring — that triggering a region event actually rolls and posts a card.

    it("[RB-2] hazardDamage behavior posts a chat card when applied to a non-player actor", async () => {
      const scene = getTestScene();

      // createTempCharacter defaults to playerOwner: false, so hazardAction
      // returns "apply" when resistDifficulty === 0 (no player-owner resist path).
      const actor = await createTempCharacter({ name: "Q-HazardDamage-Actor" });

      const tokenDoc = await placeToken(actor, scene);

      // Create a Region, then a hazardDamage behavior on it.
      const [region] = await scene.createEmbeddedDocuments("Region", [{
        name: "Q-HazardDamage-Region",
      }]);
      register(region);

      const [beh] = await region.createEmbeddedDocuments("RegionBehavior", [{
        name: "Q-HazardDamage",
        type: "ex2e.hazardDamage",
        system: {
          damagePool:       "3",
          traumaType:       "bashing",
          resistDifficulty: 0,      // force "apply" regardless of player-owner flag
          damageOnEntry:    false,
          isSupernatural:   false,
        },
      }]);
      register(beh);

      const before = game.messages.size;

      // Drive the TOKEN_TURN_START handler directly.  RegionBehaviorType exposes
      // _handleRegionEvent(event) which dispatches via the static `events` map.
      // The handler reads event.data.token (a TokenDocument).
      await beh._handleRegionEvent({
        name: CONST.REGION_EVENTS.TOKEN_TURN_START,
        data: { token: tokenDoc },
        user: game.user,
      });

      assert.ok(game.messages.size > before, "a chat card was posted after hazard-damage apply");
    });

  });
}
