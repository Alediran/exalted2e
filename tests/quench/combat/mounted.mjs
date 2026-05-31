import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { sweep, register }              from "../_helpers/cleanup.mjs";
import { placeToken }                   from "../_helpers/scenes.mjs";
import { startTempCombat }              from "../_helpers/combat.mjs";

/**
 * Create a character actor with explicit attribute and ability values.
 * Useful for Ride-cap tests where we need known DV inputs.
 */
async function createMountedActor(name, {
  dex = 4, dodge = 4, melee = 4, ride = 2
} = {}) {
  const actor = await Actor.create({
    name,
    type: "character",
    system: {
      attributes: {
        dexterity:  { value: dex },
        strength:   { value: 2 },
        stamina:    { value: 2 },
        charisma:   { value: 2 },
        manipulation: { value: 2 },
        appearance: { value: 2 },
        perception: { value: 2 },
        intelligence: { value: 2 },
        wits:       { value: 2 }
      },
      abilities: {
        dodge:  { value: dodge },
        melee:  { value: melee },
        ride:   { value: ride },
      }
    }
  });
  register(actor);
  // Poll for unarmed weapon seed.
  const deadline = Date.now() + 2000;
  while (!actor.items.some(i => i.type === "weapon" && i.getFlag("exalted2e", "unarmed"))) {
    if (Date.now() > deadline) break;
    await new Promise(r => setTimeout(r, 50));
  }
  return actor;
}

/**
 * Stamp the mountedOn flag on an actor's combatant in the given combat.
 */
async function mountActor(combat, actor, vehicleActorId = "fake-vehicle-id") {
  const combatant = combat.combatants.find(c => c.actorId === actor.id);
  if (!combatant) throw new Error(`mountActor: actor ${actor.name} has no combatant`);
  await combatant.setFlag("exalted2e", "mountedOn", { vehicleActorId });
  return combatant;
}

/**
 * Clear the mountedOn flag from an actor's combatant.
 */
async function dismountActor(combat, actor) {
  const combatant = combat.combatants.find(c => c.actorId === actor.id);
  if (!combatant) return;
  await combatant.unsetFlag("exalted2e", "mountedOn");
}

export function registerMounted(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("Mounted combat — Ride cap on DVs", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // M-1: Dodge DV is capped at Ride when mounted
    it("[M-1] currentDodgeDV is capped by Ride when mountedOn flag is set", async function () {
      // Dex 4, Dodge 4 → dodgeDV = floor((4+4)/2) = 4 normally.
      // Ride 2 cap → floor((4 + min(4,2)) / 2) = floor(6/2) = 3.
      const actor = await createMountedActor("Mounted-DV-1", { dex: 4, dodge: 4, ride: 2 });
      const sc    = getTestScene();
      await placeToken(actor, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([actor]);

      const dvBeforeMount = actor.currentDodgeDV;

      await mountActor(combat, actor);
      const dvMounted = actor.currentDodgeDV;

      assert.isAbove(dvBeforeMount, dvMounted,
        "mounting should reduce Dodge DV when Ride < Dodge");
      assert.equal(dvMounted, 3,
        "Dex 4 + min(Dodge 4, Ride 2) = 6, floor(6/2) = 3");
    });

    // M-2: Dodge DV returns to normal after dismounting
    it("[M-2] currentDodgeDV returns to normal after dismounting", async function () {
      const actor = await createMountedActor("Mounted-DV-2", { dex: 4, dodge: 4, ride: 2 });
      const sc    = getTestScene();
      await placeToken(actor, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([actor]);

      const dvNormal = actor.currentDodgeDV;

      await mountActor(combat, actor);
      assert.notEqual(actor.currentDodgeDV, dvNormal, "DV changes when mounted");

      await dismountActor(combat, actor);
      assert.equal(actor.currentDodgeDV, dvNormal, "DV restored after dismounting");
    });

    // M-3: When Ride >= Dodge the cap is a no-op
    it("[M-3] Ride cap is a no-op when Ride >= Dodge", async function () {
      // Dex 4, Dodge 2, Ride 4 — Ride is higher than Dodge, so cap does not reduce DV.
      const actor = await createMountedActor("Mounted-DV-3", { dex: 4, dodge: 2, ride: 4 });
      const sc    = getTestScene();
      await placeToken(actor, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([actor]);

      const dvNormal = actor.currentDodgeDV;
      await mountActor(combat, actor);
      assert.equal(actor.currentDodgeDV, dvNormal,
        "DV unchanged when Ride >= Dodge");
    });

    // M-4: Dodge DV is not capped outside of combat (no combatant)
    it("[M-4] currentDodgeDV is not capped when actor has no active combat", async function () {
      // No combat started — game.combat should be null.
      const actor  = await createMountedActor("Mounted-DV-4", { dex: 4, dodge: 4, ride: 2 });
      const dvFull = actor.currentDodgeDV;
      // With Dex 4, Dodge 4 → dodgeDV = 4.  Ride 2 cap = 3.
      // Without a combat (no combatant to check), cap must not fire.
      assert.equal(dvFull, 4,
        "Dodge DV is full when not in combat (no mountedOn combatant exists)");
    });

    // M-5: currentParryDV is capped by Ride when mounted
    it("[M-5] currentParryDV is capped by Ride when mountedOn flag is set", async function () {
      // Dex 4, Melee 4, Ride 2, no specialties, weapon defense from unarmed clinch mode (0).
      // Parry DV formula: (Dex + min(Melee + spec, Ride) + weaponDef) / 2
      //   Uncapped: (4 + 4 + 0) / 2 = 4
      //   Capped:   (4 + min(4+0, 2) + 0) / 2 = (4+2)/2 = 3
      const actor = await createMountedActor("Mounted-ParryDV", { dex: 4, melee: 4, ride: 2 });
      const sc    = getTestScene();
      await placeToken(actor, sc, { x: 0, y: 0 });
      const combat = await startTempCombat([actor]);

      const dvNormal  = actor.currentParryDV;
      await mountActor(combat, actor);
      const dvMounted = actor.currentParryDV;

      assert.isAtMost(dvMounted, dvNormal,
        "Parry DV should not exceed uncapped value when mounted");
      // The cap fires when Ride < Melee, so mounted DV must be strictly lower.
      assert.isBelow(dvMounted, dvNormal,
        "Parry DV should be lower when Ride < Melee");
    });
  });
}
