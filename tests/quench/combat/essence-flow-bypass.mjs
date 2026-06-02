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

// ── NPC auto-conversion ───────────────────────────────────────────────────────

export function registerNpcAutoConversion(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("NPC → Character auto-conversion on move into The Circle", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[NPC-1] creates a Character actor when NPC is moved into The Circle", async () => {
      // Find The Circle folder (seeded in this world)
      const circleFolder = game.folders.find(
        f => f.type === "Actor" && f.getFlag("exalted2e", "theCircle")
      );
      if (!circleFolder) {
        assert.ok(false, "The Circle folder not found — is this the test world?");
        return;
      }

      // Create a temporary NPC
      const npc = await Actor.create({
        name:  "Q-NPC-Convert",
        type:  "npc",
        img:   "icons/svg/mystery-man.svg",
        folder: null,
      });
      register(npc);

      const beforeCount = game.actors.filter(a => a.type === "character" && a.name === "Q-NPC-Convert").length;

      // Move NPC into The Circle
      await npc.update({ folder: circleFolder.id });

      // Poll briefly for the async hook to complete
      const deadline = Date.now() + 2000;
      let character = null;
      while (Date.now() < deadline) {
        character = game.actors.find(
          a => a.type === "character" && a.name === "Q-NPC-Convert" && a.folder?.id === circleFolder.id
        );
        if (character) break;
        await new Promise(r => setTimeout(r, 50));
      }

      if (character) register(character);

      assert.ok(character !== null,
        "a Character actor with same name should be created in The Circle");
      assert.equal(character?.img, "icons/svg/mystery-man.svg",
        "portrait should be copied from NPC");

      // Original NPC still exists
      const npcStillExists = game.actors.get(npc.id);
      assert.ok(npcStillExists !== undefined, "original NPC should not be deleted");
    });

    it("[NPC-2] does NOT create a Character when NPC is moved to a non-Circle folder", async () => {
      // Create a plain folder (not The Circle)
      const plainFolder = await Folder.create({
        name:  "Q-Plain-Folder",
        type:  "Actor",
      });
      register(plainFolder);

      const npc = await Actor.create({
        name:  "Q-NPC-NoConvert",
        type:  "npc",
        folder: null,
      });
      register(npc);

      const beforeCount = game.actors.filter(
        a => a.type === "character" && a.name === "Q-NPC-NoConvert"
      ).length;

      await npc.update({ folder: plainFolder.id });

      // Wait a beat for any hypothetical hook
      await new Promise(r => setTimeout(r, 200));

      const afterCount = game.actors.filter(
        a => a.type === "character" && a.name === "Q-NPC-NoConvert"
      ).length;

      assert.equal(afterCount, beforeCount,
        "no Character should be created when moving to a non-Circle folder");
    });
  });
}
