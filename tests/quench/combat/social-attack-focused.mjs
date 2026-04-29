import { assertTestWorld }                from "../_helpers/world.mjs";
import { sweep }                          from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { addIntimacy, addMotivation }     from "../_helpers/intimacies.mjs";

/**
 * Build attacker + defender pair for social-attack tests. Both essence=5
 * for pool/MDV headroom (memory: project_motes_max_overridden_by_derived).
 *
 * Default attacker: Cha 4, Pre 3, App 2.
 * Default defender: Wit 2, no motivation, no intimacies, default virtues 1.
 *   → Dodge MDV = floor((wp 5 + wit 2) / 2) = 3 (with default character).
 */
async function setupSocialFixture({ attackerOpts = {}, defenderOpts = {} } = {}) {
  const attacker = await createTempCharacter({
    name: "Smooth", cha: 4, app: 2,
    ...attackerOpts
  });
  const defender = await createTempCharacter({
    name: "Mark", wit: 2,
    ...defenderOpts
  });
  await attacker.update({
    "system.essence.value": 5,
    "system.abilities.presence.value":     3,
    "system.abilities.performance.value":  3,
    "system.abilities.investigation.value":3,
    "system.abilities.bureaucracy.value":  3
  });
  await defender.update({
    "system.essence.value":  5,
    "system.willpower.value": 5,
    "system.willpower.max":   5
  });
  return { attacker, defender };
}

