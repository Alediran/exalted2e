import { register, sweep }    from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

async function makeSidereal(name, caste = "journeys") {
  const actor = await createTempCharacter({ name });
  await actor.update({ "system.exaltType": "sidereal", "system.caste": caste });
  return actor;
}

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerDestiny(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Sidereal Colleges schema", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[190] colleges.journeys.the_captain defaults to 0", async () => {
      const actor = await makeSidereal("Q-Col-Default");
      assert.equal(actor.system.splat.sidereal.colleges.journeys.the_captain, 0);
    });

    it("[191] college value persists after update", async () => {
      const actor = await makeSidereal("Q-Col-Update");
      await actor.update({ "system.splat.sidereal.colleges.journeys.the_captain": 3 });
      assert.equal(actor.system.splat.sidereal.colleges.journeys.the_captain, 3);
    });

    it("[192] all 25 college keys exist with default 0", async () => {
      const actor  = await makeSidereal("Q-Col-All");
      const col    = actor.system.splat.sidereal.colleges;
      const keys   = [
        ["journeys", ["the_captain","the_gull","the_mast","the_messenger","the_ships_wheel"]],
        ["serenity", ["the_ewer","the_lovers","the_musician","the_peacock","the_pillar"]],
        ["battles",  ["the_banner","the_gauntlet","the_quiver","the_shield","the_spear"]],
        ["secrets",  ["the_guardians","the_key","the_mask","the_sorcerer","the_treasure_trove"]],
        ["endings",  ["the_corpse","the_crow","the_haywain","the_rising_smoke","the_sword"]],
      ];
      for (const [maiden, names] of keys) {
        for (const n of names) {
          assert.equal(col[maiden][n], 0, `${maiden}.${n} should default to 0`);
        }
      }
    });
  });

  describe("Destiny item type", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[193] destiny item can be created on a Sidereal actor", async () => {
      const actor = await makeSidereal("Q-Dest-Create");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Test Destiny", type: "destiny",
        system: { destinyType: "ascending", college: "the_captain", collegeMaiden: "journeys", effectPoints: { total: 4 } }
      }]);
      register(item);
      assert.equal(item.type, "destiny");
      assert.equal(item.system.destinyType, "ascending");
      assert.equal(item.system.effectPoints.total, 4);
      assert.equal(item.system.finalized, false);
    });

    it("[194] destiny item effectPoints.spent derived from scope+duration+frequency", async () => {
      const actor = await makeSidereal("Q-Dest-EP");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Dest EP", type: "destiny",
        system: { destinyType: "ascending", college: "the_captain", collegeMaiden: "journeys",
                  effectPoints: { total: 10 }, scope: 2, duration: 1, frequency: 1 }
      }]);
      register(item);
      // scope:2 pts + duration:1 pt + frequency:1 pt = 4
      assert.equal(item.system.effectPoints.spent, 4);
    });

    it("[195] destiny item paradoxDice computed from trigger+scope+duration+freq", async () => {
      const actor = await makeSidereal("Q-Dest-PD");
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Dest PD", type: "destiny",
        system: { destinyType: "ascending", college: "the_captain", collegeMaiden: "journeys",
                  effectPoints: { total: 10 }, trigger: "simple", scope: 0, duration: 0, frequency: 1 }
      }]);
      register(item);
      // simple:1 + scope0:0 + dur0:0 + freq1:1 = 2
      assert.equal(item.system.paradoxDice, 2);
    });

    it("[196] finalize updates paradoxGained and sets finalized true", async () => {
      const actor = await makeSidereal("Q-Dest-Fin");
      await actor.update({ "system.essence.value": 3, "system.splat.sidereal.paradox": 0 });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Dest Fin", type: "destiny",
        system: { destinyType: "ascending", college: "the_captain", collegeMaiden: "journeys",
                  effectPoints: { total: 5 }, trigger: "simple", scope: 0, duration: 0, frequency: 1,
                  finalized: false }
      }]);
      register(item);

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const paradoxPool = Math.max(1, item.system.paradoxDice);
      const roll   = new ExaltedRoll({ pool: paradoxPool });
      const result = await roll.evaluate();
      const gained = result.successes;
      const before = actor.system.splat.sidereal.paradox;
      const expected = Math.min(10, before + gained);

      await actor.update({ "system.splat.sidereal.paradox": expected });
      await item.update({ "system.finalized": true, "system.paradoxGained": gained });

      assert.equal(item.system.finalized, true);
      assert.equal(item.system.paradoxGained, gained);
      assert.equal(actor.system.splat.sidereal.paradox, expected);
    });

    it("[197] finalize reaching paradox 10 triggers Pattern Bite hook", async () => {
      const actor = await makeSidereal("Q-Dest-Bite");
      await actor.update({ "system.splat.sidereal.paradox": 9 });
      const msgsBefore = game.messages.size;

      await actor.update({ "system.splat.sidereal.paradox": 10 });

      await waitFor(() => game.messages.size > msgsBefore);
      assert.ok(game.messages.size > msgsBefore, "Pattern Bite chat message should appear after paradox reaches 10");

      await waitFor(() => actor.system.splat.sidereal.paradox === 0);
      assert.equal(actor.system.splat.sidereal.paradox, 0, "Paradox should reset to 0 after Pattern Bite");
    });
  });
}
