import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep }          from "../_helpers/cleanup.mjs";
import { createTempCharacter }             from "../_helpers/actors.mjs";
import { placeToken }                      from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor } from "../_helpers/combat.mjs";
import { createTempWeapon }                from "../_helpers/weapons.mjs";
import { createTempCharm }                 from "../_helpers/charms.mjs";
import { stubAttackDialog }                from "../_helpers/dialogs.mjs";
import { lastChatMessage }                 from "../_helpers/messages.mjs";

/**
 * Minimal AttackDialog return — production reads `stunt`, `firstExcDice`,
 * `secondExcSucc`, `charmIds`, `moteType`, `advancesMotivation`,
 * `rewardKind`. Anything else is ignored.
 */
function defaultDialogResult(over = {}) {
  return {
    stunt:              0,
    advancesMotivation: false,
    rewardKind:         "motes",
    moteType:           "peripheral",
    firstExcDice:       0,
    secondExcSucc:      0,
    charmIds:           [],
    ...over
  };
}

/**
 * Build a two-actor combat fixture for attack tests. Attacker has the
 * given weapon equipped; defender starts at the given offset (in grid
 * cells, 100px per cell on the test scene).
 *
 * Essence=5 keeps `prepareDerivedData`'s computed motes.*.max above any
 * test's persisted pool values (memory: project_motes_max_overridden_by_derived).
 */
async function setupAttackFixture({
  attackerStats = {},
  defenderStats = {},
  weaponOpts    = {},
  defenderCellsX = 1
} = {}) {
  const attacker = await createTempCharacter({
    name: "Atk", str: 4, dex: 4, ath: 0,
    ...attackerStats
  });
  const defender = await createTempCharacter({
    name: "Def", dex: 3,
    ...defenderStats
  });
  await attacker.update({ "system.essence.value": 5 });
  await defender.update({ "system.essence.value": 5 });
  const sc = getTestScene();
  await placeToken(attacker, sc, { x: 0, y: 0 });
  await placeToken(defender, sc, { x: 100 * defenderCellsX, y: 0 });
  const weapon = await createTempWeapon(attacker, {
    accuracy: 2, damage: 5, range: 0, ...weaponOpts
  });
  const combat = await startTempCombat([attacker, defender], {
    jbStubsByActorId: { [attacker.id]: 5, [defender.id]: 0 }
  });
  await advanceToActor(combat, attacker);
  return { attacker, defender, weapon, combat };
}

