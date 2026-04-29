import { assertTestWorld, getTestScene }     from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter }             from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import {
  startTempCombat, advanceToActor, commitAction
} from "../_helpers/combat.mjs";
import { createTempSpell }                   from "../_helpers/items.mjs";

/**
 * Poll until predicate returns truthy or timeoutMs elapses.
 * Lifted from knockback-smoke.mjs pattern.
 */
async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/**
 * Find the open SorceryCastDialog window and return its root element.
 * The dialog's DEFAULT_OPTIONS adds the CSS class `"sorcery-cast-dialog"`
 * (see module/dialogs/sorcery-cast-dialog.mjs).
 */
function findOpenSorceryDialog() {
  return document.querySelector(".sorcery-cast-dialog");
}

/**
 * Click the Confirm button inside the dialog. The actual markup
 * (templates/dialog/sorcery-cast-dialog.hbs) uses
 *   <button class="btn-confirm" data-action="confirm">
 */
function clickDialogConfirm(dialogRoot) {
  const btn = dialogRoot.querySelector(
    "button[data-action='confirm'], button.btn-confirm"
  );
  if (!btn) throw new Error("Confirm button not found in SorceryCastDialog");
  btn.click();
}

/**
 * Register a cleanup-on-after callback that closes any orphaned
 * SorceryCastDialog. Useful when a test fails mid-flow and leaves a
 * dialog open. The dialog's id is fixed by DEFAULT_OPTIONS to
 * "ex2e-sorcery-cast-dialog".
 */
function registerDialogCleanup() {
  cleanupOnAfter(async () => {
    const app = foundry.applications.instances?.get?.("ex2e-sorcery-cast-dialog");
    if (app) {
      try { await app.close(); } catch (_) { /* ignore */ }
    }
    // Hard fallback: remove orphaned DOM if the close path didn't.
    const root = findOpenSorceryDialog();
    if (root) root.remove();
  });
}

/** Set a non-sorcery pendingAction on the combatant (for abort path). */
async function setNonSorceryPending(combatant) {
  await combatant.update({
    "flags.exalted2e.pendingAction": {
      actionKey: "Attack", label: "Attack", speed: 5,
      dvPenalty: 0, abortable: false, dvEffectId: null
    }
  });
}

export function registerSorceryShapingSmoke(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("sorcery shaping (smoke E2E)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    async function setup({ circle = 1 } = {}) {
      const caster = await createTempCharacter({ name: "SmokeCaster" });
      const bystander = await createTempCharacter({ name: "SmokeBystander" });
      // Essence=5 keeps prepareDerivedData's computed motes.*.max above
      // the test's persisted values (default ess=1 → peripheral.max=16
      // would clamp refunds; see project memory note).
      await caster.update({
        "system.essence.value":           5,
        "system.motes.peripheral.value": 30, "system.motes.peripheral.max": 30,
        "system.motes.personal.value":   10, "system.motes.personal.max":   10,
        "system.willpower.value":         5, "system.willpower.max":         5,
        "system.sorcery.initiation":      circle
      });
      const sc = getTestScene();
      await placeToken(caster, sc, { x: 0, y: 0 });
      await placeToken(bystander, sc, { x: 100, y: 0 });
      const combat = await startTempCombat([caster, bystander], {
        jbStubsByActorId: { [caster.id]: 5, [bystander.id]: 0 }
      });
      await advanceToActor(combat, caster);
      const combatant = combat.combatants.find(c => c.actorId === caster.id);
      const spell = await createTempSpell(caster, { circle, motes: 5, willpower: 1 });
      return { caster, combat, combatant, spell };
    }

    // S1: Real dialog → confirm → first-shape state set
    it("real dialog: confirm sets first-shape state", async function () {
      const { caster, combatant, spell } = await setup({ circle: 1 });

      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      // castSpellFlow opens the dialog and awaits its result. Run it
      // without awaiting; click confirm asynchronously after the dialog
      // appears.
      registerDialogCleanup();
      const flowPromise = castSpellFlow(spell);
      await waitFor(() => !!findOpenSorceryDialog());
      clickDialogConfirm(findOpenSorceryDialog());
      await flowPromise;

      // First-shape state should be set.
      const action = combatant.flags?.exalted2e?.multiTickAction;
      assert.ok(action, "multiTickAction set");
      assert.equal(action.actionKey, "sorcery");
      assert.equal(action.state.spellId, spell.id);
      assert.equal(caster.system.motes.peripheral.value, 25,
        "5 motes spent (peripheral 30 - 5 = 25)");
    });

    // S2: Real abort: confirm shape → commit non-sorcery → state cleared
    it("real abort flow: confirm shape, commit non-sorcery action → state cleared", async function () {
      const { caster, combat, combatant, spell } = await setup({ circle: 1 });

      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      registerDialogCleanup();
      const flowPromise = castSpellFlow(spell);
      await waitFor(() => !!findOpenSorceryDialog());
      clickDialogConfirm(findOpenSorceryDialog());
      await flowPromise;
      // First-shape state set; peripheral=25, sticky AE present.

      // Now drive the abort path via commit + non-sorcery pending.
      await setNonSorceryPending(combatant);
      await commitAction(combat, caster, 5);

      assert.equal(caster.system.motes.peripheral.value, 30,
        "motes fully refunded after abort");
      assert.notOk(combatant.flags?.exalted2e?.multiTickAction,
        "multiTickAction cleared on abort");
      assert.notOk(
        caster.effects.find(e => e.flags?.exalted2e?.dvPenalty?.type === "sorcery-shape"),
        "shape AE deleted"
      );
    });
  });
}
