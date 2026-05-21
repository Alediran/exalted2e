import { cleanupOnAfter, sweep }          from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene }  from "../_helpers/world.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { placeToken }                     from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor } from "../_helpers/combat.mjs";

function stubWarn() {
  const calls = [];
  const orig = ui.notifications.warn;
  ui.notifications.warn = (...args) => { calls.push(args); };
  cleanupOnAfter(() => { ui.notifications.warn = orig; });
  return calls;
}

/** Minimal Action-Only charm data. Zero costs so nothing else can fail. */
function actionOnlyCharmData(name = "Test Action-Only") {
  return {
    name,
    type: "charm",
    system: {
      ability: "melee",
      keywords: ["Action-Only"],
      charmType: "reflexive",
      duration: "instant",
      cost: { formula: "—" }
    }
  };
}

export function registerKeywordGating(context) {
  const { describe, it, assert, before, afterEach } = context;

  // ── Native keyword gate ──────────────────────────────────────────────────

  describe("Native charm gating", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[KG168] blocks an Eclipse caste from adding a Native charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Native-Eclipse" });
      await actor.update({ "system.exaltType": "solar", "system.caste": "eclipse", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Native", type: "charm",
        system: { ability: "survival", keywords: ["Native"] }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created for Eclipse");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[KG169] blocks a Moonshadow caste from adding a Native charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Native-Moonshadow" });
      await actor.update({ "system.exaltType": "abyssal", "system.caste": "moonshadow", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Native", type: "charm",
        system: { ability: "survival", keywords: ["Native"] }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created for Moonshadow");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[KG170] blocks a Fiend caste from adding a Native charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Native-Fiend" });
      await actor.update({ "system.exaltType": "infernal", "system.caste": "fiend", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Native", type: "charm",
        system: { ability: "survival", keywords: ["Native"] }
      }]);

      assert.equal(actor.items.size, sizeBefore, "charm must NOT be created for Fiend");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[KG171] allows a non-mirror caste to add a Native charm", async () => {
      const actor = await createTempCharacter({ name: "Q-Native-Zenith" });
      await actor.update({ "system.exaltType": "solar", "system.caste": "zenith", "system.purchaseLocked": false });
      const warns = stubWarn();
      const sizeBefore = actor.items.size;

      await actor.createEmbeddedDocuments("Item", [{
        name: "Test Native", type: "charm",
        system: { ability: "survival", keywords: ["Native"] }
      }]);

      assert.equal(actor.items.size, sizeBefore + 1, "charm must be created for Zenith");
      assert.equal(warns.length, 0, "no warning for a non-mirror caste");
    });
  });

  // ── Action-Only keyword gate ─────────────────────────────────────────────

  describe("Action-Only charm gating", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    async function setupCombat() {
      const actor   = await createTempCharacter({ name: "Q-AO-Actor" });
      const other   = await createTempCharacter({ name: "Q-AO-Other" });
      const sc      = getTestScene();
      await placeToken(actor,  sc, { x: 0,   y: 0 });
      await placeToken(other,  sc, { x: 100, y: 0 });
      const combat  = await startTempCombat([actor, other], {
        jbStubsByActorId: { [actor.id]: 5, [other.id]: 0 }
      });
      return { actor, other, combat };
    }

    it("[KG172] blocks activation when NOT the actor's combat turn", async () => {
      const { actor, other, combat } = await setupCombat();
      // Advance so `other` is the current combatant (actor is not acting)
      await advanceToActor(combat, other);

      const [charm] = await actor.createEmbeddedDocuments("Item", [actionOnlyCharmData()]);
      const warns   = stubWarn();

      const result = await charm.activateCharm();

      assert.equal(result, false, "activateCharm must return false when not actor's turn");
      assert.equal(warns.length, 1, "warn must fire exactly once");
    });

    it("[KG173] allows activation when IS the actor's combat turn", async function () {
      const { actor, combat } = await setupCombat();
      await advanceToActor(combat, actor);

      const [charm] = await actor.createEmbeddedDocuments("Item", [actionOnlyCharmData()]);
      const warns   = stubWarn();

      const result = await charm.activateCharm();

      assert.notEqual(result, false, "activateCharm must not be blocked on actor's own turn");
      assert.equal(warns.length, 0, "no Action-Only warning on own turn");
    });

    it("[KG174] allows activation outside of any active combat", async function () {
      const actor   = await createTempCharacter({ name: "Q-AO-NoCombat" });
      const [charm] = await actor.createEmbeddedDocuments("Item", [actionOnlyCharmData()]);
      const warns   = stubWarn();

      const result = await charm.activateCharm();

      assert.notEqual(result, false, "activateCharm must not be blocked when no combat");
      assert.equal(warns.length, 0, "no Action-Only warning outside combat");
    });
  });
}
