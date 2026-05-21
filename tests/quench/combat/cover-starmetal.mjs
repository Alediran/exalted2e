import { assertTestWorld, getTestScene }    from "../_helpers/world.mjs";
import { sweep }                             from "../_helpers/cleanup.mjs";
import { createTempCharacter }               from "../_helpers/actors.mjs";
import { placeToken }                        from "../_helpers/scenes.mjs";
import { startTempCombat, advanceToActor }   from "../_helpers/combat.mjs";
import { createTempWeapon }                  from "../_helpers/weapons.mjs";
import { stubAttackDialog }                  from "../_helpers/dialogs.mjs";

function defaultDialogResult(over = {}) {
  return {
    stunt:              0,
    advancesMotivation: false,
    rewardKind:         "motes",
    moteType:           "peripheral",
    firstExcDice:       0,
    secondExcSucc:      0,
    charmIds:           [],
    ...over
  };
}

async function stampCoverAe(actor, { dodge = 0, parry = 0, disabled = false } = {}) {
  const [ae] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name:     "Test Cover",
    img:      "icons/svg/shield.svg",
    flags:    { exalted2e: { dvBonus: { dodge, parry } } },
    disabled,
    transfer: false
  }]);
  return ae;
}

async function createStarmetalArmor(actor, { equipped = true, attuned = true } = {}) {
  const [armor] = await actor.createEmbeddedDocuments("Item", [{
    name:   "Starmetal Plate",
    type:   "armor",
    system: {
      artifact:        true,
      magicalMaterial: "starmetal",
      attunementCost:  5,
      attuned,
      equipped
    }
  }]);
  return armor;
}

async function setupAttackFixture({ attackerStats = {}, defenderStats = {} } = {}) {
  const attacker = await createTempCharacter({ name: "Q-SM-Atk", dex: 4, ...attackerStats });
  const defender = await createTempCharacter({ name: "Q-SM-Def",          ...defenderStats });
  await attacker.update({ "system.essence.value": 5 });
  await defender.update({ "system.essence.value": 5 });
  const sc = getTestScene();
  await placeToken(attacker, sc, { x: 0,   y: 0 });
  await placeToken(defender, sc, { x: 100, y: 0 });
  const weapon = await createTempWeapon(attacker, { accuracy: 2, damage: 5, range: 0 });
  const combat = await startTempCombat([attacker, defender], {
    jbStubsByActorId: { [attacker.id]: 5, [defender.id]: 0 }
  });
  await advanceToActor(combat, attacker);
  return { attacker, defender, weapon, combat };
}

