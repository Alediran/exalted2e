import { assertTestWorld, getTestScene }     from "../_helpers/world.mjs";
import { sweep }                             from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import {
  startTempCombat, advanceToActor, commitAction
} from "../_helpers/combat.mjs";
import {
  registerTestHandler, setMultiTickAction, getMultiTickAction
} from "../_helpers/multi-tick.mjs";

const TEST_KEY = "quench-test-action";

/**
 * Set a pending action on the combatant — used to drive planCommitOther
 * via commitAction (the production code path that fires onCommitOther).
 */
async function setPendingAction(combatant, { actionKey = "TestPending", speed = 5 }) {
  await combatant.update({
    "flags.exalted2e.pendingAction": {
      actionKey, label: actionKey, speed,
      dvPenalty: 0, abortable: false, dvEffectId: null
    }
  });
}

export function registerMultiTick(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("multi-tick container", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. dispatchTickAdvance while ticksElapsed < totalTicks
    it("calls onTick (and not onComplete) while incomplete", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      const { records } = await registerTestHandler(TEST_KEY);
      await setMultiTickAction(combatant, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: {}
      });
      const { dispatchTickAdvance } = await import("../../../module/combat/multi-tick.mjs");
      await dispatchTickAdvance(combatant, combat);

      assert.equal(records.onTick.length, 1,    "onTick called once");
      assert.equal(records.onComplete.length, 0, "onComplete not called (mid-action)");
      assert.equal(getMultiTickAction(combatant)?.ticksElapsed, 2, "ticksElapsed advanced");
    });

    // 2. dispatchTickAdvance reaching ticksRequired
    it("calls onComplete (and onTick) when reaching the cycle boundary", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      const { records } = await registerTestHandler(TEST_KEY);
      // ticksElapsed=4, totalTicks=5 → next advance hits the boundary (cycle complete).
      await setMultiTickAction(combatant, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 4, cycleCount: 0, state: {}
      });
      const { dispatchTickAdvance } = await import("../../../module/combat/multi-tick.mjs");
      await dispatchTickAdvance(combatant, combat);

      assert.equal(records.onComplete.length, 1, "onComplete called once on boundary");
      assert.equal(records.onTick.length, 1,     "onTick still fires every advance");
    });

    // 3. Cycle action increments cycleCount on boundary
    it("increments cycleCount when crossing the boundary", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      await registerTestHandler(TEST_KEY);
      await setMultiTickAction(combatant, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 3,
        ticksElapsed: 2, cycleCount: 0, state: {}
      });
      const { dispatchTickAdvance } = await import("../../../module/combat/multi-tick.mjs");
      await dispatchTickAdvance(combatant, combat);

      const action = getMultiTickAction(combatant);
      // advanceTickState clamps ticksElapsed at totalTicks on the boundary;
      // cycleCount bumps atomically with the boundary transition.
      assert.equal(action.cycleCount, 1, "cycleCount incremented on boundary");
    });

    // 4. planCommitOther fires onCommitOther when committing a different action
    it("dispatches onCommitOther when commit fires with a non-multi-tick pending action", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      const { records } = await registerTestHandler(TEST_KEY, {
        // Real handlers return clearAction. The test handler defaults to
        // false; here we test that the production code RECEIVED our call.
      });
      await setMultiTickAction(combatant, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: {}
      });
      await setPendingAction(combatant, { actionKey: "TestOther", speed: 5 });
      await commitAction(combat, a, 5);

      assert.equal(records.onCommitOther.length, 1,
        "onCommitOther called once when commit fires with different pendingAction");
      const call = records.onCommitOther[0];
      assert.equal(call.action.actionKey, TEST_KEY);
      assert.equal(call.pending?.actionKey, "TestOther");
    });

    // 5. dispatchTickAdvance on combatant with NO multiTickAction → no-op, no errors
    it("is a no-op on a combatant with no multiTickAction", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      const { records } = await registerTestHandler(TEST_KEY);
      // Don't set multiTickAction — combatant should be skipped.
      const { dispatchTickAdvance } = await import("../../../module/combat/multi-tick.mjs");
      await dispatchTickAdvance(combatant, combat);

      assert.equal(records.onTick.length, 0,     "onTick not called");
      assert.equal(records.onComplete.length, 0, "onComplete not called");
    });

    // 6. dispatchTickAdvance for an actionKey with no registered handler
    it("is a no-op when the multiTickAction's actionKey has no handler registered", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      // Don't register a handler — set a multiTickAction with a key that
      // doesn't exist in EX2E.multiTickHandlers.
      await setMultiTickAction(combatant, {
        actionKey: "no-such-key", startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: {}
      });
      const { dispatchTickAdvance } = await import("../../../module/combat/multi-tick.mjs");
      // Should not throw.
      await dispatchTickAdvance(combatant, combat);
      // Action should be untouched.
      const action = getMultiTickAction(combatant);
      assert.equal(action.ticksElapsed, 1, "untouched (no handler ran)");
    });

    // 7. Two combatants with multi-tick actions, both dispatched on advanceWheel
    it("dispatches once per combatant with a multi-tick action on advanceWheel", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const b = await createTempCharacter({ name: "Bob" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      await placeToken(b, sc, { x: 100, y: 0 });
      const combat = await startTempCombat([a, b], {
        jbStubsByActorId: { [a.id]: 5, [b.id]: 5 }
      });

      const { records } = await registerTestHandler(TEST_KEY);
      const ca = combat.combatants.find(c => c.actorId === a.id);
      const cb = combat.combatants.find(c => c.actorId === b.id);
      await setMultiTickAction(ca, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: { who: "a" }
      });
      await setMultiTickAction(cb, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: { who: "b" }
      });

      // advanceWheel iterates combatants and calls dispatchTickAdvance on each.
      await advanceToActor(combat, a);
      await commitAction(combat, a, 1);
      // The other combatant (b) is still free; advance them via a
      // pass-action commit to land on the same tick before the wheel bumps.
      await advanceToActor(combat, b);
      await commitAction(combat, b, 1);
      // Now both have actedThisTick. advanceWheel will dispatch tick advance
      // for both before clearing acted flags.
      const startCount = records.onTick.length;
      const { advanceWheel } = await import("../_helpers/combat.mjs");
      await advanceWheel(combat);
      // Each combatant's dispatchTickAdvance fires onTick once.
      assert.equal(records.onTick.length - startCount, 2,
        "onTick fired once per combatant (2 total)");
    });

    // 8. clearAllMultiTickActions clears flags + fires onAbort
    it("clearAllMultiTickActions clears the flag and fires onAbort", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      const combatant = combat.combatants.find(c => c.actorId === a.id);

      const { records } = await registerTestHandler(TEST_KEY);
      await setMultiTickAction(combatant, {
        actionKey: TEST_KEY, startTick: 0, totalTicks: 5,
        ticksElapsed: 1, cycleCount: 0, state: {}
      });

      const { clearAllMultiTickActions } = await import("../../../module/combat/multi-tick.mjs");
      await clearAllMultiTickActions(combat);

      assert.equal(records.onAbort.length, 1,
        "onAbort called for the combatant whose action was cleared");
      assert.notOk(getMultiTickAction(combatant), "multiTickAction flag cleared");
    });
  });
}
