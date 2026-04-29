import { assertTestWorld, getTestScene }     from "../_helpers/world.mjs";
import { sweep }                             from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import {
  startTempCombat, commitAction, advanceWheel, advanceToActor
} from "../_helpers/combat.mjs";

/**
 * Stamp a DV-refreshable AE on an actor with the given flag shape.
 * Returns the created AE.
 */
async function stampDvAe(actor, {
  type = "test-penalty",
  value = 1,
  refreshable = true,
  sticky = false,
  label = "Test DV AE"
} = {}) {
  const [ae] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: label,
    img:  "icons/svg/shield.svg",
    flags: {
      exalted2e: {
        dvPenalty:     { type, value },
        dvRefreshable: refreshable,
        dvSticky:      sticky
      }
    },
    disabled: false,
    transfer: false
  }]);
  return ae;
}

/**
 * Set a pending action on the combatant. The dvEffectId is the id of
 * the AE that "belongs" to this declaration — the sticky-flip skips
 * any AE whose id matches.
 */
async function setPendingAction(combatant, { actionKey, dvEffectId = null, speed = 5 }) {
  await combatant.update({
    "flags.exalted2e.pendingAction": {
      actionKey, dvEffectId, speed,
      label: actionKey,
      dvPenalty: 0,
      abortable: false
    }
  });
}

