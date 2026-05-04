import { register, sweep }    from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { sanctifyOathBinding } from "../../../module/helpers/oath.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

async function makeEclipse(name, { peripheralMotes = 33, willpower = 5, essence = 3 } = {}) {
  const actor = await createTempCharacter({ name });
  await actor.update({
    "system.exaltType":              "solar",
    "system.caste":                  "eclipse",
    "system.essence.value":          essence,
    "system.motes.peripheral.value": peripheralMotes,
    "system.motes.peripheral.max":   33,
    "system.willpower.value":        willpower,
    "system.willpower.max":          willpower,
  });
  return actor;
}

export function registerEclipseOath(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Solar Eclipse oath-binding", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[174] binding creates AE on target with correct essence and cost is deducted", async () => {
      const eclipse = await makeEclipse("Q-Eclipse-174");
      register(eclipse);
      const target = await createTempCharacter({ name: "Q-Oath-Target-174" });
      register(target);

      await sanctifyOathBinding(eclipse, [target], "never lie");

      const ae = target.effects.find(e => e.flags?.exalted2e?.oathBotch != null);
      assert.ok(ae, "oathBotch AE exists on target");
      assert.equal(ae.flags.exalted2e.oathBotch.bindingEssence, 3, "bindingEssence = 3");
      assert.equal(ae.flags.exalted2e.oathBotch.description, "never lie", "description stored");
      assert.equal(eclipse.system.motes.peripheral.value, 23, "10 peripheral motes spent");
      assert.equal(eclipse.system.willpower.value, 4, "1 WP spent");
    });

    it("[175] binding with insufficient peripheral motes does not create AE or spend costs", async () => {
      const eclipse = await makeEclipse("Q-Eclipse-175", { peripheralMotes: 5 });
      register(eclipse);
      const target = await createTempCharacter({ name: "Q-Oath-Target-175" });
      register(target);

      const result = await sanctifyOathBinding(eclipse, [target], "test oath");

      assert.equal(result, null, "sanctifyOathBinding returns null");
      const ae = target.effects.find(e => e.flags?.exalted2e?.oathBotch != null);
      assert.notOk(ae, "no oathBotch AE created on target");
      assert.equal(eclipse.system.motes.peripheral.value, 5, "peripheral motes unchanged");
    });

    it("[176] botch button injects into rendered chat card for oath-bound actor", async () => {
      const actor = await createTempCharacter({ name: "Q-Eclipse-176" });
      register(actor);

      const [ae] = await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:  "Sacred Oath: test",
        icon:  "icons/svg/statue.svg",
        flags: { exalted2e: { oathBotch: { bindingEssence: 3, description: "test" } } }
      }]);
      register(ae);

      const before = game.messages.size;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: "<div>Roll result</div>",
      });

      await waitFor(() => game.messages.size > before);
      const msg = Array.from(game.messages.values()).at(-1);

      const btn = await waitFor(
        () => document.querySelector(`[data-message-id="${msg.id}"] .btn-oath-botch`) ?? null,
        { timeoutMs: 2000 }
      );
      assert.ok(btn, ".btn-oath-botch button injected into rendered card");
    });

  });
}
