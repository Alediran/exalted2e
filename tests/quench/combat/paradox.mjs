import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { _patternBitePending } from "../../../module/exalted2e.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerParadox(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Sidereal Paradox track", () => {
    before(() => assertTestWorld());
    afterEach(async () => {
      _patternBitePending.clear();
      await sweep();
    });

    it("[160] setting Paradox to 10 on a Sidereal posts a chat message and resets to 0", async () => {
      const actor = await createTempCharacter({ name: "Q-Paradox-Bite" });
      await actor.update({ "system.exaltType": "sidereal" });
      const startCount = game.messages.size;
      await actor.update({ "system.splat.sidereal.paradox": 10 });
      await waitFor(() => game.messages.size > startCount);
      assert.ok(game.messages.size > startCount, "chat message posted");
      await waitFor(() => actor.system.splat.sidereal.paradox === 0);
      assert.equal(actor.system.splat.sidereal.paradox, 0, "paradox reset to 0");
    });

    it("[161] setting Paradox to 10 on a non-Sidereal does not trigger pattern bite", async () => {
      const actor = await createTempCharacter({ name: "Q-Paradox-Guard" });
      await actor.update({ "system.exaltType": "solar" });
      const startCount = game.messages.size;
      await actor.update({ "system.splat.sidereal.paradox": 10 });
      await new Promise(r => setTimeout(r, 150));
      assert.equal(game.messages.size, startCount, "no message for non-sidereal");
      assert.equal(actor.system.splat.sidereal.paradox, 10, "paradox unchanged");
    });

    it("[162] dedup guard: actor already in pending set does not receive a second message", async () => {
      const actor = await createTempCharacter({ name: "Q-Paradox-Dedup" });
      await actor.update({ "system.exaltType": "sidereal" });
      _patternBitePending.add(actor.id);
      const startCount = game.messages.size;
      await actor.update({ "system.splat.sidereal.paradox": 10 });
      await new Promise(r => setTimeout(r, 150));
      assert.equal(game.messages.size, startCount, "no message while actor is pending");
    });

    it("[163] dropping Paradox below 10 clears pending, allowing a second bite on re-raise", async () => {
      const actor = await createTempCharacter({ name: "Q-Paradox-Reset" });
      await actor.update({ "system.exaltType": "sidereal" });
      const startCount = game.messages.size;
      await actor.update({ "system.splat.sidereal.paradox": 10 });
      await waitFor(() => game.messages.size > startCount);
      await waitFor(() => actor.system.splat.sidereal.paradox === 0);

      const countAfterFirst = game.messages.size;
      await actor.update({ "system.splat.sidereal.paradox": 10 });
      await waitFor(() => game.messages.size > countAfterFirst);
      assert.ok(game.messages.size > countAfterFirst, "second bite posted after paradox reset");
      await waitFor(() => actor.system.splat.sidereal.paradox === 0);
      assert.equal(actor.system.splat.sidereal.paradox, 0, "paradox reset again");
    });
  });
}