export function registerAttackPipelineFocused(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("attack pipeline (focused)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Happy path — rollAttack posts a chat card with the expected snapshot.
    it("[45] happy path: posts a chat card with the attack snapshot", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.ok(message, "rollAttack returned a ChatMessage");
      const attack = message.flags?.exalted2e?.attack;
      assert.ok(attack, "attack flag present");
      assert.equal(attack.actorId,  attacker.id, "actorId matches attacker");
      assert.equal(attack.targetId, defender.id, "targetId matches defender");
      assert.equal(attack.weaponName, weapon.name, "weaponName matches");
      assert.equal(attack.defense, null, "defense pending (defender hasn't picked yet)");
    });

    // 2. Pool composition: regular weapon = Dex + Ability + Accuracy.
    it("[46] pool composition: regular weapon adds Dex + Ability + Accuracy", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        attackerStats: { dex: 4 },           // dex 4
        weaponOpts:    { accuracy: 2 }       // accuracy +2
      });
      // Default melee=0; bump it so the pool is large and predictable.
      await attacker.update({ "system.abilities.melee.value": 3 });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const attack = message.flags?.exalted2e?.attack;
      // 4 dex + 3 melee + 2 accuracy = 9. Wound penalty is 0 by default.
      assert.equal(attack.pool, 9, "pool = 4 (dex) + 3 (melee) + 2 (accuracy)");
    });

    // 3. Instant-charm attack: pool is the charm's accuracy formula directly,
    //    no Dex/Ability auto-add. (charmDuration: "instant" + charmSource flag.)
    it("[47] instant-charm attack: pool is the full formula, no Dex/Ability addition", async function () {
      const { attacker, defender } = await setupAttackFixture();
      await attacker.update({ "system.abilities.melee.value": 3 });
      // Synthesize a charm + its instant-spawned weapon. We construct the
      // weapon directly with charmSource + charmDuration: "instant" so
      // rollAttack hits the isInstantCharmAttack branch without needing
      // to actually call _rollCharmInstantAttack.
      const charm = await createTempCharm(attacker, {
        name: "Burning Eye", duration: "instant"
      });
      const weapon = await createTempWeapon(attacker, {
        name: "Burning Eye Bolt",
        accuracy:   8,                // full formula = 8 dice
        damage:     6,
        range:      0,
        charmSource:   charm.id,
        charmDuration: "instant"
      });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const attack = message.flags?.exalted2e?.attack;
      // Pool is just the accuracy (8) — no Dex (4) or melee (3) added.
      assert.equal(attack.pool, 8, "pool = effectiveAccuracy only (no dex/melee)");
      // Damage snapshot should NOT add Strength on instant-charm attacks.
      assert.equal(attack.addStrength, false, "addStrength=false for instant-charm");
    });

    // 4. Range check: melee in range (1 grid space).
    it("[48] range: melee weapon attacking 1 cell away proceeds", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        defenderCellsX: 1                    // 1 cell apart
      });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.ok(message, "attack proceeded (1 cell ≤ 1 cell melee reach)");
    });

    // 5. Range check: melee out of range — rollAttack returns null.
    it("[49] range: melee weapon attacking 3 cells away aborts", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        defenderCellsX: 3                    // 3 cells apart, melee maxes at 1
      });
      // No dialog stub installed — if rollAttack reaches AttackDialog.prompt
      // the test will throw with the un-stubbed-prompt error, surfacing the
      // bug clearly.
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.equal(message, null, "rollAttack returned null on out-of-range");
    });

    // 6. Reach modifier: 2 cells away with Reach tag is in range.
    it("[50] range: Reach tag extends melee from 1 to 2 cells", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        defenderCellsX: 2,
        weaponOpts:     { tags: ["Reach"] }
      });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.ok(message, "Reach weapon at 2 cells in range");
    });

    // 7. Onslaught: defender accrues +1 onslaught after being attacked.
    it("[51] onslaught: defender accrues an onslaught DV penalty after the attack", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const onslaughtAe = defender.effects.find(e =>
        !e.disabled && e.flags?.exalted2e?.dvPenalty?.type === "onslaught"
      );
      assert.ok(onslaughtAe, "onslaught AE stamped on defender");
      assert.equal(onslaughtAe.flags.exalted2e.dvPenalty.value, 1,
        "onslaught value = 1 after the first attack");
    });

    // 8. Holy + Creature of Darkness upgrades damage to aggravated.
    it("[52] Holy + CoD: damage type upgrades to aggravated and holyUpgraded=true", async function () {
      const { attacker, defender } = await setupAttackFixture();
      // Mark the defender as a Creature of Darkness (per CLAUDE.md, this is
      // a flag-based AE — not in CONFIG.statusEffects).
      await defender.createEmbeddedDocuments("ActiveEffect", [{
        name: "Creature of Darkness",
        flags: { exalted2e: { creatureOfDarkness: true } },
        disabled: false,
        transfer: false
      }]);
      // Holy charm + a charm-source weapon (weapons never carry Holy in 2e —
      // it's always charm-sourced). The weapon damage type starts as lethal;
      // Holy + CoD upgrades it to aggravated.
      const charm = await createTempCharm(attacker, {
        name: "Sun's Wrath", keywords: ["Holy"], duration: "instant"
      });
      const weapon = await createTempWeapon(attacker, {
        name: "Sun's Wrath Strike",
        accuracy: 5, damage: 5, damageType: "lethal",
        charmSource: charm.id, charmDuration: "instant"
      });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const attack = message.flags?.exalted2e?.attack;
      assert.equal(attack.damageType, "aggravated", "damage type upgraded");
      assert.equal(attack.holyUpgraded, true,      "holyUpgraded flag set");
      assert.equal(attack.originalDamageType, "lethal",
        "originalDamageType preserved for the strike-through display");
      assert.equal(attack.targetHardness, 0,
        "aggravated bypasses hardness");
    });

    // 9. Unblockable keyword: targetParryDV forced to 0, base preserved.
    it("[53] Unblockable keyword zeros targetParryDV but preserves the base", async function () {
      const { attacker, defender } = await setupAttackFixture();
      const charm = await createTempCharm(attacker, {
        name: "Unstoppable Strike",
        keywords: ["Unblockable"],
        duration: "instant"
      });
      const weapon = await createTempWeapon(attacker, {
        name: "Unstoppable Bolt",
        accuracy: 5, damage: 5,
        charmSource: charm.id, charmDuration: "instant"
      });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const attack = message.flags?.exalted2e?.attack;
      assert.equal(attack.unblockable, true, "unblockable flag set");
      assert.equal(attack.targetParryDV, 0,  "targetParryDV zeroed");
      // The base DV should match what the defender's currentParryDV returned
      // before the zero-out — non-zero for a normal defender.
      assert.ok(attack.targetBaseParryDV >= 0,
        "targetBaseParryDV preserved for display");
    });

    // 10. Soak/hardness snapshot lives on the attack card flags.
    it("[54] snapshot: target soak and hardness land on the attack flags", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        defenderStats: { sta: 4 }
      });
      // Bump defender stamina so soak is non-trivial. Computed soak depends
      // on essence/exalt type/armor, but for the purpose of this test we
      // just verify that whatever the defender's current soak IS, it lands
      // on the snapshot.
      const expectedSoak = defender.system?.totalSoak?.[
        weapon.system.modes[0].damageType
      ] ?? 0;
      const expectedHardness = defender.system?.hardness ?? 0;
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      const attack = message.flags?.exalted2e?.attack;
      assert.equal(attack.targetSoak,     expectedSoak,
        "targetSoak matches defender's current totalSoak[damageType]");
      assert.equal(attack.targetHardness, expectedHardness,
        "targetHardness matches defender's current hardness");
      // Sanity: lastChatMessage() finds the attack card we just made.
      const card = lastChatMessage();
      assert.equal(card?.id, message.id, "lastChatMessage returns the attack card");
    });

    // T01. Smoke test: rollAttack completes without error when no terrain regions exist.
    it("[T01] rollAttack completes without error when no terrain regions exist", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const msg = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        explicitTargetActor: defender,
      });
      assert.ok(msg, "rollAttack returned a ChatMessage");
    });

    // 55. Infinite Mastery discount: 6 committed motes → floor(6/2)=3 mote discount.
    it("[055] Infinite Mastery discount reduces total Excellency cost in rollAttack", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await attacker.update({ "system.exaltType": "solar" });
      // 6 committed motes → discount = floor(6/2) = 3
      // 2 Second Exc successes = 4m raw; after 3m discount = 1m spent
      await attacker.createEmbeddedDocuments("ActiveEffect", [{
        name: "Infinite Melee Mastery",
        transfer: false,
        flags: { exalted2e: { masteryCommitment: 6, masteryAbility: "melee" } }
      }]);
      await attacker.update({ "system.motes.peripheral.value": 20 });
      const motesBefore = attacker.system.motes.peripheral.value;

      await stubAttackDialog([defaultDialogResult({ secondExcSucc: 2, moteType: "peripheral" })]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttack(attacker, weapon.id, { explicitTargetActor: defender });

      // raw = 2×2 = 4m; discount = 3m; net = max(0, 4-3) = 1m
      assert.equal(
        attacker.system.motes.peripheral.value,
        motesBefore - 1,
        "2 Second Exc successes cost 1m after 3m mastery discount (not 4m)"
      );
    });
  });
}
