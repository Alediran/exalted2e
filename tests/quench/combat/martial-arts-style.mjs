import { cleanupOnAfter, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld }       from "../_helpers/world.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

function stubWarn() {
  const calls = [];
  const orig = ui.notifications.warn;
  ui.notifications.warn = (...args) => { calls.push(args); };
  cleanupOnAfter(() => { ui.notifications.warn = orig; });
  return calls;
}

function stubNonGM() {
  Object.defineProperty(game.user, "isGM", { value: false, configurable: true, writable: true });
  cleanupOnAfter(() => {
    delete game.user.isGM; // remove instance override; prototype getter is restored
  });
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

  // ── DB Celestial MA initiation gate ─────────────────────────────────────────

  describe("DB Celestial MA initiation gate", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MAS-4] blocks a terrestrial actor without initiation from learning a Celestial MA charm", async () => {
      const actor = await createTempCharacter({ name: "Q-DB-Celestial-Block" });
      await actor.update({ "system.exaltType": "terrestrial", "system.purchaseLocked": false });
      stubNonGM();
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Celestial MA Charm",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "celestial", martialArtsStyleName: "Snake Style" }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created for un-initiated DB");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[MAS-5] allows a terrestrial actor WITH a grantsCelestialMA charm to learn a Celestial MA charm", async () => {
      const actor = await createTempCharacter({ name: "Q-DB-Celestial-Allow" });
      await actor.update({ "system.exaltType": "terrestrial", "system.purchaseLocked": false });
      await actor.createEmbeddedDocuments("Item", [{
        name: "Pasiap's Humility",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "terrestrial", grantsCelestialMA: true }
      }]);
      stubNonGM();
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Celestial MA Charm",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "celestial", martialArtsStyleName: "Snake Style" }
      }]);

      assert.equal(actor.items.size, sizeBefore + 1, "charm must be created for initiated DB");
      assert.equal(warns.length, 0, "no warning for an initiated DB");
    });

    it("[MAS-6] allows a non-terrestrial actor to learn a Celestial MA charm without initiation", async () => {
      const actor = await createTempCharacter({ name: "Q-Solar-Celestial-Allow" });
      await actor.update({ "system.exaltType": "solar", "system.purchaseLocked": false });
      stubNonGM();
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Celestial MA Charm",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "celestial", martialArtsStyleName: "Snake Style" }
      }]);

      assert.equal(actor.items.size, sizeBefore + 1, "charm must be created for a Solar");
      assert.equal(warns.length, 0, "no warning for a non-terrestrial");
    });
  });

  // ── Sidereal MA mastery gate ─────────────────────────────────────────────────

  describe("Sidereal MA mastery gate", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MAS-7] blocks an actor without a mastered Celestial charm from learning a Sidereal MA charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Sidereal-Block" });
      await actor.update({ "system.exaltType": "sidereal", "system.purchaseLocked": false });
      stubNonGM();
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Sidereal MA Charm",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "sidereal", martialArtsStyleName: "Prismatic Arrangement of Creation Style" }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created without Celestial mastery");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[MAS-8] allows an actor WITH a mastered Celestial charm to learn a Sidereal MA charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Sidereal-Allow" });
      await actor.update({ "system.exaltType": "sidereal", "system.purchaseLocked": false });
      await actor.createEmbeddedDocuments("Item", [{
        name: "Sidereal Form",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "celestial", grantsMastery: true, martialArtsStyleName: "Snake Style" }
      }]);
      // The createItem hook auto-creates the "Snake Style" martialartsstyle asynchronously.
      // Poll until it lands so sizeBefore is stable.
      const deadline = Date.now() + 2000;
      while (!actor.items.some(i => i.type === "martialartsstyle" && i.name === "Snake Style")) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }
      stubNonGM();
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Sidereal MA Charm",
        type: "charm",
        system: { ability: "martialarts", martialArtsTier: "sidereal", martialArtsStyleName: "Prismatic Arrangement of Creation Style" }
      }]);

      assert.equal(actor.items.size, sizeBefore + 1, "charm must be created for an actor with Celestial mastery");
      assert.equal(warns.length, 0, "no warning for an actor with Celestial mastery");
    });
  });
}
