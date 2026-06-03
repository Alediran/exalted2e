import { cleanupOnAfter, sweep }  from "../_helpers/cleanup.mjs";
import { assertTestWorld }         from "../_helpers/world.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";
import { createTempCharm }         from "../_helpers/charms.mjs";
import { stubPurchaseConfirm }     from "../_helpers/dialogs.mjs";
import { register }               from "../_helpers/cleanup.mjs";

// ── Essence Flow ──────────────────────────────────────────────────────────────

export function registerEssenceFlow(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Essence Flow — dialog cap detection", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[EF-1] essenceFlowActive: true passed to RollDialog when actor owns Essence Flow charm", async () => {
      const actor = await createTempCharacter({ name: "Q-EssenceFlow-Yes", wit: 3, intel: 2 });
      await actor.update({
        "system.exaltType": "solar",
        "system.abilities.occult.value": 3,
        "system.essence.value": 2,
      });
      await createTempCharm(actor, {
        name:        "Occult Essence Flow",
        ability:     "occult",
        essenceFlow: true,
        essence:     1,
        minAbility:  1,
      });

      const { RollDialog } = await import("../../../module/rolls/roll-dialog.mjs");
      let capturedOptions = null;
      const orig = RollDialog.prompt;
      cleanupOnAfter(() => { RollDialog.prompt = orig; });
      RollDialog.prompt = async (opts) => {
        capturedOptions = opts;
        // Minimal valid result so rollAttributeAbility can complete
        return {
          pool: 5, stunt: 1, firstExcDice: 0, secondExcSucc: 0,
          useThirdExc: false, moteCost: 0, moteType: "peripheral",
          advancesMotivation: false, rewardKind: "motes",
          attribute: "wits", specialty: null,
          virtueChannelMode: "none", virtueChannel: null
        };
      };

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttributeAbility(actor, "wits", "occult");

      assert.ok(capturedOptions !== null, "RollDialog.prompt was called");
      assert.strictEqual(capturedOptions.essenceFlowActive, true,
        "essenceFlowActive should be true for actor with Essence Flow charm");
    });

    it("[EF-2] essenceFlowActive: false when no Essence Flow charm for the ability", async () => {
      const actor = await createTempCharacter({ name: "Q-EssenceFlow-No", wit: 3, intel: 2 });
      await actor.update({
        "system.exaltType": "solar",
        "system.abilities.occult.value": 3,
      });
      // Charm exists but for a DIFFERENT ability
      await createTempCharm(actor, {
        name:        "Melee Essence Flow",
        ability:     "melee",
        essenceFlow: true,
        essence:     1,
        minAbility:  1,
      });

      const { RollDialog } = await import("../../../module/rolls/roll-dialog.mjs");
      let capturedOptions = null;
      const orig = RollDialog.prompt;
      cleanupOnAfter(() => { RollDialog.prompt = orig; });
      RollDialog.prompt = async (opts) => {
        capturedOptions = opts;
        return {
          pool: 5, stunt: 0, firstExcDice: 0, secondExcSucc: 0,
          useThirdExc: false, moteCost: 0, moteType: "peripheral",
          advancesMotivation: false, rewardKind: "motes",
          attribute: "wits", specialty: null,
          virtueChannelMode: "none", virtueChannel: null
        };
      };

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttributeAbility(actor, "wits", "occult");

      assert.strictEqual(capturedOptions?.essenceFlowActive, false,
        "essenceFlowActive should be false — charm is for melee, not occult");
    });

    it("[EF-3] Essence Flow does not activate for attr-based exalt types (Lunar/Alchemical)", async () => {
      const actor = await createTempCharacter({ name: "Q-EssenceFlow-Lunar", dex: 4 });
      await actor.update({
        "system.exaltType": "lunar",
        "system.abilities.occult.value": 3,
      });
      await createTempCharm(actor, {
        name:        "Occult Essence Flow",
        ability:     "occult",
        essenceFlow: true,
        essence:     1,
        minAbility:  1,
      });

      const { RollDialog } = await import("../../../module/rolls/roll-dialog.mjs");
      let capturedOptions = null;
      const orig = RollDialog.prompt;
      cleanupOnAfter(() => { RollDialog.prompt = orig; });
      RollDialog.prompt = async (opts) => {
        capturedOptions = opts;
        return {
          pool: 4, stunt: 0, firstExcDice: 0, secondExcSucc: 0,
          useThirdExc: false, moteCost: 0, moteType: "peripheral",
          advancesMotivation: false, rewardKind: "motes",
          attribute: "dexterity", specialty: null,
          virtueChannelMode: "none", virtueChannel: null
        };
      };

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttributeAbility(actor, "dexterity", "occult");

      assert.strictEqual(capturedOptions?.essenceFlowActive, false,
        "essenceFlowActive should be false for attr-based (Lunar) exalt");
    });
  });
}

// ── Purchase Bypass ───────────────────────────────────────────────────────────

export function registerPurchaseBypass(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("purchase mode — ST bypass button", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[PB-1] bypass resolves with xpCost=0 and trait applies without XP deduction", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Bypass-XP", str: 2 });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 20,
      });
      // Stub returns bypass result: xpCost 0
      await stubPurchaseConfirm([{ xpCost: 0, note: "ST override — no XP deducted." }]);

      await actor.update({ "system.attributes.strength.value": 3 });

      assert.equal(actor.system.attributes.strength.value, 3,
        "trait applied");
      assert.equal(actor.system.experience.value, 20,
        "XP balance unchanged — bypass deducts 0");

      const log = actor.system.purchaseLog ?? [];
      assert.equal(log.length, 1, "log entry still written");
      assert.equal(log[0].xpCost, 0, "xpCost logged as 0");
    });

    it("[PB-2] bypass note is stored in purchase log", async () => {
      const actor = await createTempCharacter({ name: "Q-Purchase-Bypass-Note", sta: 2 });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 10,
      });
      const bypassNote = "ST override — no XP deducted.";
      await stubPurchaseConfirm([{ xpCost: 0, note: bypassNote }]);

      await actor.update({ "system.attributes.stamina.value": 3 });

      const log = actor.system.purchaseLog ?? [];
      assert.equal(log[0]?.note, bypassNote,
        "bypass note stored in log entry");
    });
  });
}
