import { assertTestWorld, getTestScene }  from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter, register } from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { placeToken }                     from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor } from "../_helpers/combat.mjs";
import { createTempWeapon }               from "../_helpers/weapons.mjs";
import { createTempCharm }                from "../_helpers/charms.mjs";

/**
 * Poll until predicate truthy or timeoutMs elapses. Mirrors the
 * sorcery-shaping-smoke pattern.
 */
async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/** Find the open AttackDialog DOM (DEFAULT_OPTIONS.classes carries `attack-dialog`). */
function findOpenAttackDialog() {
  return document.querySelector(".attack-dialog");
}

/**
 * Click the dialog's Confirm Attack button (data-action="confirmAttack"
 * per the dialog template).
 */
function clickAttackConfirm(dialogRoot) {
  const btn = dialogRoot.querySelector('button[data-action="confirmAttack"]');
  if (!btn) throw new Error("confirmAttack button not found in AttackDialog");
  btn.click();
}

/** Cleanup orphan AttackDialog if a test fails mid-flow. */
function registerDialogCleanup(idLookup = "ex2e-attack-dialog") {
  cleanupOnAfter(async () => {
    const app = foundry.applications.instances?.get?.(idLookup);
    if (app) { try { await app.close(); } catch (_) { /* ignore */ } }
    const root = findOpenAttackDialog();
    if (root) root.remove();
  });
}

/**
 * Find the rendered chat-card button by message id + selector.
 */
function findCardButton(messageId, selector) {
  const root = document.querySelector(`[data-message-id="${messageId}"]`);
  return root?.querySelector?.(selector) ?? null;
}

export function registerAttackCharmSmoke(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("attack + charm smoke (E2E)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // S1: Real AttackDialog flow — open, click confirm, verify chat card.
    it("[69] real AttackDialog: open → confirm → chat card posted with snapshot", async function () {
      const attacker = await createTempCharacter({ name: "AtkSmoke", str: 4, dex: 4 });
      const defender = await createTempCharacter({ name: "DefSmoke", dex: 3 });
      await attacker.update({ "system.essence.value": 5 });
      await defender.update({ "system.essence.value": 5 });
      await attacker.update({ "system.abilities.melee.value": 3 });
      const sc = getTestScene();
      await placeToken(attacker, sc, { x: 0,   y: 0 });
      await placeToken(defender, sc, { x: 100, y: 0 });
      const weapon = await createTempWeapon(attacker, {
        accuracy: 2, damage: 5
      });
      const combat = await startTempCombat([attacker, defender], {
        jbStubsByActorId: { [attacker.id]: 5, [defender.id]: 0 }
      });
      await advanceToActor(combat, attacker);

      registerDialogCleanup();
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      // Run rollAttack without awaiting — dialog opens; then we click
      // confirm asynchronously and await the resolved promise.
      const attackPromise = ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      await waitFor(() => !!findOpenAttackDialog());
      clickAttackConfirm(findOpenAttackDialog());
      const message = await attackPromise;

      assert.ok(message, "rollAttack returned a ChatMessage");
      register(message);
      const attack = message.flags?.exalted2e?.attack;
      assert.ok(attack,                          "attack flag present");
      assert.equal(attack.actorId,  attacker.id, "actorId matches");
      assert.equal(attack.targetId, defender.id, "targetId matches");
    });

    // S2: Real charm activation + real Reverse from chat card.
    it("[70] real charm activation: skipXpConfirm path → chat card → click Reverse → motes restored", async function () {
      const actor = await createTempCharacter({ name: "CharmSmoker" });
      await actor.update({
        "system.essence.value": 5,
        "system.motes.peripheral.value": 30, "system.motes.peripheral.max": 30,
        "system.willpower.value": 5,         "system.willpower.max":         5
      });
      const charm = await createTempCharm(actor, {
        cost: { formula: "5m" }, duration: "instant"
      });

      // Real activation (no XP cost so no confirm dialog needed).
      const ok = await charm.activateCharm({ skipXpConfirm: true });
      assert.equal(ok, true, "activation succeeded");
      assert.equal(actor.system.motes.peripheral.value, 25, "5 motes spent");

      // Find the rendered card and click its Reverse button.
      const card = Array.from(game.messages.values())
        .find(m => m.flags?.exalted2e?.charmActivation?.charmId === charm.id);
      assert.ok(card, "activation card present");
      register(card);

      await waitFor(() => !!findCardButton(card.id, ".btn-reverse-charm"));
      const btn = findCardButton(card.id, ".btn-reverse-charm");
      btn.click();

      await waitFor(() =>
        game.messages.get(card.id)?.flags?.exalted2e?.charmActivation?.reversed === true
      );
      assert.equal(actor.system.motes.peripheral.value, 30,
        "motes refunded by real Reverse click");
    });
  });
}
