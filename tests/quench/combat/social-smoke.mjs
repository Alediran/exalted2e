import { assertTestWorld, getTestScene }  from "../_helpers/world.mjs";
import { sweep, register, cleanupOnAfter } from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { placeToken }                     from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor } from "../_helpers/combat.mjs";
import { addMotivation }                  from "../_helpers/intimacies.mjs";

async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

function findOpenSocialDialog() {
  return document.querySelector(".social-attack-dialog");
}

function clickSocialConfirm(dialogRoot) {
  const btn = dialogRoot.querySelector('button[data-action="confirmSocialAttack"]');
  if (!btn) throw new Error("confirmSocialAttack button not found");
  btn.click();
}

function registerSocialDialogCleanup() {
  cleanupOnAfter(async () => {
    const app = foundry.applications.instances?.get?.("ex2e-social-attack-dialog");
    if (app) { try { await app.close(); } catch (_) { /* ignore */ } }
    const root = findOpenSocialDialog();
    if (root) root.remove();
  });
}

export function registerSocialSmoke(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("social attack + scene cleanup (smoke E2E)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // S1: Real SocialAttackDialog → confirm → rollSocialAttack posts a card.
    it("[88] real SocialAttackDialog: open → confirm → rollSocialAttack posts a card", async function () {
      const attacker = await createTempCharacter({ name: "SmoothSmoke", cha: 4, app: 2 });
      const defender = await createTempCharacter({ name: "MarkSmoke",  wit: 2 });
      await attacker.update({
        "system.essence.value": 5,
        "system.abilities.presence.value": 3
      });
      await defender.update({ "system.essence.value": 5 });

      registerSocialDialogCleanup();
      const { SocialAttackDialog } = await import(
        "../../../module/dialogs/social-attack-dialog.mjs"
      );
      // Run the dialog without awaiting; click confirm asynchronously.
      // NOTE: dialog constructor reads `options.target` (not `defender`).
      // The resolved result remaps target → defender for rollSocialAttack.
      const promptPromise = SocialAttackDialog.prompt({
        attacker, target: defender,
        attribute: "charisma", ability: "presence", intent: "build"
      });
      await waitFor(() => !!findOpenSocialDialog());
      clickSocialConfirm(findOpenSocialDialog());
      const result = await promptPromise;
      assert.ok(result, "dialog returned a result on confirm");

      // Pass result to rollSocialAttack — same flow the sheet handlers use.
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, ...result
      });
      assert.ok(message, "social card posted");
      register(message);
      const ledger = message.flags?.exalted2e?.socialAttack;
      assert.ok(ledger, "socialAttack flag present");
      assert.equal(ledger.attackerId, attacker.id);
      assert.equal(ledger.defenderId, defender.id);
    });

    // S2: Motivation-break flow: intent='break-motivation' creates a campaign
    //     tracker on the defender and the ledger flags isMotivationBreak.
    it("[89] motivation break: campaign tracker created on defender; isMotivationBreak=true", async function () {
      const attacker = await createTempCharacter({ name: "BreakerSmoke", cha: 4 });
      const defender = await createTempCharacter({ name: "TargetSmoke", wit: 2 });
      await attacker.update({
        "system.essence.value": 5,
        "system.abilities.presence.value": 4
      });
      await defender.update({
        "system.essence.value": 5,
        "system.willpower.value": 5,
        "system.willpower.max":   5
      });
      await addMotivation(defender, "Reclaim my throne");

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender,
        attribute: "charisma", ability: "presence",
        intent: "break-motivation",
        targetMotivation: "Submit to the conqueror",
        claims: {}
      });
      register(message);
      const ledger = message.flags.exalted2e.socialAttack;
      assert.equal(ledger.isMotivationBreak, true,
        "ledger.isMotivationBreak=true");
      assert.equal(ledger.targetMotivation, "Submit to the conqueror",
        "targetMotivation persisted on the ledger");
      // Campaign tracker on the defender — keyed by attacker.id.
      const campaign = defender.flags?.exalted2e?.motivationBreaks?.[attacker.id];
      assert.ok(campaign, "campaign tracker created on defender");
      assert.equal(campaign.status,        "active");
      assert.equal(campaign.attemptCount,  1);
      assert.equal(campaign.targetMotivation, "Submit to the conqueror");
    });

    // S3: clearSocialScene fires from endCombat() and wipes per-actor flags.
    it("[90] endCombat: clearSocialScene fires and wipes socialScene flags from actors", async function () {
      const attacker = await createTempCharacter({ name: "EndSmoothSmoke", cha: 4 });
      const defender = await createTempCharacter({ name: "EndMarkSmoke",  wit: 2 });
      const sc = getTestScene();
      await placeToken(attacker, sc, { x: 0,   y: 0 });
      await placeToken(defender, sc, { x: 100, y: 0 });
      const combat = await startTempCombat([attacker, defender], {
        jbStubsByActorId: { [attacker.id]: 5, [defender.id]: 0 }
      });
      await advanceToActor(combat, attacker);

      // Stamp the per-scene flag manually so we can verify endCombat clears it.
      await defender.update({
        [`flags.exalted2e.socialScene.${attacker.id}.wpDrainedNatural`]: 2
      });
      assert.ok(defender.flags?.exalted2e?.socialScene?.[attacker.id],
        "pre-condition: defender has socialScene flag");

      // ExaltedCombat.endCombat() runs clearSocialScene BEFORE calling
      // super.endCombat() — and Foundry's super.endCombat() pops a
      // confirmation dialog that hangs the await indefinitely in tests.
      // We don't care about the confirmation here; just kick off endCombat
      // and poll for the cleanup to manifest, then ignore the dangling
      // promise (cleanup-on-after closes any orphan dialog).
      cleanupOnAfter(async () => {
        // Close any "End Combat?" confirmation that didn't get answered.
        const orphan = document.querySelector("dialog.dialog,.dialog-v2");
        if (orphan) orphan.remove();
      });
      combat.endCombat();   // intentionally not awaited
      await waitFor(() => !defender.flags?.exalted2e?.socialScene);

      assert.notOk(defender.flags?.exalted2e?.socialScene,
        "socialScene flag wiped by endCombat → clearSocialScene");
    });
  });
}
