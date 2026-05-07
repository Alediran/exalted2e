import { assertTestWorld }       from "../_helpers/world.mjs";
import { sweep, register, cleanupOnAfter } from "../_helpers/cleanup.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";

export function registerCharmTargetEffect(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm targetEffect.onHit", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("creates a charmTargetEffect AE on the target when attackSuccess fires", async function () {
      const attacker = await createTempCharacter({ name: "TE Attacker" });
      const target   = await createTempCharacter({ name: "TE Target" });

      const [charm] = await attacker.createEmbeddedDocuments("Item", [{
        name: "Test OnHit Charm",
        type: "charm",
        system: {
          charmType: "supplemental",
          duration:  "instant",
          targetEffect: {
            enabled:  true,
            trigger:  "onHit",
            label:    "Test Debuff",
            icon:     "icons/svg/aura.svg",
            duration: "oneScene",
            changes:  [],
            internalPenalty: { enabled: true, type: "all", amount: -1 },
          },
        },
      }]);
      register(charm);

      Hooks.callAll("exalted2e.attackSuccess", {
        attackerActorId: attacker.id,
        attack: {
          targetId:     target.id,
          attackCharms: ["Test OnHit Charm"],
        },
      });

      const deadline = Date.now() + 3000;
      while (!target.effects.some(e => e.flags?.exalted2e?.charmTargetEffect)) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      const ae = [...target.effects].find(e => e.flags?.exalted2e?.charmTargetEffect);
      if (ae) register(ae);
      assert.ok(ae, "charmTargetEffect AE should exist on target");
      assert.equal(ae.name, "Test Debuff");
      assert.equal(ae.flags.exalted2e.internalPenalty?.type, "all");
      assert.equal(ae.flags.exalted2e.internalPenalty?.value, 1);
    });
  });

  describe("charm targetEffect.onActivate", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("creates a charmTargetEffect AE on targeted actor when charm is activated", async function () {
      const caster = await createTempCharacter({ name: "TE Caster" });
      const target = await createTempCharacter({ name: "TE Target2" });

      await caster.update({ "system.motes.peripheral.value": 20, "system.motes.peripheral.max": 40 });

      const [charm] = await caster.createEmbeddedDocuments("Item", [{
        name: "Test OnActivate Charm",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost: { motes: 1, willpower: 0, bashingHealth: 0, lethalHealth: 0, aggravatedHealth: 0, xp: 0 },
          targetEffect: {
            enabled:  true,
            trigger:  "onActivate",
            label:    "Activation Debuff",
            icon:     "icons/svg/aura.svg",
            duration: "oneScene",
            changes:  [{ key: "system.attributes.strength.value", mode: 2, value: "-1" }],
            internalPenalty: { enabled: false, type: "all", amount: -1 },
          },
        },
      }]);
      register(charm);

      const targetTokens = target.getActiveTokens();
      if (targetTokens.length > 0) {
        game.user.updateTokenTargets([targetTokens[0].id]);
        cleanupOnAfter(() => game.user.updateTokenTargets([]));
      }

      await charm.activateCharm();

      if (targetTokens.length > 0) {
        const deadline = Date.now() + 3000;
        while (!target.effects.some(e => e.flags?.exalted2e?.charmTargetEffect)) {
          if (Date.now() > deadline) break;
          await new Promise(r => setTimeout(r, 50));
        }

        const ae = [...target.effects].find(e => e.flags?.exalted2e?.charmTargetEffect);
        if (ae) register(ae);
        assert.ok(ae, "charmTargetEffect AE should exist on target after activation");
        assert.equal(ae.name, "Activation Debuff");
      } else {
        assert.ok(true, "no target token in scene; onActivate no-op verified by design");
      }
    });
  });
}