export function registerDvRefresh(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("DV refresh + sticky flip", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Refreshable + non-sticky AE on combatant landing on new tick → cleared
    it("clears refreshable non-sticky AE on the combatant landing on the new tick", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const ae = await stampDvAe(a, { sticky: false, refreshable: true });
      await commitAction(combat, a, 1);  // initiative bumps to currentTick+1
      await advanceWheel(combat);        // they land on the new tick
      assert.notOk(a.effects.get(ae.id), "AE should be deleted on tick landing");
    });

    // 2. Non-refreshable AE → not deleted
    it("does not delete non-refreshable AE", async function () {
      const a = await createTempCharacter({ name: "Bob" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const ae = await stampDvAe(a, { refreshable: false });
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      assert.ok(a.effects.get(ae.id), "non-refreshable AE should survive");
    });

    // 3. Combatant NOT landing on new tick → AEs untouched
    it("leaves AEs alone on a combatant who is mid-action (not landing on new tick)", async function () {
      // Two combatants, force speed gap so only one lands on the new tick.
      const a = await createTempCharacter({ name: "Caster" });
      const b = await createTempCharacter({ name: "Other" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      await placeToken(b, sc, { x: 100, y: 0 });
      // b lands at tick 5, a at tick 0 → only a is on the new tick after advanceWheel.
      const combat = await startTempCombat([a, b], {
        jbStubsByActorId: { [a.id]: 5, [b.id]: 0 }
      });
      await advanceToActor(combat, a);
      const ae = await stampDvAe(b);  // b's AE should not be touched
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      assert.ok(b.effects.get(ae.id), "b's AE should survive (b didn't land on new tick)");
    });

    // 4. Multiple AEs, mixed flags → only refreshable+non-sticky deleted
    it("deletes only the refreshable+non-sticky AEs among mixed flags", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const aeRefreshable = await stampDvAe(a, { sticky: false, refreshable: true });
      const aeSticky      = await stampDvAe(a, { sticky: true,  refreshable: true });
      const aeNonRefr     = await stampDvAe(a, { sticky: false, refreshable: false });
      // Own the sticky AE via pendingAction.dvEffectId so the sticky-flip
      // in advanceCurrentByTicks skips it (it belongs to the just-declared
      // action). Without this, the flip would clobber dvSticky=true→false
      // and the wheel-advance refresh would then delete it.
      const combatant = combat.combatants.find(c => c.actorId === a.id);
      await setPendingAction(combatant, { actionKey: "Aim", dvEffectId: aeSticky.id });
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      assert.notOk(a.effects.get(aeRefreshable.id), "refreshable+non-sticky deleted");
      assert.ok(a.effects.get(aeSticky.id),        "sticky survives");
      assert.ok(a.effects.get(aeNonRefr.id),       "non-refreshable survives");
    });

    // 5. Sticky AE survives first wheel advance
    it("sticky+refreshable AE survives the first advanceWheel", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const ae = await stampDvAe(a, { sticky: true, refreshable: true });
      // The AE belongs to the just-declared action — sticky-flip must
      // skip it on this commit (and the wheel-advance refresh must skip
      // it because dvSticky stays true).
      const combatant = combat.combatants.find(c => c.actorId === a.id);
      await setPendingAction(combatant, { actionKey: "Aim", dvEffectId: ae.id });
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      const survived = a.effects.get(ae.id);
      assert.ok(survived, "sticky AE should survive first wheel advance");
      assert.equal(survived.flags?.exalted2e?.dvSticky, true,
        "sticky flag still true after first advance");
    });

    // 6. Sticky flip on commit of DIFFERENT action: sticky → false
    it("flips dvSticky to false when a different action is committed", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      // Stamp the sticky AE first (representing a prior abortable action).
      const stickyAe = await stampDvAe(a, { sticky: true, refreshable: true });
      // Commit a "new action" — its pendingAction.dvEffectId is NULL,
      // so the sticky AE is NOT skipped during the flip.
      const combatant = combat.combatants.find(c => c.actorId === a.id);
      await setPendingAction(combatant, { actionKey: "Attack", dvEffectId: null });
      await commitAction(combat, a, 1);
      // After commit, the sticky AE should have its sticky flag flipped.
      const flipped = a.effects.get(stickyAe.id);
      assert.ok(flipped, "sticky AE still exists after commit (no advanceWheel yet, refresh hasn't run)");
      assert.equal(flipped.flags?.exalted2e?.dvSticky, false,
        "dvSticky should be flipped to false");
    });

    // 7. After flip + advanceWheel → AE deleted
    it("deletes the (formerly sticky) AE on the next advanceWheel after flip", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const stickyAe = await stampDvAe(a, { sticky: true, refreshable: true });
      const combatant = combat.combatants.find(c => c.actorId === a.id);
      await setPendingAction(combatant, { actionKey: "Attack", dvEffectId: null });
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      assert.notOk(a.effects.get(stickyAe.id),
        "AE should be deleted: flip removed sticky, then refresh cleared it");
    });

    // 8. Sticky preserved when the committing action OWNS the AE (its dvEffectId)
    it("does not flip the sticky AE that belongs to the action being committed", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      const stickyAe = await stampDvAe(a, { sticky: true, refreshable: true });
      const combatant = combat.combatants.find(c => c.actorId === a.id);
      // Pending action OWNS this AE — flip should skip it.
      await setPendingAction(combatant, { actionKey: "Aim", dvEffectId: stickyAe.id });
      await commitAction(combat, a, 1);
      const stillSticky = a.effects.get(stickyAe.id);
      assert.ok(stillSticky, "AE still exists");
      assert.equal(stillSticky.flags?.exalted2e?.dvSticky, true,
        "dvSticky preserved (this AE belongs to the just-declared action)");
    });

    // 9. Two combatants on different ticks → only the landing combatant cleared
    it("only refreshes the combatant landing on the new tick", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const b = await createTempCharacter({ name: "Bob" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      await placeToken(b, sc, { x: 100, y: 0 });
      const combat = await startTempCombat([a, b], {
        jbStubsByActorId: { [a.id]: 5, [b.id]: 5 }  // both at tick 0
      });
      await advanceToActor(combat, a);
      const aeA = await stampDvAe(a);
      const aeB = await stampDvAe(b);
      await commitAction(combat, a, 1);
      // Now a.initiative === currentTick + 1; b is still at the prior tick.
      await advanceWheel(combat);
      // a lands on the new tick (initiative === newTick) → AE cleared.
      // b is still at the older tick → AE preserved.
      assert.notOk(a.effects.get(aeA.id), "a's AE cleared (a landed on new tick)");
      assert.ok(b.effects.get(aeB.id),    "b's AE survives (b didn't land)");
    });

    // 10. AE without dvSticky field at all → treated as sticky=false → cleared
    it("treats AE missing dvSticky field as sticky=false (cleared on first refresh)", async function () {
      const a = await createTempCharacter({ name: "Alice" });
      const sc = getTestScene();
      await placeToken(a, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([a]);
      await advanceToActor(combat, a);
      // Bypass stampDvAe to omit dvSticky entirely.
      const [ae] = await a.createEmbeddedDocuments("ActiveEffect", [{
        name: "Legacy AE",
        flags: { exalted2e: { dvRefreshable: true /* no dvSticky */ } },
        disabled: false,
        transfer: false
      }]);
      await commitAction(combat, a, 1);
      await advanceWheel(combat);
      assert.notOk(a.effects.get(ae.id), "AE without dvSticky field is treated as non-sticky and cleared");
    });
  });
}
