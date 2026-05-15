import { assertTestWorld }       from "../_helpers/world.mjs";
import { sweep, register } from "../_helpers/cleanup.mjs";
import { createTempCharacter }   from "../_helpers/actors.mjs";

export function registerCharmTargetEffect(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("charm targetEffect.onHit", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[261] creates a charmTargetEffect AE on the target when attackSuccess fires", async function () {
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

    it("[262] creates a charmTargetEffect AE on targeted actor when charm is activated", async function () {
      const caster = await createTempCharacter({ name: "TE Caster" });
      const target = await createTempCharacter({ name: "TE Target2" });

      await caster.update({ "system.motes.peripheral.value": 20, "system.motes.peripheral.max": 40 });

      const [charm] = await caster.createEmbeddedDocuments("Item", [{
        name: "Test OnActivate Charm",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost: { formula: "1m" },
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

      await charm.activateCharm({ explicitTargetActor: target });

      const deadline = Date.now() + 3000;
      while (!target.effects.some(e => e.flags?.exalted2e?.charmTargetEffect)) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      const ae = [...target.effects].find(e => e.flags?.exalted2e?.charmTargetEffect);
      if (ae) register(ae);
      assert.ok(ae, "charmTargetEffect AE should exist on target after activation");
      assert.equal(ae.name, "Activation Debuff");
    });
  });

  describe("charm targetPenalty.enabled (Simple charm, activation path)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[263] creates internalPenalty AE on target when Simple charm activates", async function () {
      const caster = await createTempCharacter({ name: "M11 Caster" });
      const target = await createTempCharacter({ name: "M11 Target" });
      register(caster);
      register(target);

      const [charm] = await caster.createEmbeddedDocuments("Item", [{
        name: "Test Simple Penalty",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "oneScene",
          cost:      { formula: "—" },
          targetPenalty: {
            enabled:       true,
            amount:        -2,
            amountFormula: "",
            scope:         "physicalAttributes",
            duration:      "oneScene",
          },
        },
      }]);
      register(charm);

      await charm.activateCharm({ skipChatCard: true, explicitTargetActor: target });

      // Wait for async AE creation to propagate
      const deadline = Date.now() + 3000;
      while (!target.effects.some(e => e.flags?.exalted2e?.internalPenalty)) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      const ae = [...target.effects].find(e => e.flags?.exalted2e?.internalPenalty);
      if (ae) register(ae);
      assert.ok(ae, "internalPenalty AE should exist on target");
      assert.equal(ae.flags.exalted2e.internalPenalty.type, "physical");
      assert.equal(ae.flags.exalted2e.internalPenalty.value, 2);
      assert.equal(ae.name, "Test Simple Penalty");
    });
  });

  describe("charm healingRoll.enabled (activation path)", function () {
    before(assertTestWorld);
    afterEach(sweep);

    it("[264] heals bashing damage when healingRoll charm activates with target=self", async function () {
      const healer = await createTempCharacter({ name: "M6 Healer" });
      register(healer);

      // Deal 3 bashing damage
      await healer.applyDamage(3, "bashing");
      const bashingBefore = healer.system.health.bashing;
      assert.ok(bashingBefore >= 3, `healer should have at least 3 bashing before healing, got ${bashingBefore}`);

      const [charm] = await healer.createEmbeddedDocuments("Item", [{
        name: "Wound-Mending Test",
        type: "charm",
        system: {
          charmType: "simple",
          duration:  "instant",
          cost:      { formula: "—" },
          healingRoll: {
            enabled:    true,
            pool:       "20",
            bonus:      "",
            damageType: "bashing",
            target:     "self",
          },
        },
      }]);
      register(charm);

      await charm.activateCharm({ skipChatCard: true });

      // Wait for async healDamage to propagate
      const deadline = Date.now() + 3000;
      while (healer.system.health.bashing >= bashingBefore) {
        if (Date.now() > deadline) break;
        await new Promise(r => setTimeout(r, 50));
      }

      assert.ok(
        healer.system.health.bashing < bashingBefore,
        `bashing should decrease after healing: was ${bashingBefore}, now ${healer.system.health.bashing}`
      );
    });
  });
}
