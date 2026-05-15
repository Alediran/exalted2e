import { assertTestWorld, getTestScene }  from "../_helpers/world.mjs";
import { sweep, cleanupOnAfter }          from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { createTempCharm }               from "../_helpers/charms.mjs";
import { placeToken }                    from "../_helpers/scenes.mjs";
import { startTempCombat }               from "../_helpers/combat.mjs";
import { stubCooperativeCharmDialog }    from "../_helpers/dialogs.mjs";
import { chatMessageByFlag }             from "../_helpers/messages.mjs";

/**
 * Create a temporary terrestrial (Dragon-Blooded) actor with essence 5
 * and a generous peripheral pool, ready for cooperation tests.
 */
async function makeDB(name, overrides = {}) {
  const actor = await createTempCharacter({ name });
  await actor.update({
    "system.exaltType": "terrestrial",
    "system.essence.value": 5,
    "system.motes.peripheral.value": 20,
    ...overrides,
  });
  return actor;
}

/**
 * Create a Cooperative charm on `actor`. Updates `cooperationBonusDice`
 * after creation because it is not part of the `createTempCharm` schema.
 */
async function makeCoopCharm(actor, {
  name     = "Coop Test Charm",
  moteCost = 3,
  bonusDice = 1,
  duration = "oneScene",
  attack   = null,
} = {}) {
  const charm = await createTempCharm(actor, {
    name,
    keywords: ["Cooperative"],
    cost: { formula: moteCost > 0 ? `${moteCost}m` : "—" },
    duration,
    ...(attack ? { attack } : {}),
  });
  await charm.update({ "system.cooperationBonusDice": bonusDice });
  return charm;
}

