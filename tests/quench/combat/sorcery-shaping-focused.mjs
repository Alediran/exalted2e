import { assertTestWorld, getTestScene }     from "../_helpers/world.mjs";
import { sweep, register }                   from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import {
  startTempCombat, advanceToActor, commitAction
} from "../_helpers/combat.mjs";
import { stubSorceryCastDialog }             from "../_helpers/dialogs.mjs";
import { createTempSpell }                   from "../_helpers/items.mjs";

/** Set a pending action with a non-sorcery actionKey to drive the abort path. */
async function setNonSorceryPending(combatant) {
  await combatant.update({
    "flags.exalted2e.pendingAction": {
      actionKey: "Attack", label: "Attack", speed: 5,
      dvPenalty: 0, abortable: false, dvEffectId: null
    }
  });
}

export function registerSorceryShapingFocused(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("sorcery shaping (focused)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    /** Common setup: caster, bystander, combat, spell. Returns context. */
    async function setupCasterAndSpell({
      circle = 1,
      motes = 5,
      willpower = 1,
      casterPeripheral = 30,    // way more than motes cost
      casterPersonal   = 10,
      casterWp         = 5
    } = {}) {
      const caster = await createTempCharacter({
        name: "Caster",
        per: 3,    // any sane stats
      });
      const bystander = await createTempCharacter({ name: "Bystander" });
      // Configure mote/WP pools to specific values. Essence is bumped to
      // 5 so prepareDerivedData's computed `motes.*.max` (a function of
      // essence/wp/virtues for the actor's exalt type) doesn't fall
      // below the test's persisted pool values — otherwise recoverMotes
      // would clamp refunds to the small derived max instead of restoring
      // to the value the test set.
      await caster.update({
        "system.essence.value":          5,
        "system.motes.peripheral.value": casterPeripheral,
        "system.motes.peripheral.max":   casterPeripheral,
        "system.motes.personal.value":   casterPersonal,
        "system.motes.personal.max":     casterPersonal,
        "system.willpower.value":        casterWp,
        "system.willpower.max":          casterWp,
        // Ensure the caster has the initiation to cast (sorcery initiation ≥ circle).
        "system.sorcery.initiation":     circle
      });
      const sc = getTestScene();
      await placeToken(caster, sc, { x: 0, y: 0 });
      await placeToken(bystander, sc, { x: 100, y: 0 });
      const combat = await startTempCombat([caster, bystander], {
        jbStubsByActorId: { [caster.id]: 5, [bystander.id]: 0 }  // caster goes first
      });
      await advanceToActor(combat, caster);
      const combatant = combat.combatants.find(c => c.actorId === caster.id);
      const spell = await createTempSpell(caster, { circle, motes, willpower });
      return { caster, bystander, combat, combatant, spell };
    }

    // 1. First-shape happy path: motes spent, AE stamped, multiTickAction set.
    it("first-shape: spends motes, stamps sticky DV AE, sets multiTickAction", async function () {
      const { caster, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5, willpower: 1, casterPeripheral: 10, casterPersonal: 0
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      // Motes spent from peripheral.
      assert.equal(caster.system.motes.peripheral.value, 5,
        "5 motes spent from peripheral (10 - 5 = 5)");
      // multiTickAction set with sorcery key + first-shape state.
      const action = combatant.flags?.exalted2e?.multiTickAction;
      assert.ok(action, "multiTickAction set");
      assert.equal(action.actionKey, "sorcery");
      assert.equal(action.state.spellId, spell.id);
      assert.equal(action.state.totalShapeActions, 1, "circle-1 spell → 1 shape action");
      assert.equal(action.state.completedShapeActions, 0);
      // Sticky DV AE stamped.
      const dvAe = caster.effects.find(e =>
        e.flags?.exalted2e?.dvPenalty?.type === "sorcery-shape"
      );
      assert.ok(dvAe, "sorcery-shape DV AE stamped");
      assert.equal(dvAe.flags.exalted2e.dvSticky, true);
      assert.equal(dvAe.flags.exalted2e.dvRefreshable, true);
      assert.equal(dvAe.flags.exalted2e.dvPenalty.value, 2,
        "circle-1 shape penalty = 2");
    });

    // 2. First-shape with cancel: no state changes
    it("first-shape: cancel → no spend, no AE, no multiTickAction", async function () {
      const { caster, combatant, spell } = await setupCasterAndSpell();
      await stubSorceryCastDialog([{ ok: false }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      assert.equal(caster.system.motes.peripheral.value, 30, "no motes spent");
      assert.notOk(combatant.flags?.exalted2e?.multiTickAction, "no multiTickAction");
      assert.notOk(
        caster.effects.find(e => e.flags?.exalted2e?.dvPenalty?.type === "sorcery-shape"),
        "no sorcery-shape AE"
      );
    });

    // 3. Circle-2 spell: totalShapeActions = 2
    it("first-shape with circle-2 spell: totalShapeActions = 2", async function () {
      const { combatant, spell } = await setupCasterAndSpell({ circle: 2, motes: 5 });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      const action = combatant.flags.exalted2e.multiTickAction;
      assert.equal(action.state.totalShapeActions, 2);
      assert.equal(action.state.completedShapeActions, 0);
    });

    // 4. Continue-shape: completedShapeActions bumps after a sorceryShape commit
    it("continue-shape: completedShapeActions bumps from 0→1 on sorceryShape commit", async function () {
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 2, motes: 5
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      // After first castSpellFlow call: pendingAction = sorceryShape (first shape).
      // Commit it → planSorceryCommit returns "continue", bumps completedShapeActions.
      await commitAction(combat, caster, 5);

      const action = combatant.flags.exalted2e.multiTickAction;
      assert.equal(action.state.completedShapeActions, 1, "bumped to 1");
      assert.ok(action, "multiTickAction persists (still mid-shape, 1/2)");
    });

    // 5. Continue-shape via castSpellFlow writes pendingAction without prompting
    it("castSpellFlow during mid-shape writes continue-shape pendingAction without dialog", async function () {
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 2, motes: 5
      });
      // First shape via dialog.
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);
      await commitAction(combat, caster, 5);  // completedShapeActions → 1

      // Now mid-shape (1/2). Calling castSpellFlow again should write the
      // continue-shape pendingAction without invoking the dialog. Stub
      // queue is empty; if the production code calls prompt, it'd throw.
      await castSpellFlow(spell);
      const pending = combatant.flags?.exalted2e?.pendingAction;
      assert.ok(pending, "pendingAction set");
      assert.equal(pending.actionKey, "sorceryShape");
      assert.equal(pending.spellId, spell.id);
    });

    // 6. Cast triggered: castSpellFlow at completedShapeActions=totalShapeActions writes sorceryCast
    it("castSpellFlow at completedShapeActions=totalShapeActions writes sorceryCast pendingAction", async function () {
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);
      await commitAction(combat, caster, 5);  // completedShapeActions → 1

      // Now at 1/1 (ready to cast). Next castSpellFlow writes sorceryCast.
      await castSpellFlow(spell);
      const pending = combatant.flags.exalted2e.pendingAction;
      assert.equal(pending.actionKey, "sorceryCast", "transitions to cast stage");
    });

    // 7. Cast committed: postCastChatCard fires; multiTickAction cleared
    it("committing sorceryCast posts the spell-cast chat card and clears multiTickAction", async function () {
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);  // first shape
      await commitAction(combat, caster, 5);
      await castSpellFlow(spell);  // sorceryCast pending
      const messageCountBefore = game.messages.size;

      // After the first commit, caster has actedThisTick=true; bystander
      // (free + unacted) becomes combat.combatant. Walk the wheel forward
      // until caster is current again so the second commit can run.
      // sorceryHandler.onTick is a no-op (commit-driven), so the
      // multiTickAction state is preserved across the intermediate ticks.
      await advanceToActor(combat, caster);
      await commitAction(combat, caster, 5);  // commit sorceryCast → cast

      assert.equal(game.messages.size, messageCountBefore + 1,
        "exactly one new chat message (the spell-cast card)");
      assert.notOk(combatant.flags?.exalted2e?.multiTickAction,
        "multiTickAction cleared after cast");
      // The created message should reference the spell name.
      const lastMsg = Array.from(game.messages.values()).at(-1);
      register(lastMsg);  // ensure cleanup
      assert.ok(lastMsg.content.includes(spell.name),
        "chat card mentions the spell name");
    });

    // 8. Mote spend overflow: peripheral exhausted, overflow into personal
    it("mote spend: peripheral first, overflow into personal", async function () {
      // peripheral=2, cost=5 → fromPrimary=2, fromSecondary=3
      const { caster, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5,
        casterPeripheral: 2, casterPersonal: 10
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      assert.equal(caster.system.motes.peripheral.value, 0, "peripheral drained");
      assert.equal(caster.system.motes.personal.value,   7, "personal: 10-3=7");
      const action = combatant.flags.exalted2e.multiTickAction;
      assert.equal(action.state.motesFromPrimary, 2);
      assert.equal(action.state.motesFromSecondary, 3);
      assert.equal(action.state.primaryPool,   "peripheral");
      assert.equal(action.state.secondaryPool, "personal");
    });

    // 9. Willpower spend
    it("first-shape: willpower spent by the spell's WP cost", async function () {
      const { caster, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5, willpower: 2, casterWp: 5
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      assert.equal(caster.system.willpower.value, 3, "5 - 2 = 3 willpower remaining");
    });

    // 10. Shape AE structure
    it("shape AE has the correct dvPenalty + flag shape", async function () {
      const { caster, spell } = await setupCasterAndSpell({ circle: 2 });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);

      const dvAe = caster.effects.find(e =>
        e.flags?.exalted2e?.dvPenalty?.type === "sorcery-shape"
      );
      assert.ok(dvAe);
      // Circle-2 → shape penalty = 3 (per SHAPE_DV_BY_CIRCLE in sorcery-math.mjs).
      assert.equal(dvAe.flags.exalted2e.dvPenalty.value, 3);
      assert.equal(dvAe.flags.exalted2e.dvSticky,      true);
      assert.equal(dvAe.flags.exalted2e.dvRefreshable, true);
    });

    // 11. Abort via different action: pool-accurate refund + AE cleared
    it("abort: refunds motes/WP pool-accurately and clears the shape AE", async function () {
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5, willpower: 2,
        casterPeripheral: 30, casterPersonal: 10, casterWp: 5
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);
      // After cast flow: peripheral=25, wp=3, sticky AE present.

      // Now commit a non-sorcery action — onCommitOther fires, planSorceryCommit
      // returns "interrupt", refundCommittedCosts runs.
      await setNonSorceryPending(combatant);
      await commitAction(combat, caster, 5);

      assert.equal(caster.system.motes.peripheral.value, 30, "motes fully refunded");
      assert.equal(caster.system.willpower.value, 5,         "wp fully refunded");
      assert.notOk(
        caster.effects.find(e => e.flags?.exalted2e?.dvPenalty?.type === "sorcery-shape"),
        "shape AE deleted"
      );
      assert.notOk(combatant.flags?.exalted2e?.multiTickAction,
        "multiTickAction cleared");
    });

    // 12. Multi-pool refund accuracy: overflow spend refunds both pools correctly
    it("abort: multi-pool refund (peripheral overflow → personal) restores both pools", async function () {
      // peripheral=2, cost=5 → fromPrimary=2, fromSecondary=3
      const { caster, combat, combatant, spell } = await setupCasterAndSpell({
        circle: 1, motes: 5, willpower: 0,
        casterPeripheral: 2, casterPersonal: 10, casterWp: 1
      });
      await stubSorceryCastDialog([{ ok: true }]);
      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      await castSpellFlow(spell);
      // After cast flow: peripheral=0, personal=7.

      await setNonSorceryPending(combatant);
      await commitAction(combat, caster, 5);

      // Refund: 2 motes back to peripheral, 3 motes back to personal.
      assert.equal(caster.system.motes.peripheral.value, 2,
        "peripheral fully restored to original 2");
      assert.equal(caster.system.motes.personal.value, 10,
        "personal fully restored to original 10");
    });
  });
}
