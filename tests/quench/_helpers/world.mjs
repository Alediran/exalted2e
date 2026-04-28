/**
 * World-fixture helpers.
 *
 * `assertTestWorld()` is called from each batch's `before` hook so a typo'd
 * world or an accidental run against real campaign data aborts before any
 * document is created.
 *
 * `getTestScene()` looks up the hand-created fixture scene by name. The
 * fixture exists so canvas.scene is populated when knockback's token
 * translate runs.
 */

const TEST_WORLD_ID      = "exalted2e-test";
const FIXTURE_SCENE_NAME = "Quench Fixture";

export function assertTestWorld() {
  if (game.world.id !== TEST_WORLD_ID) {
    throw new Error(
      `Quench batch refused to run — expected world id '${TEST_WORLD_ID}' ` +
      `but got '${game.world.id}'. Switch worlds before running tests.`
    );
  }
}

export function getTestScene() {
  const scene = game.scenes.getName(FIXTURE_SCENE_NAME);
  if (!scene) {
    throw new Error(
      `Fixture scene '${FIXTURE_SCENE_NAME}' missing — re-seed the test world.`
    );
  }
  return scene;
}