export function registerCooperativeCharm(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("DB Charm cooperation", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ------------------------------------------------------------------ //
    // [228] Solo combatant — no dialog, cooperation null                   //
    // ------------------------------------------------------------------ //
    it("[228] no dialog when lead is the only combatant on tick", async () => {
      const scene = getTestScene();
      const lead  = await makeDB("Q-Coop-Lead228");
      await placeToken(lead, scene);
      await startTempCombat([lead]);

      const charm = await makeCoopCharm(lead);

      // Do NOT stub — real prompt() returns null (no candidates on tick).
      const result = await charm.activateCharm({ skipXpConfirm: true });
      assert.isTrue(result, "activateCharm should return true");

      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      const ledger = card.flags.exalted2e.charmActivation.ledger;
      assert.isNull(ledger.cooperation, "cooperation should be null with no other combatants");
    });

    // ------------------------------------------------------------------ //
    // [229] Ineligible supporter (no charm owned) — Solo pressed           //
    // ------------------------------------------------------------------ //
    it("[229] ineligible supporter (no charm owned) — cooperation skipped", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead229");
      const support = await makeDB("Q-Coop-Sup229");
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead);
      // Support has NO charm with that name — ineligible.

      const motesBefore = support.system.motes.peripheral.value;
      await stubCooperativeCharmDialog([null]); // user picks Solo

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        support.system.motes.peripheral.value, motesBefore,
        "supporter motes must be unchanged"
      );
      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      assert.isNull(
        card.flags.exalted2e.charmActivation.ledger.cooperation,
        "ledger.cooperation must be null"
      );
    });

    // ------------------------------------------------------------------ //
    // [230] Ineligible supporter (insufficient motes) — Solo pressed       //
    // ------------------------------------------------------------------ //
    it("[230] ineligible supporter (insufficient motes) — cooperation skipped", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead230");
      // Support has only 1 peripheral mote — not enough for moteCost=3.
      const support = await makeDB("Q-Coop-Sup230", { "system.motes.peripheral.value": 1 });
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead, { moteCost: 3 });
      // Give support the same charm name so only motes are the disqualifier.
      await support.createEmbeddedDocuments("Item", [{
        name: charm.name, type: "charm", system: {},
      }]);

      await stubCooperativeCharmDialog([null]); // user picks Solo

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        support.system.motes.peripheral.value, 1,
        "supporter motes must remain at 1"
      );
      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      assert.isNull(
        card.flags.exalted2e.charmActivation.ledger.cooperation,
        "ledger.cooperation must be null"
      );
    });

    // ------------------------------------------------------------------ //
    // [231] Supporter motes deducted correctly (1 supporter)               //
    // ------------------------------------------------------------------ //
    it("[231] supporter motes deducted correctly (1 supporter)", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead231");
      const support = await makeDB("Q-Coop-Sup231");
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead, { moteCost: 3 });
      await support.createEmbeddedDocuments("Item", [{
        name: charm.name, type: "charm", system: {},
      }]);

      const motesBefore = support.system.motes.peripheral.value;
      await stubCooperativeCharmDialog([{ supporters: [support] }]);

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        support.system.motes.peripheral.value,
        motesBefore - 3,
        "supporter should have spent 3 peripheral motes"
      );
      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      const coop = card.flags.exalted2e.charmActivation.ledger.cooperation;
      assert.ok(coop, "ledger.cooperation must be set");
      assert.equal(coop.supporters.length, 1, "one supporter recorded");
      assert.equal(coop.supporters[0].motesPaid, 3, "motesPaid must be 3");
    });

    // ------------------------------------------------------------------ //
    // [232] bonusDice = supporters.length × cooperationBonusDice           //
    // ------------------------------------------------------------------ //
    it("[232] bonusDice = supporters.length × cooperationBonusDice", async () => {
      const scene = getTestScene();
      const lead  = await makeDB("Q-Coop-Lead232");
      const s1    = await makeDB("Q-Coop-S1-232");
      const s2    = await makeDB("Q-Coop-S2-232");
      await placeToken(lead, scene, { x: 0,   y: 0 });
      await placeToken(s1,   scene, { x: 100, y: 0 });
      await placeToken(s2,   scene, { x: 200, y: 0 });

      const jbStubs = { [lead.id]: 5, [s1.id]: 5, [s2.id]: 5 };
      await startTempCombat([lead, s1, s2], { jbStubsByActorId: jbStubs });

      // Each supporter contributes 2 bonus dice → 2 supporters × 2 = 4.
      const charm = await makeCoopCharm(lead, { bonusDice: 2 });
      for (const sup of [s1, s2]) {
        await sup.createEmbeddedDocuments("Item", [{
          name: charm.name, type: "charm", system: {},
        }]);
      }

      await stubCooperativeCharmDialog([{ supporters: [s1, s2] }]);

      await charm.activateCharm({ skipXpConfirm: true });

      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      const coop = card.flags.exalted2e.charmActivation.ledger.cooperation;
      assert.ok(coop, "ledger.cooperation must be set");
      assert.equal(coop.bonusDice, 4, "bonusDice must be 4 (2 supporters × 2 each)");
    });

    // ------------------------------------------------------------------ //
    // [233] Solo button skips supporter mote deduction                     //
    // ------------------------------------------------------------------ //
    it("[233] Solo button skips supporter mote deduction", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead233");
      const support = await makeDB("Q-Coop-Sup233");
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead);
      await support.createEmbeddedDocuments("Item", [{
        name: charm.name, type: "charm", system: {},
      }]);

      const motesBefore = support.system.motes.peripheral.value;
      await stubCooperativeCharmDialog([null]); // Solo

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        support.system.motes.peripheral.value, motesBefore,
        "supporter motes must be unchanged after Solo"
      );
      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      assert.isNull(
        card.flags.exalted2e.charmActivation.ledger.cooperation,
        "ledger.cooperation must be null after Solo"
      );
    });

    // ------------------------------------------------------------------ //
    // [234] Instant attack charm — cooperation bonusDice forwarded         //
    // ------------------------------------------------------------------ //
    it("[234] instant attack charm: cooperation bonusDice forwarded to rollAttack as extraDice", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead234");
      const support = await makeDB("Q-Coop-Sup234");
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead, {
        bonusDice: 2,
        duration:  "instant",
        attack:    { accuracy: 3, damage: 4, speed: 5 },
      });
      await support.createEmbeddedDocuments("Item", [{
        name: charm.name, type: "charm", system: {},
      }]);

      await stubCooperativeCharmDialog([{ supporters: [support] }]);

      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      let capturedOptions = null;
      const origRollAttack = ExaltedRoll.rollAttack;
      cleanupOnAfter(() => { ExaltedRoll.rollAttack = origRollAttack; });
      ExaltedRoll.rollAttack = async (_actor, _weaponId, opts) => {
        capturedOptions = opts;
        return null;
      };

      await charm.activateCharm({ skipXpConfirm: true });

      assert.equal(
        capturedOptions?.extraDice, 2,
        "extraDice must be 2 (1 supporter × 2 bonusDice)"
      );
    });

    // ------------------------------------------------------------------ //
    // [235] cooperationBonusDice = 0 → ledger.cooperation.bonusDice = 0   //
    // ------------------------------------------------------------------ //
    it("[235] cooperationBonusDice = 0 — ledger.cooperation.bonusDice is 0", async () => {
      const scene   = getTestScene();
      const lead    = await makeDB("Q-Coop-Lead235");
      const support = await makeDB("Q-Coop-Sup235");
      await placeToken(lead,    scene, { x: 0,   y: 0 });
      await placeToken(support, scene, { x: 100, y: 0 });

      const jbStubs = { [lead.id]: 5, [support.id]: 5 };
      await startTempCombat([lead, support], { jbStubsByActorId: jbStubs });

      const charm = await makeCoopCharm(lead, { bonusDice: 0 });
      await support.createEmbeddedDocuments("Item", [{
        name: charm.name, type: "charm", system: {},
      }]);

      await stubCooperativeCharmDialog([{ supporters: [support] }]);

      await charm.activateCharm({ skipXpConfirm: true });

      const card = chatMessageByFlag("charmActivation", v => v?.charmId === charm.id);
      assert.ok(card, "activation card must exist");
      const coop = card.flags.exalted2e.charmActivation.ledger.cooperation;
      assert.ok(coop, "ledger.cooperation must be set");
      assert.equal(coop.bonusDice, 0, "bonusDice must be 0");
    });

  });
}
