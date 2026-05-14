import { register, sweep }       from "../_helpers/cleanup.mjs";
import { assertTestWorld }        from "../_helpers/world.mjs";
import { createTempCharacter }    from "../_helpers/actors.mjs";

export function registerCharmEconomics(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Charm economics", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── Permanent costs ───────────────────────────────────────────────────
    it("[C01] activating a charm with permanentEssence=1 creates a permanentCost AE (essence:1)", async () => {
      const actor = await createTempCharacter({ name: "Q-CE-PermEss" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.motes.peripheral.value": 30 });
      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Test Perm Ess", type: "charm",
        system: { charmType: "reflexive", duration: "oneScene",
          cost: { motes: 0, willpower: 0, permanentEssence: 1, permanentWillpower: 0 } }
      }]);
      const before = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost).length;
      await charm.activateCharm({ skipChatCard: true });
      const after = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost);
      assert.equal(after.length - before, 1, "one permanentCost AE created");
      assert.equal(after[after.length - 1].flags.exalted2e.permanentCost.essence, 1, "essence=1");
    });

    it("[C02] activating a charm with permanentWillpower=1 creates a permanentCost AE (willpower:1)", async () => {
      const actor = await createTempCharacter({ name: "Q-CE-PermWP" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.motes.peripheral.value": 30 });
      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Test Perm WP", type: "charm",
        system: { charmType: "reflexive", duration: "oneScene",
          cost: { motes: 0, willpower: 0, permanentEssence: 0, permanentWillpower: 1 } }
      }]);
      const before = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost).length;
      await charm.activateCharm({ skipChatCard: true });
      const after = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost);
      assert.equal(after.length - before, 1, "one permanentCost AE created");
      assert.equal(after[after.length - 1].flags.exalted2e.permanentCost.willpower, 1, "willpower=1");
    });

    it("[C03] activating a charm with permanentEssence=0 permanentWillpower=0 creates no permanentCost AE", async () => {
      const actor = await createTempCharacter({ name: "Q-CE-NoPerm" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.motes.peripheral.value": 30 });
      // DataModel coerces missing permanentEssence/permanentWillpower to 0 — explicit zeros confirm the guard
      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Test No Perm", type: "charm",
        system: { charmType: "reflexive", duration: "oneScene",
          cost: { motes: 0, willpower: 0, permanentEssence: 0, permanentWillpower: 0 } }
      }]);
      const before = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost).length;
      await charm.activateCharm({ skipChatCard: true });
      const after = actor.effects.filter(e => e.flags?.exalted2e?.permanentCost).length;
      assert.equal(after - before, 0, "no permanentCost AE created");
    });

    it("[C04] ledger includes permanentEssence and permanentWillpower fields", async () => {
      const actor = await createTempCharacter({ name: "Q-CE-Ledger" });
      register(actor);
      await actor.update({ "system.exaltType": "solar", "system.motes.peripheral.value": 30 });
      const [charm] = await actor.createEmbeddedDocuments("Item", [{
        name: "Test Ledger", type: "charm",
        system: { charmType: "reflexive", duration: "oneScene",
          cost: { motes: 0, willpower: 0, permanentEssence: 1, permanentWillpower: 0 } }
      }]);
      const msgCountBefore = game.messages.size;
      await charm.activateCharm({ skipChatCard: false });
      let msg;
      for (let i = 0; i < 20; i++) {
        if (game.messages.size > msgCountBefore) {
          msg = game.messages.contents[game.messages.size - 1];
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }
      assert.ok(msg, "chat message posted");
      const ledger = msg?.flags?.exalted2e?.charmActivation?.ledger;
      assert.ok(ledger, "ledger present on message");
      assert.equal(ledger.permanentEssence,   1, "ledger.permanentEssence = 1");
      assert.equal(ledger.permanentWillpower, 0, "ledger.permanentWillpower = 0");
    });

    // ── Infinite Mastery mote commitment ──────────────────────────────────
    it("[M01] mastery AE with commitment=4 adds 4 to peripheral committed", async () => {
      const actor = await createTempCharacter({ name: "Q-CE-Mastery" });
      register(actor);
      await actor.update({ "system.exaltType": "solar" });
      const committedBefore = actor.system.motes.peripheral.committed;
      assert.equal(committedBefore, 0, "baseline committed is zero");
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Infinite Melee Mastery",
        transfer: false,
        flags: { exalted2e: { masteryCommitment: 4, masteryAbility: "melee" } }
      }]);
      assert.equal(
        actor.system.motes.peripheral.committed - committedBefore,
        4,
        "peripheral committed increased by 4"
      );
    });
  });
}
