import { register, sweep }          from "../_helpers/cleanup.mjs";
import { assertTestWorld }            from "../_helpers/world.mjs";
import { createTempCharacter }        from "../_helpers/actors.mjs";
import { _limitBreakPending, _resolveLimitBreak } from "../../../module/exalted2e.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

function findLBCard(actorId) {
  return Array.from(game.messages.values()).reverse()
    .find(m => m.flags?.exalted2e?.limitBreak?.actorId === actorId) ?? null;
}

async function waitForLBCard(actor) {
  const msg = await waitFor(() => findLBCard(actor.id) ?? false);
  register(msg);
  return msg;
}

async function makeSolarWithFlaw({
  name,
  compassionRating = 3,
  wp    = 5,
  wpMax = 10,
} = {}) {
  const actor = await createTempCharacter({ name });
  await actor.update({
    "system.exaltType":                  "solar",
    "system.virtues.compassion.value":   compassionRating,
    "system.willpower.max":              wpMax,
    "system.willpower.value":            wp,
  });
  const [flaw] = await actor.createEmbeddedDocuments("Item", [{
    name:   "Q Torment",
    type:   "virtueflaw",
    system: { baseVirtue: "compassion", description: "Test flaw." },
  }]);
  register(flaw);
  return { actor, flaw };
}

export function registerLimitBreak(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Limit Break automation", () => {
    before(() => assertTestWorld());
    afterEach(async () => {
      _limitBreakPending.clear();
      await sweep();
    });

    it("[148] posts a chat card when a classical exalt's Limit reaches 10", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Post" });
      const startCount = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await waitFor(() => game.messages.size > startCount);
      assert.ok(game.messages.size > startCount, "chat card posted");
    });

    it("[149] card flags carry actorId, virtueFlawId, virtueRating, and resolved: false", async () => {
      const { actor, flaw } = await makeSolarWithFlaw({ name: "Q-LB-Flags", compassionRating: 3 });
      await actor.update({ "system.limit.value": 10 });
      const msg = await waitForLBCard(actor);
      const lb  = msg.flags.exalted2e.limitBreak;
      assert.equal(lb.actorId,      actor.id,  "actorId");
      assert.equal(lb.virtueFlawId, flaw.id,   "virtueFlawId");
      assert.equal(lb.virtueRating, 3,          "virtueRating");
      assert.equal(lb.resolved,     false,      "resolved: false");
    });

    it("[150] Full Break restores Virtue rating as Temporal WP and resets Limit to 0", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Full", compassionRating: 3, wp: 5, wpMax: 10 });
      await actor.update({ "system.limit.value": 10 });
      const msg = await waitForLBCard(actor);
      await _resolveLimitBreak(msg, "full");
      await waitFor(() => msg.flags?.exalted2e?.limitBreak?.resolved === true);
      assert.equal(actor.system.willpower.value, 8, "WP restored by virtue rating");
      assert.equal(actor.toObject().system.limit.value, 0, "Limit reset to 0");
      assert.equal(msg.flags.exalted2e.limitBreak.choice, "full");
    });

    it("[151] Full Break caps WP recovery at willpower.max", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Cap", compassionRating: 3, wp: 9, wpMax: 10 });
      await actor.update({ "system.limit.value": 10 });
      const msg = await waitForLBCard(actor);
      await _resolveLimitBreak(msg, "full");
      await waitFor(() => msg.flags?.exalted2e?.limitBreak?.resolved === true);
      assert.equal(actor.system.willpower.value, 10, "WP capped at max");
      assert.equal(actor.toObject().system.limit.value, 0, "Limit reset to 0");
    });

    it("[152] Partial Control resets Limit to 0 without WP change", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Partial", compassionRating: 3, wp: 5, wpMax: 10 });
      await actor.update({ "system.limit.value": 10 });
      const msg = await waitForLBCard(actor);
      await _resolveLimitBreak(msg, "partial");
      await waitFor(() => msg.flags?.exalted2e?.limitBreak?.resolved === true);
      assert.equal(actor.system.willpower.value, 5, "WP unchanged");
      assert.equal(actor.toObject().system.limit.value, 0, "Limit reset to 0");
      assert.equal(msg.flags.exalted2e.limitBreak.choice, "partial");
    });

    it("[153] resolved guard: second _resolveLimitBreak call is a no-op", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Guard", compassionRating: 3, wp: 5, wpMax: 10 });
      await actor.update({ "system.limit.value": 10 });
      const msg = await waitForLBCard(actor);
      await _resolveLimitBreak(msg, "full");
      await waitFor(() => msg.flags?.exalted2e?.limitBreak?.resolved === true);
      const wpAfterFirst = actor.system.willpower.value;
      await _resolveLimitBreak(msg, "full");
      assert.equal(actor.system.willpower.value, wpAfterFirst, "second call changes nothing");
    });

    it("[154] dedup guard: actor already in pending set does not receive a second card", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Dedup" });
      _limitBreakPending.add(actor.id);
      const startCount = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await new Promise(r => setTimeout(r, 150));
      assert.equal(game.messages.size, startCount, "no card while actor is pending");
    });

    it("[155] dropping Limit below 10 clears pending, allowing a second card on re-raise", async () => {
      const { actor } = await makeSolarWithFlaw({ name: "Q-LB-Reset" });
      const startCount = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await waitFor(() => game.messages.size > startCount);
      register(findLBCard(actor.id));

      await actor.update({ "system.limit.value": 0 });
      await new Promise(r => setTimeout(r, 50));

      const countAfterFirst = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await waitFor(() => game.messages.size > countAfterFirst);
      assert.ok(game.messages.size > countAfterFirst, "second card posted after limit reset");
      register(findLBCard(actor.id));
    });

    it("[156] posts a warning card with null virtueFlawId when actor has no VirtueFlaw item", async () => {
      const actor = await createTempCharacter({ name: "Q-LB-NoFlaw" });
      await actor.update({ "system.exaltType": "solar" });
      const startCount = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await waitFor(() => game.messages.size > startCount);
      const msg = findLBCard(actor.id);
      register(msg);
      assert.ok(msg, "card posted");
      assert.equal(msg.flags.exalted2e.limitBreak.virtueFlawId, null, "no flaw id");
      assert.equal(msg.flags.exalted2e.limitBreak.virtueRating, 0,    "virtue rating is 0");
    });

    it("[157] does not post a Limit Break card for non-classical exalts (abyssal)", async () => {
      const actor = await createTempCharacter({ name: "Q-LB-Abyssal" });
      await actor.update({ "system.exaltType": "abyssal" });
      const startCount = game.messages.size;
      await actor.update({ "system.limit.value": 10 });
      await new Promise(r => setTimeout(r, 150));
      assert.equal(game.messages.size, startCount, "no card for abyssal");
    });
  });
}
