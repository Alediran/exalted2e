import { cleanupOnAfter, sweep }  from "../_helpers/cleanup.mjs";
import { assertTestWorld }         from "../_helpers/world.mjs";
import { createTempCharacter }     from "../_helpers/actors.mjs";
import { interruptShaping }        from "../../../module/combat/multi-tick-sorcery.mjs";

async function waitFor(pred, { timeoutMs = 3000, intervalMs = 30 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await pred();
    if (v) return v;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out`);
}

async function createShapingCombatant(actor) {
  const combat = await Combat.create({ scene: game.scenes.active?.id });
  const [combatant] = await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id, tokenId: null }]);
  await combatant.setFlag("exalted2e", "multiTickAction", {
    actionKey:   "sorcery",
    totalTicks:  0,
    ticksElapsed: 0,
    cycleCount:  0,
    startTick:   0,
    state: {
      spellId:               "fake-spell-id",
      spellName:             "Test Spell",
      circle:                2,
      totalShapeActions:     2,
      completedShapeActions: 1,
      motesCommitted:        15,
      wpCommitted:           1,
      motesFromPrimary:      15,
      motesFromSecondary:    0,
      primaryPool:           "peripheral",
      secondaryPool:         "personal",
      motePool:              "peripheral",
      dvEffectId:            null,
    }
  });
  return { combat, combatant };
}

export function registerCountermagic(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Countermagic — interruptShaping", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[CM-1] refunds motes and WP, clears multiTickAction", async () => {
      const actor = await createTempCharacter({ name: "Caster CM-1" });
      await actor.update({
        "system.motes.peripheral.value": 15,
        "system.willpower.value": 3,
      });
      const { combat, combatant } = await createShapingCombatant(actor);
      cleanupOnAfter(async () => { await combat.delete(); });

      const preInterrupt = game.actors.get(actor.id);
      const peripheralBefore = preInterrupt.system.motes.peripheral.value;
      const wpBefore = preInterrupt.system.willpower.value;

      await interruptShaping(combatant, "Counter-Actor");

      const updated = game.combats.get(combat.id).combatants.get(combatant.id);
      assert.notOk(
        updated.flags?.exalted2e?.multiTickAction,
        "multiTickAction cleared after interrupt"
      );
      await waitFor(async () => {
        const a = game.actors.get(actor.id);
        return (a.system.motes.peripheral.value ?? 0) > peripheralBefore;
      });
      const refreshed = game.actors.get(actor.id);
      assert.equal(
        refreshed.system.motes.peripheral.value,
        Math.min(refreshed.system.motes.peripheral.max, peripheralBefore + 15),
        "motes refunded"
      );
      assert.equal(
        refreshed.system.willpower.value,
        Math.min(refreshed.system.willpower.max, wpBefore + 1),
        "WP refunded"
      );
    });

    it("[CM-2] is a no-op when multiTickAction is absent", async () => {
      const actor = await createTempCharacter({ name: "Caster CM-2" });
      const combat = await Combat.create({ scene: game.scenes.active?.id });
      cleanupOnAfter(async () => { await combat.delete(); });
      const [combatant] = await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id }]);

      const beforeMsgCount = game.messages.size;
      await interruptShaping(combatant, "Counter-Actor");
      assert.notOk(combatant.flags?.exalted2e?.multiTickAction, "flag still absent");
      assert.equal(game.messages.size, beforeMsgCount, "no chat message emitted for no-op");
    });

    it("[CM-3] posts a chat message naming the interrupter", async () => {
      const actor = await createTempCharacter({ name: "Caster CM-3" });
      const { combat, combatant } = await createShapingCombatant(actor);
      cleanupOnAfter(async () => { await combat.delete(); });

      const beforeIds = new Set(game.messages.contents.map(m => m.id));
      const before = game.messages.size;
      await interruptShaping(combatant, "Emerald Knight");

      await waitFor(() => game.messages.size > before);
      const newMsg = game.messages.contents.find(m => !beforeIds.has(m.id));
      assert.ok(
        newMsg?.content.includes("Emerald Knight"),
        "chat message contains interrupter name"
      );
    });
  });

  describe("Countermagic — spellEffect AE", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[CM-4] non-instant spell cast out-of-combat creates spellEffect AE", async () => {
      const actor = await createTempCharacter({ name: "Caster CM-4" });
      await actor.update({ "system.motes.peripheral.value": 20 });

      const [spell] = await actor.createEmbeddedDocuments("Item", [{
        name: "Test Scene Spell",
        type: "spell",
        system: {
          tradition: "sorcery",
          circle:    1,
          duration:  "scene",
          cost: { motes: 10, willpower: 0 }
        }
      }]);

      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      const { SorceryCastDialog } = await import("../../../module/dialogs/sorcery-cast-dialog.mjs");
      const origPrompt = SorceryCastDialog.prompt;
      SorceryCastDialog.prompt = async () => ({ ok: true });
      cleanupOnAfter(() => { SorceryCastDialog.prompt = origPrompt; });

      await castSpellFlow(spell);

      await waitFor(() =>
        actor.effects.some(ae => ae.flags?.exalted2e?.spellEffect)
      );
      const ae = actor.effects.find(ae => ae.flags?.exalted2e?.spellEffect);
      assert.ok(ae, "spellEffect AE created on actor");
      assert.equal(ae.flags.exalted2e.spellEffect.circle,    1,         "circle stored");
      assert.equal(ae.flags.exalted2e.spellEffect.tradition, "sorcery", "tradition stored");
    });

    it("[CM-5] instant spell cast does NOT create spellEffect AE", async () => {
      const actor = await createTempCharacter({ name: "Caster CM-5" });
      await actor.update({ "system.motes.peripheral.value": 20 });

      const [spell] = await actor.createEmbeddedDocuments("Item", [{
        name: "Instant Spell",
        type: "spell",
        system: { tradition: "sorcery", circle: 1, duration: "instant", cost: { motes: 10 } }
      }]);

      const { castSpellFlow } = await import("../../../module/ui/cast-spell-flow.mjs");
      const { SorceryCastDialog } = await import("../../../module/dialogs/sorcery-cast-dialog.mjs");
      const origPrompt = SorceryCastDialog.prompt;
      SorceryCastDialog.prompt = async () => ({ ok: true });
      cleanupOnAfter(() => { SorceryCastDialog.prompt = origPrompt; });

      const beforeCount = actor.effects.size;
      await castSpellFlow(spell);
      // _createSpellEffectAe exits early for instant-duration — no document created
      assert.equal(actor.effects.size, beforeCount, "no AE created for instant spell");
    });
  });
}
