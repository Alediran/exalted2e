import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep }                          from "../_helpers/cleanup.mjs";
import { createTempCharacter }             from "../_helpers/actors.mjs";
import { placeToken }                      from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor } from "../_helpers/combat.mjs";
import { createTempWeapon }                from "../_helpers/weapons.mjs";
import { stubRollDialog, stubAttackDialog } from "../_helpers/dialogs.mjs";

// ── Shared setup ────────────────────────────────────────────────────────────

/**
 * Create a character with known virtue and WP values.
 * Essence=5 prevents prepareDerivedData from clobbering mote pools below
 * the test's persisted values.
 */
async function setupVirtueActor({
  compassionValue   = 3,
  compassionCurrent = 3,
  wp                = 5
} = {}) {
  const actor = await createTempCharacter({ name: "Virtue-Actor" });
  await actor.update({
    "system.essence.value":                  5,
    "system.motes.peripheral.value":         33,
    "system.motes.personal.value":           13,
    "system.willpower.value":                wp,
    "system.willpower.max":                  Math.max(wp, 5),
    "system.virtues.compassion.value":       compassionValue,
    "system.virtues.compassion.current":     compassionCurrent,
    "system.virtues.compassion.channeled":   false
  });
  return actor;
}

/** Minimal RollDialog result — override specific fields per test. */
function rollDialogResult(over = {}) {
  return {
    pool:               3,
    attribute:          "dexterity",
    flavor:             "test roll",
    stunt:              0,
    advancesMotivation: false,
    rewardKind:         "motes",
    moteCost:           0,
    moteType:           "peripheral",
    specialty:          null,
    firstExcDice:       0,
    secondExcSucc:      0,
    useThirdExc:        false,
    virtueChannelMode:  "none",
    virtueChannel:      null,
    ...over
  };
}

/** Minimal AttackDialog result — override specific fields per test. */
function attackDialogResult(over = {}) {
  return {
    stunt:              0,
    advancesMotivation: false,
    rewardKind:         "motes",
    moteType:           "peripheral",
    firstExcDice:       0,
    secondExcSucc:      0,
    charmIds:           [],
    virtueChannelMode:  "none",
    virtueChannel:      null,
    ...over
  };
}

// ── Batch registration ───────────────────────────────────────────────────────

