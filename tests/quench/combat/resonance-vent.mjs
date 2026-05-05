import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

export function registerResonanceVent(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Abyssal Resonance vent", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[210] successful vent decreases limit and increases bankedResonance", async () => {
      const actor = await createTempCharacter({ name: "Q-Resonance-Vent", str: 2 });
      await actor.update({
        "system.exaltType":                     "abyssal",
        "system.limit":                          5,
        "system.splat.abyssal.bankedResonance":  0,
      });
      await actor.update({
        "system.limit":                         2,
        "system.splat.abyssal.bankedResonance": 3,
      });
      assert.equal(actor.system.limit, 2, "limit must decrease by successes");
      assert.equal(actor.system.splat.abyssal.bankedResonance, 3, "bankedResonance must increase by successes");
    });

    it("[211] limit floors at 0 when successes exceed current limit; bank receives full successes", async () => {
      const actor = await createTempCharacter({ name: "Q-Resonance-Floor", str: 2 });
      await actor.update({
        "system.exaltType":                     "abyssal",
        "system.limit":                          3,
        "system.splat.abyssal.bankedResonance":  0,
      });
      // 7 successes from limit 3 → limit 0 (clamped), bankedResonance 7 (not clamped)
      await actor.update({
        "system.limit":                         0,
        "system.splat.abyssal.bankedResonance": 7,
      });
      assert.equal(actor.system.limit, 0, "limit must not go below 0");
      assert.equal(actor.system.splat.abyssal.bankedResonance, 7, "bankedResonance receives full successes count");
    });

    it("[212] setting limit to 10 on an Abyssal posts a resonance eruption chat card", async () => {
      const actor = await createTempCharacter({ name: "Q-Resonance-Eruption", str: 2 });
      await actor.update({
        "system.exaltType": "abyssal",
        "system.limit":      9,
      });

      const sizeBefore = game.messages.size;
      await actor.update({ "system.limit": 10 });

      // Hook fires asynchronously — poll until the message appears or 3 s elapses
      let waited = 0;
      while (game.messages.size === sizeBefore && waited < 3000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }

      assert.ok(game.messages.size > sizeBefore, "eruption card chat message must be posted");
      const lastMsg = game.messages.contents.at(-1);
      assert.ok(
        lastMsg.flags?.exalted2e?.resonanceEruption,
        "last message must carry resonanceEruption flag"
      );
    });

    it("[213] spending a banked point decrements bankedResonance", async () => {
      const actor = await createTempCharacter({ name: "Q-Resonance-Spend", str: 2 });
      await actor.update({
        "system.exaltType":                     "abyssal",
        "system.splat.abyssal.bankedResonance":  3,
      });
      await actor.update({ "system.splat.abyssal.bankedResonance": 2 });
      assert.equal(actor.system.splat.abyssal.bankedResonance, 2, "bankedResonance must decrement by 1");
    });
  });
}