export function registerCoverStarmetal(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("cover DV bonuses and starmetal attack penalty", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. dvBonus.dodge on an AE increases currentDodgeDV
    it("[243] cover AE: dvBonus.dodge adds to currentDodgeDV", async function () {
      const actor = await createTempCharacter({ name: "Q-Cover-Dodge" });
      const base  = actor.currentDodgeDV;
      await stampCoverAe(actor, { dodge: 1 });
      assert.equal(actor.currentDodgeDV, base + 1,
        "currentDodgeDV increased by dodge bonus from cover AE");
    });

    // 2. dvBonus.parry on an AE increases currentParryDV
    it("[244] cover AE: dvBonus.parry adds to currentParryDV", async function () {
      const actor = await createTempCharacter({ name: "Q-Cover-Parry" });
      const base  = actor.currentParryDV;
      await stampCoverAe(actor, { parry: 1 });
      assert.equal(actor.currentParryDV, base + 1,
        "currentParryDV increased by parry bonus from cover AE");
    });

    // 3. Multiple cover AEs stack
    it("[245] cover AEs stack: two +1 dodge AEs add 2 to currentDodgeDV", async function () {
      const actor = await createTempCharacter({ name: "Q-Cover-Stack" });
      const base  = actor.currentDodgeDV;
      await stampCoverAe(actor, { dodge: 1 });
      await stampCoverAe(actor, { dodge: 1 });
      assert.equal(actor.currentDodgeDV, base + 2,
        "two cover AEs each contributing +1 add 2 to dodge DV");
    });

    // 4. Disabled cover AE is not counted
    it("[246] disabled cover AE does not affect currentDodgeDV", async function () {
      const actor = await createTempCharacter({ name: "Q-Cover-Disabled" });
      const base  = actor.currentDodgeDV;
      await stampCoverAe(actor, { dodge: 2, disabled: true });
      assert.equal(actor.currentDodgeDV, base,
        "disabled cover AE has no effect on dodge DV");
    });

    // 5. Equipped + attuned starmetal artifact armor imposes externalPenalty=1 on attacker
    it("[247] starmetal armor: externalPenalty = 1 when defender wears equipped attuned starmetal", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await createStarmetalArmor(defender, { equipped: true, attuned: true });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.ok(message, "rollAttack returned a ChatMessage");
      const attack = message.flags?.exalted2e?.attack;
      assert.equal(attack.externalPenalty, 1,
        "externalPenalty = 1 from defender's attuned starmetal armor");
    });

    // 7. Crippled AE imposes internalPenalty on physical actions
    it("[249] crippled AE: internalPenaltyFor('physical') = 1", async function () {
      const actor = await createTempCharacter({ name: "Q-Crippled" });
      assert.equal(actor.internalPenaltyFor?.("physical") ?? 0, 0,
        "no internal penalty before AE");
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:     "Crippled",
        img:      "icons/svg/blood.svg",
        flags:    { exalted2e: { internalPenalty: { value: 1, type: "physical" }, crippled: true } },
        disabled: false,
        transfer: false
      }]);
      assert.equal(actor.internalPenaltyFor?.("physical") ?? 0, 1,
        "crippled AE adds 1 internal penalty to physical");
    });

    // 8. Height advantage AE increases both Dodge and Parry DV by 1
    it("[250] height advantage AE: +1 to both currentDodgeDV and currentParryDV", async function () {
      const actor     = await createTempCharacter({ name: "Q-Height" });
      const baseDodge = actor.currentDodgeDV;
      const baseParry = actor.currentParryDV;
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:     "Height Advantage",
        img:      "icons/svg/up.svg",
        flags:    { exalted2e: { dvBonus: { dodge: 1, parry: 1 } } },
        disabled: false,
        transfer: false
      }]);
      assert.equal(actor.currentDodgeDV, baseDodge + 1,
        "height advantage adds +1 dodge DV");
      assert.equal(actor.currentParryDV, baseParry + 1,
        "height advantage adds +1 parry DV");
    });

    // 9. Poisoned/diseased CONFIG.statusEffects entries carry Exalted detection flags
    it("[251] poisoned and diseased status entries carry exalted2e flags", async function () {
      const poisoned = CONFIG.statusEffects["poison"];
      const diseased = CONFIG.statusEffects["disease"];
      assert.ok(poisoned, "poison entry present in CONFIG.statusEffects");
      assert.ok(diseased, "disease entry present in CONFIG.statusEffects");
      assert.equal(poisoned?.flags?.exalted2e?.poisoned, true,
        "poisoned entry carries exalted2e.poisoned flag");
      assert.equal(diseased?.flags?.exalted2e?.diseased, true,
        "diseased entry carries exalted2e.diseased flag");
    });

    // 6. Non-attuned starmetal armor imposes no attack penalty
    it("[248] non-attuned starmetal armor: no attack penalty on attacker", async function () {
      const { attacker, defender, weapon } = await setupAttackFixture();
      await createStarmetalArmor(defender, { equipped: true, attuned: false });
      await stubAttackDialog([defaultDialogResult()]);
      const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
      const message = await ExaltedRoll.rollAttack(attacker, weapon.id, {
        modeIndex: 0, explicitTargetActor: defender
      });
      assert.ok(message, "rollAttack returned a ChatMessage");
      const attack = message.flags?.exalted2e?.attack;
      assert.equal(attack.externalPenalty, 0,
        "externalPenalty = 0 for non-attuned starmetal armor");
    });
  });
}
