import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep, register }              from "../_helpers/cleanup.mjs";
import { placeToken }                   from "../_helpers/scenes.mjs";
import { startTempCombat }              from "../_helpers/combat.mjs";

/**
 * Create a character actor suited for clinch tests.
 * High Str for meaningful Crush/Throw damage; high MA for control roll pool.
 */
async function createClinchActor(name, { str = 3, dex = 3, sta = 2, ma = 3 } = {}) {
  const actor = await Actor.create({
    name,
    type: "character",
    system: {
      attributes: {
        strength:  { value: str },
        dexterity: { value: dex },
        stamina:   { value: sta },
      },
      abilities: { martialarts: { value: ma } }
    }
  });
  register(actor);
  // Poll until the unarmed weapon seeds (hook is not awaited by Foundry).
  const deadline = Date.now() + 5000;
  while (!actor.items.some(i => i.type === "weapon" && i.getFlag("exalted2e", "unarmed"))) {
    if (Date.now() > deadline) break;
    await new Promise(r => setTimeout(r, 50));
  }
  return actor;
}

export function registerClinch(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("Clinch / Grapple mechanics", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // C-1: stampClinchState wires both combatants correctly.
    it("[C-1] stampClinchState stamps controller + held flags and pushes held initiative",
      async function () {
        this.timeout(20000);
        const atk = await createClinchActor("Clinch-Attacker");
        const def = await createClinchActor("Clinch-Defender");
        const sc  = getTestScene();
        await placeToken(atk, sc, { x: 0,   y: 0 });
        await placeToken(def, sc, { x: 100, y: 0 });
        const combat = await startTempCombat([atk, def], {
          jbStubsByActorId: { [atk.id]: 8, [def.id]: 3 }
        });

        const { stampClinchState } = await import("../../../module/rolls/clinch.mjs");
        const aCmbt = combat.combatants.find(c => c.actorId === atk.id);
        const dCmbt = combat.combatants.find(c => c.actorId === def.id);

        await stampClinchState(combat, aCmbt, dCmbt, 5);

        const aFlag = aCmbt.flags?.exalted2e?.clinch;
        const dFlag = dCmbt.flags?.exalted2e?.clinch;

        assert.equal(aFlag?.role,             "controller",  "attacker role = controller");
        assert.equal(aFlag?.heldCombatantId,   dCmbt.id,     "controller stores held id");
        assert.equal(aFlag?.controlMargin,     5,             "control margin stored");

        assert.equal(dFlag?.role,                    "held",      "defender role = held");
        assert.equal(dFlag?.controllerCombatantId,    aCmbt.id,   "held stores controller id");

        assert.isAbove(
          dCmbt.initiative ?? 0,
          aCmbt.initiative ?? 0,
          "held initiative pushed ahead of controller"
        );
      }
    );

    // C-2: Hold sub-action updates held combatant's initiative.
    it("[C-2] Hold sub-action pushes held initiative to controller + 4",
      async function () {
        this.timeout(20000);
        const atk = await createClinchActor("Clinch-Attacker-2");
        const def = await createClinchActor("Clinch-Defender-2");
        const sc  = getTestScene();
        await placeToken(atk, sc, { x: 0,   y: 0 });
        await placeToken(def, sc, { x: 100, y: 0 });
        const combat = await startTempCombat([atk, def], {
          jbStubsByActorId: { [atk.id]: 8, [def.id]: 3 }
        });

        const { stampClinchState, applyClinchSubAction } =
          await import("../../../module/rolls/clinch.mjs");
        const aCmbt = combat.combatants.find(c => c.actorId === atk.id);
        const dCmbt = combat.combatants.find(c => c.actorId === def.id);

        await stampClinchState(combat, aCmbt, dCmbt, 3);
        const ctrlInit = aCmbt.initiative ?? 0;
        await applyClinchSubAction(combat, aCmbt, "hold");

        // Hold uses clinchFreezeInitiative(controllerInitiative, 4) → ctrlInit + 4.
        assert.equal(
          dCmbt.initiative,
          ctrlInit + 4,
          `held initiative should be controller(${ctrlInit}) + 4`
        );
      }
    );

    // C-3: Throw sub-action ends clinch and applies prone.
    it("[C-3] Throw clears clinch flags and applies prone to held combatant",
      async function () {
        this.timeout(20000);
        const atk = await createClinchActor("Clinch-Attacker-3", { str: 3 });
        const def = await createClinchActor("Clinch-Defender-3");
        const sc  = getTestScene();
        await placeToken(atk, sc, { x: 0,   y: 0 });
        await placeToken(def, sc, { x: 100, y: 0 });
        const combat = await startTempCombat([atk, def], {
          jbStubsByActorId: { [atk.id]: 8, [def.id]: 3 }
        });

        const { stampClinchState, applyClinchSubAction } =
          await import("../../../module/rolls/clinch.mjs");
        const aCmbt = combat.combatants.find(c => c.actorId === atk.id);
        const dCmbt = combat.combatants.find(c => c.actorId === def.id);

        await stampClinchState(combat, aCmbt, dCmbt, 3);
        await applyClinchSubAction(combat, aCmbt, "throw");

        // Both clinch flags must be cleared.
        assert.notOk(aCmbt.flags?.exalted2e?.clinch, "controller clinch flag cleared after throw");
        assert.notOk(dCmbt.flags?.exalted2e?.clinch, "held clinch flag cleared after throw");

        // Held combatant receives the "prone" status effect.
        const isProne = def.statuses?.has("prone")
          || def.effects.some(e => [...(e.statuses ?? [])].includes("prone"))
          || def.effects.some(e => e.flags?.core?.statusId === "prone");
        assert.ok(isProne, "defender should have prone status after throw");
      }
    );

    // C-4: Release clears flags without damage or prone.
    it("[C-4] Release clears clinch flags cleanly without applying prone",
      async function () {
        this.timeout(20000);
        const atk = await createClinchActor("Clinch-Attacker-4");
        const def = await createClinchActor("Clinch-Defender-4");
        const sc  = getTestScene();
        await placeToken(atk, sc, { x: 0,   y: 0 });
        await placeToken(def, sc, { x: 100, y: 0 });
        const combat = await startTempCombat([atk, def], {
          jbStubsByActorId: { [atk.id]: 8, [def.id]: 3 }
        });

        const { stampClinchState, releaseClinch } =
          await import("../../../module/rolls/clinch.mjs");
        const aCmbt = combat.combatants.find(c => c.actorId === atk.id);
        const dCmbt = combat.combatants.find(c => c.actorId === def.id);

        await stampClinchState(combat, aCmbt, dCmbt, 2);
        await releaseClinch(aCmbt, dCmbt);

        assert.notOk(aCmbt.flags?.exalted2e?.clinch, "controller flag cleared");
        assert.notOk(dCmbt.flags?.exalted2e?.clinch, "held flag cleared");

        const isProne = def.statuses?.has("prone")
          || def.effects.some(e => [...(e.statuses ?? [])].includes("prone"));
        assert.notOk(isProne, "no prone on voluntary release");
      }
    );

    // C-5: Clinch flags cleared when combat ends.
    it("[C-5] clinch flags on a combatant are cleared when combat ends",
      async function () {
        this.timeout(20000);
        const atk = await createClinchActor("Clinch-Attacker-5");
        const def = await createClinchActor("Clinch-Defender-5");
        const sc  = getTestScene();
        await placeToken(atk, sc, { x: 0,   y: 0 });
        await placeToken(def, sc, { x: 100, y: 0 });
        const combat = await startTempCombat([atk, def], {
          jbStubsByActorId: { [atk.id]: 8, [def.id]: 3 }
        });

        const { stampClinchState } = await import("../../../module/rolls/clinch.mjs");
        const aCmbt = combat.combatants.find(c => c.actorId === atk.id);
        const dCmbt = combat.combatants.find(c => c.actorId === def.id);
        await stampClinchState(combat, aCmbt, dCmbt, 2);

        // Delete combat — the deleteCombat hook should call releaseClinch without throwing.
        await combat.delete();

        // No lingering clinch AE on either actor.
        assert.notOk(
          atk.effects.some(e => e.flags?.exalted2e?.clinch),
          "no clinch AE lingering on attacker after combat deleted"
        );
      }
    );
  });
}
