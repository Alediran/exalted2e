import { cleanupOnAfter, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

/**
 * Poll until predicate truthy or timeoutMs elapses. Returns the predicate's
 * value (so callers can capture matched values). Throws on timeout.
 */
async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/**
 * Stub `ui.notifications.info` to capture calls. Returns the call-collection
 * array; restores the original via cleanupOnAfter.
 */
function stubInfo() {
  const calls = [];
  const orig = ui.notifications.info;
  ui.notifications.info = (...args) => { calls.push(args); };
  cleanupOnAfter(() => { ui.notifications.info = orig; });
  return calls;
}

/**
 * Drop the "Creature of Darkness" wrapper from the effects pack onto the
 * given actor. Returns the wrapper document fetched from the pack (so tests
 * can read its embedded effect data for comparison).
 */
async function extractWrapper(actor) {
  const pack = game.packs.get("exalted2e.effects");
  const index = await pack.getIndex();
  const expectedName = game.i18n.localize("EX2E.CreatureOfDarkness");
  const indexed = index.find(e => e.name === expectedName);
  if (!indexed) throw new Error(`extractWrapper: '${expectedName}' not in pack`);
  const wrapper = await pack.getDocument(indexed._id);
  await actor.createEmbeddedDocuments("Item", [wrapper.toObject()]);
  return wrapper;
}

export function registerEffectWrapper(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("effect wrapper — compendium and extraction", () => {
    before(function () {
      assertTestWorld();
      // The effects pack is built from src/packs and is dev-only; skip gracefully
      // when it is not present in the current Foundry installation.
      if (!game.packs.get("exalted2e.effects")) this.skip();
    });
    afterEach(async () => { await sweep(); });

    // Test 1: Pack contains the seeded entries
    it("[112] contains every entry from _EFFECT_WRAPPER_SEEDS", async () => {
      const pack = game.packs.get("exalted2e.effects");
      assert.ok(pack, "exalted2e.effects pack exists");

      const index = await pack.getIndex();
      const indexedNames = new Set(index.map(e => e.name));

      const expectedNames = [
        game.i18n.localize("EX2E.CreatureOfDarkness")
      ];
      for (const name of expectedNames) {
        assert.ok(indexedNames.has(name),
          `pack contains seeded entry: ${name}`);
      }
    });

    // Test 2: Wrapper extraction on drop
    it("[113] extracts the embedded AE onto the actor and cancels the item creation", async () => {
      const actor = await createTempCharacter({ name: "Q-Wrapper-Drop" });
      const infoCalls = stubInfo();

      await extractWrapper(actor);
      // Hook fires the AE creation fire-and-forget — poll for it.
      await waitFor(() => actor.effects.size === 1);

      // Item creation cancelled — actor.items has no Creature of Darkness entry
      const matchingItems = Array.from(actor.items).filter(i =>
        i.name === game.i18n.localize("EX2E.CreatureOfDarkness")
      );
      assert.equal(matchingItems.length, 0,
        "wrapper item was NOT created on actor");

      // AE landed on actor — exactly one effect
      assert.equal(actor.effects.size, 1,
        "exactly one ActiveEffect created on actor");

      // Notification was emitted
      assert.equal(infoCalls.length, 1,
        "ui.notifications.info called exactly once");
    });

    // Test 3: AE flag preservation
    it("[114] preserves the seeded AE flags on the extracted effect", async () => {
      const actor = await createTempCharacter({ name: "Q-Wrapper-Flags" });
      stubInfo();

      await extractWrapper(actor);
      // Hook fires the AE creation fire-and-forget — poll for it.
      await waitFor(() => actor.effects.size === 1);

      const effect = actor.effects.contents[0];
      assert.ok(effect, "AE present on actor");
      assert.equal(effect.getFlag("exalted2e", "creatureOfDarkness"), true,
        "creatureOfDarkness flag preserved");
      assert.equal(effect.getFlag("exalted2e", "gmOnlyRemoval"), true,
        "gmOnlyRemoval flag preserved");
    });
  });
}
