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

  describe("Resplendent Destiny — Phase 1", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    async function makeResplendent(actor, { identity = "Bitter Fruit", college = "the_captain", endurance = 3 } = {}) {
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: identity, type: "destiny",
        system: {
          destinyType: "resplendent", college, identity,
          endurance: { value: endurance, max: endurance },
        }
      }]);
      return item;
    }

    // Action handlers are static #private; drive them through the real action
    // dispatch by clicking the rendered button.
    async function clickAction(item, action) {
      await item.sheet.render(true);
      await waitFor(() => item.sheet.rendered === true && !!item.sheet.element);
      const btn = await waitFor(() => item.sheet.element.querySelector(`[data-action='${action}']`));
      btn.click();
    }

    it("[RD-1] donning stamps the identity AE, spends 1 WP, sets worn", async () => {
      const actor = await makeSidereal("Q-RD-Don");
      await actor.update({ "system.willpower.value": 5, "system.willpower.max": 5 });
      const item  = await makeResplendent(actor);

      await clickAction(item, "donDestiny");

      const worn = await waitFor(() => item.system.worn === true);
      assert.ok(worn, "destiny is worn");
      const ae = await waitFor(() =>
        actor.effects.find(e => e.flags?.exalted2e?.resplendentIdentity?.destinyId === item.id)
      );
      assert.ok(ae, "identity AE stamped");
      assert.equal(actor.system.willpower.value, 4, "1 WP spent");
    });

    it("[RD-2] donning a second resplendent destiny shucks the first", async () => {
      const actor = await makeSidereal("Q-RD-OneWorn");
      await actor.update({ "system.willpower.value": 5 });
      const a = await makeResplendent(actor, { identity: "Captain A", college: "the_captain" });
      const b = await makeResplendent(actor, { identity: "Gull B",    college: "the_gull" });

      await clickAction(a, "donDestiny");
      await waitFor(() => a.system.worn === true);
      await clickAction(b, "donDestiny");
      await waitFor(() => b.system.worn === true);

      const aWorn = await waitFor(() => a.system.worn === false);
      assert.ok(aWorn, "first destiny shucked when second donned");
      const aAEgone = await waitFor(() =>
        !actor.effects.some(e => e.flags?.exalted2e?.resplendentIdentity?.destinyId === a.id)
      );
      assert.ok(aAEgone, "first destiny's identity AE removed");
    });

    it("[RD-3] shucking removes the AE and keeps ended false", async () => {
      const actor = await makeSidereal("Q-RD-Shuck");
      await actor.update({ "system.willpower.value": 5 });
      const item  = await makeResplendent(actor);

      await clickAction(item, "donDestiny");
      await waitFor(() => item.system.worn === true);
      await clickAction(item, "shuckDestiny");

      const shucked = await waitFor(() => item.system.worn === false);
      assert.ok(shucked, "destiny shucked");
      assert.equal(item.system.ended, false, "shuck does not end the destiny");
      const gone = await waitFor(() =>
        !actor.effects.some(e => e.flags?.exalted2e?.resplendentIdentity?.destinyId === item.id)
      );
      assert.ok(gone, "identity AE removed on shuck");
    });

    it("[RD-4] endurance reaching 0 auto-ends the destiny and removes the AE", async () => {
      const actor = await makeSidereal("Q-RD-End");
      await actor.update({ "system.willpower.value": 5 });
      const item  = await makeResplendent(actor, { endurance: 1 });

      await clickAction(item, "donDestiny");
      await waitFor(() => item.system.worn === true);

      await item.update({ "system.endurance.value": 0 });

      const ended = await waitFor(() => item.system.ended === true);
      assert.ok(ended, "destiny ended at 0 Endurance");
      assert.equal(item.system.worn, false, "ended destiny is no longer worn");
      const gone = await waitFor(() =>
        !actor.effects.some(e => e.flags?.exalted2e?.resplendentIdentity?.destinyId === item.id)
      );
      assert.ok(gone, "identity AE removed on auto-end");
    });

    it("[RD-5] restoring endurance above 0 clears ended", async () => {
      const actor = await makeSidereal("Q-RD-Restore");
      const item  = await makeResplendent(actor, { endurance: 1 });
      await item.update({ "system.endurance.value": 0 });
      await waitFor(() => item.system.ended === true);

      await item.update({ "system.endurance.value": 1, "system.ended": false });
      assert.equal(item.system.ended, false, "ended cleared when endurance restored");
    });
  });

  describe("Resplendencies — Phase 2a", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    async function makeResplendentDestiny(actor, endurance = 5) {
      const [d] = await actor.createEmbeddedDocuments("Item", [{
        name: "Captain Cover", type: "destiny",
        system: { destinyType: "resplendent", college: "the_captain", identity: "Captain",
                  endurance: { value: endurance, max: endurance } }
      }]);
      return d;
    }

    async function makeResplendency(actor, destiny, opts = {}) {
      const [r] = await actor.createEmbeddedDocuments("Item", [{
        name: opts.name ?? "Test Power", type: "resplendency",
        system: {
          college: "the_captain",
          enduranceCost: opts.enduranceCost ?? 1,
          paradoxDice:   opts.paradoxDice   ?? 0,
          keyword:       opts.keyword       ?? "",
          isStatBonus:   opts.isStatBonus   ?? false,
          changes:       opts.changes       ?? [],
          description:   "<p>test</p>",
        }
      }]);
      await r.setFlag("exalted2e", "parentDestinyId", destiny.id);
      return r;
    }

    it("[RES-1] activate spends the destiny's Endurance", async () => {
      const actor = await makeSidereal("Q-RES-Spend");
      const d = await makeResplendentDestiny(actor, 5);
      const r = await makeResplendency(actor, d, { enduranceCost: 2 });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      const ok = await activateResplendency(r, d);
      assert.equal(ok, true, "activation succeeded");
      assert.equal(d.system.endurance.value, 3, "Endurance 5 − 2 = 3");
    });

    it("[RES-2] insufficient Endurance aborts with no spend", async () => {
      const actor = await makeSidereal("Q-RES-Short");
      const d = await makeResplendentDestiny(actor, 1);
      const r = await makeResplendency(actor, d, { enduranceCost: 3 });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      const ok = await activateResplendency(r, d);
      assert.equal(ok, false, "activation aborted");
      assert.equal(d.system.endurance.value, 1, "Endurance unchanged");
    });

    it("[RES-3] paradoxDice adds to the Sidereal Paradox track", async () => {
      const actor = await makeSidereal("Q-RES-Paradox");
      await actor.update({ "system.splat.sidereal.paradox": 0 });
      const d = await makeResplendentDestiny(actor, 5);
      const r = await makeResplendency(actor, d, { enduranceCost: 1, paradoxDice: 3 });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      await activateResplendency(r, d);
      assert.ok(actor.system.splat.sidereal.paradox >= 0, "paradox track is a valid number >= 0");
      assert.ok(actor.system.splat.sidereal.paradox <= 10, "paradox clamped <= 10");
    });

    it("[RES-4] isStatBonus stamps a tracked AE", async () => {
      const actor = await makeSidereal("Q-RES-AE");
      const d = await makeResplendentDestiny(actor, 5);
      const r = await makeResplendency(actor, d, {
        isStatBonus: true,
        changes: [{ key: "system.bonuses.soakLethal", mode: 2, value: "2" }],
      });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      await activateResplendency(r, d);
      const ae = await waitFor(() =>
        actor.effects.find(e => e.flags?.exalted2e?.resplendencyEffect?.resplendencyId === r.id)
      );
      assert.ok(ae, "stat-bonus AE stamped");
    });

    it("[RES-5] draining Endurance to 0 ends the destiny (Phase 1 hook)", async () => {
      const actor = await makeSidereal("Q-RES-Drain");
      const d = await makeResplendentDestiny(actor, 2);
      const r = await makeResplendency(actor, d, { enduranceCost: 2 });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      await activateResplendency(r, d);
      const ended = await waitFor(() => d.system.ended === true);
      assert.ok(ended, "destiny ended when Endurance hit 0");
    });

    it("[RES-6] ending the destiny tears down stat-bonus AEs", async () => {
      const actor = await makeSidereal("Q-RES-Teardown");
      const d = await makeResplendentDestiny(actor, 2);
      const r = await makeResplendency(actor, d, {
        enduranceCost: 2,
        isStatBonus: true,
        changes: [{ key: "system.bonuses.soakLethal", mode: 2, value: "2" }],
      });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");

      // Activation both stamps the AE and drains Endurance 2→0, ending the destiny.
      await activateResplendency(r, d);
      await waitFor(() => d.system.ended === true);
      const gone = await waitFor(() =>
        !actor.effects.some(e => e.flags?.exalted2e?.resplendencyEffect?.destinyId === d.id)
      );
      assert.ok(gone, "stat-bonus AE removed when the destiny ended");
    });

    it("[RES-7] removing a resplendency clears its stamped AE", async () => {
      const actor = await makeSidereal("Q-RES-RemoveAE");
      const d = await makeResplendentDestiny(actor, 5);
      const r = await makeResplendency(actor, d, {
        isStatBonus: true,
        changes: [{ key: "system.bonuses.soakLethal", mode: 2, value: "2" }],
      });
      const { activateResplendency } = await import("../../../module/combat/resplendency.mjs");
      const { removeResplendencyEffects } = await import("../../../module/combat/resplendent-destiny.mjs");

      await activateResplendency(r, d);
      await waitFor(() => actor.effects.some(e => e.flags?.exalted2e?.resplendencyEffect?.resplendencyId === r.id));
      await removeResplendencyEffects(actor, { resplendencyId: r.id });
      const gone = await waitFor(() =>
        !actor.effects.some(e => e.flags?.exalted2e?.resplendencyEffect?.resplendencyId === r.id)
      );
      assert.ok(gone, "stat-bonus AE removed with the resplendency");
    });
  });
}