export function registerVirtueChanneling(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("virtue channeling — rollAttributeAbility", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // [160] None mode: WP and virtues untouched
    it("[160] none mode: no WP or virtue spending", async function () {
      const actor = await setupVirtueActor({ wp: 5, compassionCurrent: 3 });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubRollDialog([rollDialogResult({ virtueChannelMode: "none" })]);

      await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "athletics");

      assert.equal(actor.system.willpower.value, 5, "WP not spent in none mode");
      assert.equal(actor.system.virtues.compassion.current, 3, "virtue current unchanged");
      assert.equal(actor.system.virtues.compassion.channeled, false, "channeled flag not set");
    });

    // [161] Success mode: -1 WP, no virtue touch
    it("[161] success mode: spends 1 WP, virtue current unchanged", async function () {
      const actor = await setupVirtueActor({ wp: 5, compassionCurrent: 3 });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubRollDialog([rollDialogResult({ virtueChannelMode: "success" })]);

      await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "athletics");

      assert.equal(actor.system.willpower.value, 4, "WP decremented by 1");
      assert.equal(actor.system.virtues.compassion.current, 3, "virtue current unchanged");
      assert.equal(actor.system.virtues.compassion.channeled, false, "channeled flag not set");
    });

    // [162] Dice mode: -1 WP, -1 virtue current, channeled = true
    it("[162] dice mode: spends 1 WP + 1 virtue channel, marks channeled", async function () {
      const actor = await setupVirtueActor({ wp: 5, compassionValue: 3, compassionCurrent: 3 });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubRollDialog([rollDialogResult({
        virtueChannelMode: "dice",
        virtueChannel:     "compassion"
      })]);

      await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "athletics");

      assert.equal(actor.system.willpower.value, 4, "WP decremented by 1");
      assert.equal(actor.system.virtues.compassion.current, 2, "virtue current decremented by 1");
      assert.equal(actor.system.virtues.compassion.channeled, true, "channeled flag set");
    });

    // [163] Dice mode with no WP: no spending, no crash
    it("[163] dice mode: no WP available — nothing spent, roll aborted", async function () {
      const actor = await setupVirtueActor({ wp: 0, compassionCurrent: 3 });
      await actor.update({ "system.willpower.value": 0 });

      // Stub warn so we can detect it without it printing to console
      let warned = false;
      const origWarn = ui.notifications.warn;
      ui.notifications.warn = () => { warned = true; };
      try {
        const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
        await stubRollDialog([rollDialogResult({
          virtueChannelMode: "dice",
          virtueChannel:     "compassion"
        })]);
        await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "athletics");
      } finally {
        ui.notifications.warn = origWarn;
      }

      assert.equal(actor.system.willpower.value, 0, "WP unchanged");
      assert.equal(actor.system.virtues.compassion.current, 3, "virtue current unchanged");
      assert.ok(warned, "warning was shown");
    });

    // [164] Dice mode with no virtue current: no spending, no crash
    it("[164] dice mode: no virtue channels left — nothing spent, roll aborted", async function () {
      const actor = await setupVirtueActor({ wp: 5, compassionCurrent: 0 });

      let warned = false;
      const origWarn = ui.notifications.warn;
      ui.notifications.warn = () => { warned = true; };
      try {
        const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
        await stubRollDialog([rollDialogResult({
          virtueChannelMode: "dice",
          virtueChannel:     "compassion"
        })]);
        await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "athletics");
      } finally {
        ui.notifications.warn = origWarn;
      }

      assert.equal(actor.system.willpower.value, 5, "WP unchanged");
      assert.equal(actor.system.virtues.compassion.current, 0, "virtue current unchanged");
      assert.ok(warned, "warning was shown");
    });
  });

  describe("virtue channeling — rollAttack", function () {
    before(assertTestWorld);
    afterEach(sweep);

    async function setupAttackFixture(virtueOpts = {}) {
      const attacker = await setupVirtueActor(virtueOpts);
      const defender = await createTempCharacter({ name: "Defender" });
      await attacker.update({ "system.essence.value": 5 });
      await defender.update({ "system.essence.value": 5 });
      const sc = getTestScene();
      await placeToken(attacker, sc, { x: 0,   y: 0 });
      await placeToken(defender, sc, { x: 100, y: 0 });
      const weapon = await createTempWeapon(attacker, { accuracy: 2, damage: 5, range: 0 });
      const combat = await startTempCombat([attacker, defender], {
        jbStubsByActorId: { [attacker.id]: 5, [defender.id]: 0 }
      });
      await advanceToActor(combat, attacker);
      return { attacker, defender, weapon };
    }

    // [165] None mode: WP and virtue untouched
    it("[165] none mode (attack): no WP or virtue spending", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({ wp: 5, compassionCurrent: 3 });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubAttackDialog([attackDialogResult({ virtueChannelMode: "none" })]);

      await ExaltedRoll.rollAttack(attacker, weapon.id, { explicitTargetActor: defender });

      assert.equal(attacker.system.willpower.value, 5, "WP not spent");
      assert.equal(attacker.system.virtues.compassion.current, 3, "virtue current unchanged");
    });

    // [166] Success mode: -1 WP
    it("[166] success mode (attack): spends 1 WP, virtue unchanged", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({ wp: 5, compassionCurrent: 3 });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubAttackDialog([attackDialogResult({ virtueChannelMode: "success" })]);

      await ExaltedRoll.rollAttack(attacker, weapon.id, { explicitTargetActor: defender });

      assert.equal(attacker.system.willpower.value, 4, "WP decremented by 1");
      assert.equal(attacker.system.virtues.compassion.current, 3, "virtue current unchanged");
    });

    // [167] Dice mode: -1 WP, -1 virtue current, channeled = true
    it("[167] dice mode (attack): spends 1 WP + 1 channel, marks channeled", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture({
        wp: 5, compassionValue: 3, compassionCurrent: 3
      });
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await stubAttackDialog([attackDialogResult({
        virtueChannelMode: "dice",
        virtueChannel:     "compassion"
      })]);

      await ExaltedRoll.rollAttack(attacker, weapon.id, { explicitTargetActor: defender });

      assert.equal(attacker.system.willpower.value, 4, "WP decremented by 1");
      assert.equal(attacker.system.virtues.compassion.current, 2, "virtue current decremented by 1");
      assert.equal(attacker.system.virtues.compassion.channeled, true, "channeled flag set");
    });
  });
}