export function registerSocialAttackFocused(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("social attack pipeline (focused)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Happy path — rollSocialAttack posts a chat card with the snapshot.
    it("happy path: posts a social card with the expected snapshot", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", subject: "Friendship",
        claims: {}
      });
      assert.ok(message, "rollSocialAttack returned a ChatMessage");
      const ledger = message.flags?.exalted2e?.socialAttack;
      assert.ok(ledger, "socialAttack flag present (NOT 'attack' — that's physical)");
      assert.equal(ledger.attackerId, attacker.id);
      assert.equal(ledger.defenderId, defender.id);
      assert.equal(ledger.intent,     "build");
      assert.equal(ledger.step2Resolved, false,
        "step2Resolved=false; defender hasn't picked yet");
    });

    // 2. Pool composition: attribute + ability (no excellency, no stunt).
    it("pool composition: Charisma + Presence (clean baseline)", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: {}
      });
      const ledger = message.flags.exalted2e.socialAttack;
      // 4 cha + 3 presence = 7. No wound, internal, external by default.
      assert.equal(ledger.pool, 7, "pool = 4 (cha) + 3 (presence)");
      assert.equal(ledger.attributeValue, 4);
      assert.equal(ledger.abilityValue,   3);
    });

    // 3. Pool composition with stunt dice + first excellency.
    it("pool composition: stunt + firstExcellency add to the pool", async function () {
      const { attacker, defender } = await setupSocialFixture();
      // Bump motes so excellency mote spend doesn't fail.
      await attacker.update({
        "system.motes.peripheral.value": 30,
        "system.motes.peripheral.max":   30
      });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: {},
        stuntDice: 2, firstExcDice: 3, moteType: "peripheral"
      });
      const ledger = message.flags.exalted2e.socialAttack;
      // 4 cha + 3 pre + 2 stunt + 3 firstExc = 12.
      assert.equal(ledger.pool, 12, "pool = 4 + 3 + 2 + 3");
      assert.equal(ledger.attackerExcMoteCost, 3, "first excellency dice = 3 motes");
      assert.equal(attacker.system.motes.peripheral.value, 27,
        "3 motes spent for first excellency");
    });

    // 4. Allowed abilities: Performance produces a card with the expected pool.
    //    (Per project_socialize_is_social_stealth: rollSocialAttack itself
    //    accepts any ability — Socialize rejection lives in the dialog. We
    //    verify the four allowed abilities compose correctly here.)
    it("ability=Performance produces pool composition with the right ability value", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "manipulation", ability: "performance",
        intent: "compel", claims: {}
      });
      const ledger = message.flags.exalted2e.socialAttack;
      // 2 manipulation (default) + 3 performance = 5.
      assert.equal(ledger.pool, 5);
      assert.equal(ledger.abilityLabel.toLowerCase().includes("performance"), true,
        "ability label localized to performance");
    });

    // 5. Positive intimacy claim verification.
    it("supportingIntimacy: claim verified when defender has a positive intimacy", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await addIntimacy(defender, { positive: true,  subject: "Smooth" });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: { supportingIntimacy: true }
      });
      const ledger = message.flags.exalted2e.socialAttack;
      assert.equal(ledger.claimsVerified.supportingIntimacy, true,
        "claim verified against defender's positive intimacy");
      // Supporting intimacy contributes -1 to stackingMod (lowers MDV).
      assert.equal(ledger.stackingMod, -1, "stackingMod = -1 (best supporting alone)");
    });

    // 6. Negative intimacy claim.
    it("opposingIntimacy: claim verified when defender has a negative intimacy", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await addIntimacy(defender, { positive: false, subject: "Smooth" });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: { opposingIntimacy: true }
      });
      const ledger = message.flags.exalted2e.socialAttack;
      assert.equal(ledger.claimsVerified.opposingIntimacy, true);
      assert.equal(ledger.stackingMod, 1, "stackingMod = +1 (best opposing alone)");
    });

    // 7. Motivation claim verified.
    it("supportingMotivation: claim verified when defender has a motivation", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await addMotivation(defender, "Reclaim my throne");
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: { supportingMotivation: true }
      });
      const ledger = message.flags.exalted2e.socialAttack;
      assert.equal(ledger.claimsVerified.supportingMotivation, true);
      assert.equal(ledger.stackingMod, -3, "supportingMotivation = -3");
    });

    // 8. Net-sum stacking: best supporting + best opposing combine.
    it("net-sum stacking: best supporting + best opposing combine", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await addIntimacy(defender, { positive: true,  subject: "Smooth" });   // -1
      await addIntimacy(defender, { positive: false, subject: "Smooth" });   // +1
      await addMotivation(defender, "Reclaim my throne");                    // -3 if claimed
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence", intent: "build",
        claims: {
          supportingIntimacy:   true,    // best supporting = -1
          supportingMotivation: true,    // best supporting = -3 (overrides -1)
          opposingIntimacy:     true     // best opposing = +1
        }
      });
      const ledger = message.flags.exalted2e.socialAttack;
      // best supporting: min(-1, -3) = -3
      // best opposing:   max(+1)     = +1
      // total: -3 + 1 = -2
      assert.equal(ledger.stackingMod, -2, "best supporting (-3) + best opposing (+1)");
    });

    // 9. Appearance delta: higher attacker App lowers defender MDV.
    it("appearance delta: attacker App > defender App lowers MDV", async function () {
      const { attacker, defender } = await setupSocialFixture({
        attackerOpts: { app: 5 },        // App 5
        defenderOpts: { app: 2 }         // App 2 → delta 3
      });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: {}
      });
      const ledger = message.flags.exalted2e.socialAttack;
      // computeMdvShiftFromApp: clamped delta = min(3, 5-2) = 3, returns -3
      // (negative shift = MDV decrease).
      assert.equal(ledger.mdvShiftFromApp, -3,
        "App 5 vs 2 → -3 MDV shift (clamped at ±3)");
    });

    // 10. Natural cap: defender's wpDrainedNatural >= 2 forces auto-fail.
    it("natural cap: defender's wpDrainedNatural >= 2 forces autoFailedByNaturalCap=true", async function () {
      const { attacker, defender } = await setupSocialFixture();
      // Pre-stamp the per-scene flag so this attack hits the cap.
      await defender.update({
        [`flags.exalted2e.socialScene.${attacker.id}.wpDrainedNatural`]: 2
      });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollSocialAttack(attacker, {
        defender, attribute: "charisma", ability: "presence",
        intent: "build", claims: {}
      });
      const ledger = message.flags.exalted2e.socialAttack;
      assert.equal(ledger.autoFailedByNaturalCap, true,
        "autoFailedByNaturalCap=true when wpDrainedNatural reached the cap");
    });
  });
}
