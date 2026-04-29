import { register, cleanupOnAfter, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { placeToken } from "../_helpers/scenes.mjs";
import { startTempCombat, advanceWheel } from "../_helpers/combat.mjs";
import { getPendingStunts, findStuntRewardCard } from "../_helpers/stunts.mjs";
import { bankStuntReward } from "../../../module/combat/stunt-payment.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerStuntRewards(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("stunt rewards — banking and payout", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // Test 1: In-combat banking writes the flag
    it("banks a stunt record on the combatant flag when in combat", async () => {
      const actor = await createTempCharacter({
        name: "Q-Stunt-Bank",
        str: 3, dex: 4, sta: 3,
        cha: 3, man: 3, app: 3,
        per: 3, intel: 3, wit: 4
      });
      await actor.update({ "system.essence.value": 5 });
      await placeToken(actor, getTestScene());
      const startMessages = game.messages.size;
      const combat = await startTempCombat([actor], { rollJoinBattle: false });
      const combatant = combat.combatants.find(c => c.actorId === actor.id);

      await bankStuntReward(actor, {
        stunt: 2,
        advancesMotivation: false,
        rewardKind: "motes",
        sourceMessageId: "msg-test-1"
      });

      const banked = getPendingStunts(combatant);
      assert.equal(banked.length, 1);
      assert.equal(banked[0].stunt, 2);
      assert.equal(banked[0].rewardKind, "motes");
      assert.equal(banked[0].advancesMotivation, false);
      assert.equal(banked[0].sourceMessageId, "msg-test-1");
      assert.equal(game.messages.size, startMessages, "no chat card should be emitted at banking time");
    });

    // Test 2: Out-of-combat immediate payout
    it("pays immediately when no combat is active", async () => {
      const actor = await createTempCharacter({ name: "Q-Stunt-Immediate" });
      await actor.update({ "system.essence.value": 5 });
      await actor.update({ "system.motes.personal.value": 0 });
      const startMessageCount = game.messages.size;

      await bankStuntReward(actor, {
        stunt: 2, advancesMotivation: false, rewardKind: "motes"
      });

      assert.equal(actor.system.motes.personal.value, 4);
      const card = findStuntRewardCard();
      assert.ok(card, "stunt-reward chat card should exist");
      assert.ok(game.messages.size > startMessageCount);
    });

    // Test 3: Drain at landed tick
    it("drains banked stunt at the combatant's landed tick", async () => {
      const actor = await createTempCharacter({ name: "Q-Stunt-Drain" });
      await actor.update({ "system.essence.value": 5, "system.motes.personal.value": 0 });
      await placeToken(actor, getTestScene());
      const combat = await startTempCombat([actor], { rollJoinBattle: false });
      const combatant = combat.combatants.find(c => c.actorId === actor.id);

      await bankStuntReward(actor, {
        stunt: 3, advancesMotivation: false, rewardKind: "motes"
      });
      await combatant.setFlag("exalted2e", "committedAction", {
        actionKey: "test", speed: 5, dvMod: -1, tickCommitted: combat.currentTick ?? 0
      });

      const startMessages = game.messages.size;
      await advanceWheel(combat);

      assert.equal(actor.system.motes.personal.value, 6);
      assert.equal(getPendingStunts(combatant).length, 0);
      assert.equal(game.messages.size - startMessages, 1, "chat card emitted on drain");
    });

    // Test 4: Drain gate (pass-action bump does NOT drain)
    it("does NOT drain when neither committedAction nor actedThisTick is set", async () => {
      const actor = await createTempCharacter({ name: "Q-Stunt-Gate" });
      await actor.update({ "system.essence.value": 5, "system.motes.personal.value": 0 });
      await placeToken(actor, getTestScene());
      const combat = await startTempCombat([actor], { rollJoinBattle: false });
      const combatant = combat.combatants.find(c => c.actorId === actor.id);

      await bankStuntReward(actor, {
        stunt: 2, advancesMotivation: false, rewardKind: "motes"
      });
      await combatant.unsetFlag("exalted2e", "committedAction");

      const startMessages = game.messages.size;
      await advanceWheel(combat);

      assert.equal(actor.system.motes.personal.value, 0,
        "pool unchanged because gate failed");
      assert.equal(getPendingStunts(combatant).length, 1,
        "flag still present");
      assert.equal(game.messages.size, startMessages,
        "no chat card emitted");
    });

    // Test 5: End-of-combat killing-blow drain
    it("drains pending stunts via endCombat (killing-blow case)", async () => {
      const actor = await createTempCharacter({ name: "Q-Stunt-EndCombat" });
      await actor.update({ "system.essence.value": 5, "system.motes.personal.value": 0 });
      await placeToken(actor, getTestScene());
      const combat = await startTempCombat([actor], { rollJoinBattle: false });

      await bankStuntReward(actor, {
        stunt: 2, advancesMotivation: false, rewardKind: "motes"
      });
      const DialogV2 = foundry.applications.api.DialogV2;
      const origConfirm = DialogV2.confirm;
      DialogV2.confirm = async () => true;
      cleanupOnAfter(() => { DialogV2.confirm = origConfirm; });

      const startMessages = game.messages.size;
      combat.endCombat();
      await waitFor(() => actor.system.motes.personal.value === 4);
      await waitFor(() => game.messages.size > startMessages);

      assert.equal(actor.system.motes.personal.value, 4);
      assert.ok(game.messages.size > startMessages, "chat card emitted on combat end");
    });

    // Test 6: Aggregate drain (three records, one card)
    it("aggregates multiple banked records into one card and one update", async () => {
      const actor = await createTempCharacter({ name: "Q-Stunt-Aggregate" });
      await actor.update({ "system.essence.value": 5, "system.motes.personal.value": 0 });
      await placeToken(actor, getTestScene());
      const combat = await startTempCombat([actor], { rollJoinBattle: false });
      const combatant = combat.combatants.find(c => c.actorId === actor.id);

      for (const stunt of [1, 2, 3]) {
        await bankStuntReward(actor, {
          stunt, advancesMotivation: false, rewardKind: "motes"
        });
      }
      await combatant.setFlag("exalted2e", "committedAction", {
        actionKey: "test", speed: 5, dvMod: -1, tickCommitted: combat.currentTick ?? 0
      });

      const startMessages = game.messages.size;
      await advanceWheel(combat);

      assert.equal(actor.system.motes.personal.value, 12,
        "personal pool received the aggregate");
      assert.equal(getPendingStunts(combatant).length, 0, "flag cleared");
      assert.equal(game.messages.size - startMessages, 1,
        "exactly one chat card from the aggregate drain");
    });

    // Test 7: NPC no-op
    it("is a silent no-op when actor.type !== 'character'", async () => {
      const npc = await Actor.create({
        name: "Q-Stunt-NPC",
        type: "npc",
        system: {}
      });
      register(npc);
      await placeToken(npc, getTestScene());
      const combat = await startTempCombat([npc], { rollJoinBattle: false });
      const combatant = combat.combatants.find(c => c.actorId === npc.id);

      const startMessages = game.messages.size;
      await bankStuntReward(npc, {
        stunt: 3, advancesMotivation: true, rewardKind: "willpower"
      });

      assert.equal(getPendingStunts(combatant).length, 0,
        "no flag written on NPC combatant");
      assert.equal(game.messages.size, startMessages,
        "no chat card");
    });
  });
}
