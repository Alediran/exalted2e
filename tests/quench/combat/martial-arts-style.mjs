import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
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

export function registerMartialArtsStyle(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("martialartsstyle — auto-add hook", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MAS-1] creates a style item when first MA charm is added", async () => {
      const actor = await createTempCharacter({ name: "MA Quench Actor" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Snake Strike",
        type: "charm",
        system: {
          ability:              "martialarts",
          martialArtsStyleName: "Quench Test Style",
          martialArtsTier:      "terrestrial"
        }
      }]);

      const styleItem = await waitFor(
        () => actor.items.find(i => i.type === "martialartsstyle" && i.name === "Quench Test Style")
      );
      assert.ok(styleItem, "martialartsstyle item was auto-created on the actor");
      assert.equal(styleItem.system.tier, "terrestrial", "tier copied from charm's martialArtsTier");
    });

    it("[MAS-2] does not create a duplicate when a second charm from the same style is added", async () => {
      const actor = await createTempCharacter({ name: "MA Quench Actor 2" });

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Snake Strike",
        type: "charm",
        system: { ability: "martialarts", martialArtsStyleName: "Quench Test Style 2", martialArtsTier: "celestial" }
      }]);
      await waitFor(() => actor.items.find(i => i.type === "martialartsstyle" && i.name === "Quench Test Style 2"));

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Snake Form",
        type: "charm",
        system: { ability: "martialarts", martialArtsStyleName: "Quench Test Style 2", martialArtsTier: "celestial" }
      }]);
      await new Promise(r => setTimeout(r, 250));

      const styleItems = actor.items.filter(i => i.type === "martialartsstyle" && i.name === "Quench Test Style 2");
      assert.equal(styleItems.length, 1, "only one martialartsstyle item exists after two charms from same style");
    });

    it("[MAS-3] does not create a style item for non-MA charms", async () => {
      const actor = await createTempCharacter({ name: "MA Quench Actor 3" });
      const before = actor.items.filter(i => i.type === "martialartsstyle").length;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Solar Charm",
        type: "charm",
        system: { ability: "melee", martialArtsStyleName: "" }
      }]);
      await new Promise(r => setTimeout(r, 250));

      const after = actor.items.filter(i => i.type === "martialartsstyle").length;
      assert.equal(after, before, "no martialartsstyle item created for non-MA charm");
    });
  });
}
