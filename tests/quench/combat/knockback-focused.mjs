import { resolveKnockbackChain, onKnockdownResistClick } from "../../../module/combat/knockback.mjs";
import { ExaltedRoll }                       from "../../../module/rolls/exalted-roll.mjs";
import { assertTestWorld, getTestScene }     from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter, register }   from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import { buildAttackMessage }                from "../_helpers/messages.mjs";

/** Stub ExaltedRoll.rollPool to return a fixed success count. */
function stubRollPool(successes) {
  const original = ExaltedRoll.rollPool;
  ExaltedRoll.rollPool = async () => ({ successes });
  cleanupOnAfter(() => { ExaltedRoll.rollPool = original; });
}

export function registerKnockbackFocused(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("knockback chain (focused)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // Test 1: Early-return guard — non-character target.
    it("[1] no-ops when target actor is not a character", async function () {
      const attacker = await createTempCharacter({ name: "Attacker" });
      const npc = await Actor.create({ name: "NPC", type: "npc", system: {} });
      register(npc); // manual register — actors.mjs only creates characters

      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      const npcToken = await placeToken(npc, scene, { x: 200, y: 0 });
      const startX = npcToken.x;

      const msg = await buildAttackMessage({ attacker, target: npc });
      await resolveKnockbackChain(msg, { effectivePool: 100, rawDamage: 100 });

      assert.equal(npcToken.x, startX, "NPC token should not move");
      assert.notOk(msg.flags?.exalted2e?.attack?.knockback, "no resolution flag for NPC target");
    });

    // Test 2: Knockback compute — doesn't fire (pool ≤ Sta+Res).
    it("[2] does not move the token when effective pool ≤ Sta+Res", async function () {
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 3, res: 3 }); // threshold = 6
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      const defToken = await placeToken(defender, scene, { x: 200, y: 0 });
      const startX = defToken.x;

      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 6, rawDamage: 0 });

      assert.equal(defToken.x, startX, "token should not move when pool ≤ threshold");
      assert.notOk(msg.flags?.exalted2e?.attack?.knockback, "no resolution flag when knockback doesn't fire");
    });

    // Test 3: Knockback compute — fires. Token translates floor(dice/3) yards along vector.
    it("[3] translates the target token along the attack vector when threshold exceeded", async function () {
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 1, dex: 5, ath: 5 }); // threshold = 2
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      const defToken = await placeToken(defender, scene, { x: 100, y: 0 });
      const startX = defToken.x;

      // pool = 9 → fires (9 > 2); distance = floor(9/3) = 3 yards = 300 pixels (grid 100/1)
      // Knockdown won't trigger: 3 ≤ Dex+Ath = 10
      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 9, rawDamage: 0 });

      // Foundry v13 animates token movement; `await tokenDoc.update({x,y})`
      // resolves before the document's x/y reflect the new value. Poll for
      // the document state to settle before asserting.
      const expectedDelta = 100 * 3; // pixelsPerUnit × yards
      const expectedX = startX + expectedDelta;
      const deadline = Date.now() + 1500;
      while (Math.abs(defToken.x - expectedX) > 1 && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 50));
      }

      const actualDelta = defToken.x - startX;
      assert.closeTo(actualDelta, expectedDelta, 1, "token should translate ~300px along +X (attacker→target)");

      const resolution = msg.flags?.exalted2e?.attack?.knockback;
      assert.ok(resolution, "resolution flag should be set");
      assert.ok(resolution.fired, "kb.fired should be true");
      assert.equal(resolution.distance, 3, "distance should be 3 yards");
      assert.ok(resolution.tokenMoved, "tokenMoved should be true");
    });

    // Test 4: Knockdown trigger — doesn't trigger (distance ≤ Dex+Ath).
    it("[4] does not trigger knockdown when distance ≤ Dex+Ath", async function () {
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 0, dex: 5, ath: 5 }); // threshold=1, mobility=10
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      // pool=6 → distance=floor(6/3)=2; 2 ≤ 10 mobility → no knockdown
      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 6, rawDamage: 0 });

      const resolution = msg.flags?.exalted2e?.attack?.knockback;
      assert.ok(resolution.fired, "knockback fired");
      assert.notOk(resolution.knockdownPending, "no pending knockdown");
      assert.notOk(resolution.knockdownResolution, "no resolution");
      assert.notOk(defender.statuses?.has?.("prone"), "Prone not applied");
    });

    // Test 5: Knockdown trigger — NPC defender, auto-roll fails → Prone applied.
    it("[5] applies Prone when knockdown triggers and NPC auto-roll fails", async function () {
      stubRollPool(0); // 0 successes → fail (need ≥ 2)
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 0, dex: 1, ath: 0 }); // mobility=1
      // playerOwner defaults false → goes through NPC branch
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      // pool=12 → distance=4; 4 > mobility 1 → knockdown triggers
      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 12, rawDamage: 0 });

      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownResolution, "auto-knocked-down");
      assert.ok(defender.statuses.has("prone"), "Prone should be applied");
    });

    // Test 6: Knockdown trigger — NPC defender, auto-roll passes → no Prone.
    it("[6] does not apply Prone when knockdown triggers and NPC auto-roll passes", async function () {
      stubRollPool(3); // 3 successes → pass
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 0, dex: 1, ath: 0 });
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 12, rawDamage: 0 });

      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownResolution, "passed");
      assert.notOk(defender.statuses.has("prone"), "Prone should not be applied");
    });

    // Test 7: Knockdown trigger — player-owned defender → pending flag, no auto-roll.
    it("[7] sets knockdownPending without rolling when defender is player-owned", async function () {
      const original = ExaltedRoll.rollPool;
      let callCount = 0;
      ExaltedRoll.rollPool = async () => { callCount++; return { successes: 0 }; };
      cleanupOnAfter(() => { ExaltedRoll.rollPool = original; });

      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({
        sta: 1, res: 0, dex: 1, ath: 0,
        playerOwner: true
      });
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 12, rawDamage: 0 });

      assert.equal(callCount, 0, "no auto-roll for player-owned defender");
      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownPending, true);
      assert.notOk(msg.flags.exalted2e.attack.knockback.knockdownResolution);
      assert.notOk(defender.statuses.has("prone"));
    });

    // Test 8: Stun triggers independently (no knockback).
    it("[8] stamps a dvRefreshable externalPenalty AE when stun triggers without knockback", async function () {
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 2, res: 4 }); // kb threshold = 6
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      // pool=4 ≤ 6 → no knockback. rawDamage=3 > sta=2 → stun fires.
      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 4, rawDamage: 3 });

      const stunAE = defender.effects.find(e => e.flags?.exalted2e?.dvRefreshable
        && e.flags?.exalted2e?.externalPenalty?.value === 2);
      assert.ok(stunAE, "stun AE should be present");
      assert.equal(stunAE.flags.exalted2e.externalPenalty.type, "physical");
      assert.equal(msg.flags.exalted2e.attack.knockback.stunFired, true);
      assert.equal(msg.flags.exalted2e.attack.knockback.fired, false, "knockback did not fire");
    });

    // Test 9: onKnockdownResistClick — fail path → Prone applied, resolution updated.
    it("[9] applies Prone via onKnockdownResistClick when the resist roll fails", async function () {
      stubRollPool(0);
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 0, dex: 1, ath: 0, playerOwner: true });
      // We need GM permission to bypass the owner gate. Test world is GM session by default.
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      // First trigger the chain to set knockdownPending=true.
      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 12, rawDamage: 0 });
      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownPending, true);

      // Now invoke the click handler.
      await onKnockdownResistClick(msg);

      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownPending, false);
      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownResolution, "knocked-down");
      assert.ok(defender.statuses.has("prone"));
    });

    // Test 10: onKnockdownResistClick — non-owner non-GM → warn toast + bail.
    it("[10] warns and bails when onKnockdownResistClick is invoked without owner permission", async function () {
      const attacker = await createTempCharacter();
      const defender = await createTempCharacter({ sta: 1, res: 0, dex: 1, ath: 0, playerOwner: true });
      const scene = getTestScene();
      await placeToken(attacker, scene, { x: 0, y: 0 });
      await placeToken(defender, scene, { x: 100, y: 0 });

      const msg = await buildAttackMessage({ attacker, target: defender });
      await resolveKnockbackChain(msg, { effectivePool: 12, rawDamage: 0 });

      // Stub the GM flag and ownership test so the permission gate trips.
      const origIsGM = game.user.isGM;
      Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
      cleanupOnAfter(() => { Object.defineProperty(game.user, "isGM", { value: origIsGM, configurable: true }); });

      const origTest = defender.testUserPermission;
      defender.testUserPermission = () => false;
      cleanupOnAfter(() => { defender.testUserPermission = origTest; });

      const origWarn = ui.notifications.warn;
      let warnCalled = false;
      ui.notifications.warn = (msg) => { warnCalled = true; };
      cleanupOnAfter(() => { ui.notifications.warn = origWarn; });

      let rollCalled = false;
      const origRollPool = ExaltedRoll.rollPool;
      ExaltedRoll.rollPool = async () => { rollCalled = true; return { successes: 0 }; };
      cleanupOnAfter(() => { ExaltedRoll.rollPool = origRollPool; });

      await onKnockdownResistClick(msg);

      assert.ok(warnCalled, "permission warning should fire");
      assert.notOk(rollCalled, "no roll should be attempted");
      assert.equal(msg.flags.exalted2e.attack.knockback.knockdownPending, true, "still pending — handler bailed");
    });
  });
}
