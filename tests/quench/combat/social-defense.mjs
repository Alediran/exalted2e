import { assertTestWorld }                from "../_helpers/world.mjs";
import { sweep, register }                from "../_helpers/cleanup.mjs";
import { createTempCharacter }            from "../_helpers/actors.mjs";
import { createTempCharm }                from "../_helpers/charms.mjs";
import { stubStep2SocialDefense }         from "../_helpers/dialogs.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

function findCardButton(messageId, selector) {
  const root = document.querySelector(`[data-message-id="${messageId}"]`);
  return root?.querySelector?.(selector) ?? null;
}

/** Attacker + defender, both essence=5, defender has full WP. */
async function setupSocialFixture() {
  const attacker = await createTempCharacter({ name: "Smooth", cha: 4, app: 2 });
  const defender = await createTempCharacter({ name: "Mark",  wit: 2 });
  await attacker.update({
    "system.essence.value": 5,
    "system.abilities.presence.value": 3,
    "system.motes.peripheral.value": 30,
    "system.motes.peripheral.max":   30
  });
  await defender.update({
    "system.essence.value":           5,
    "system.willpower.value":          5,
    "system.willpower.max":            5,
    "system.motes.peripheral.value":  30,
    "system.motes.peripheral.max":    30,
    "system.abilities.integrity.value": 3
  });
  return { attacker, defender };
}

/** Run a social attack and return the chat card. */
async function postSocialAttack(attacker, defender, opts = {}) {
  const { ExaltedRoll } = await import("../../../module/rolls/exalted-roll.mjs");
  const message = await ExaltedRoll.rollSocialAttack(attacker, {
    defender, attribute: "charisma", ability: "presence",
    intent: "build", claims: {}, ...opts
  });
  if (message) register(message);
  return message;
}

export function registerSocialDefense(context) {
  const { describe, it, before, afterEach, assert } = context;

  describe("social Step-2 defense + UMI + scene cleanup", function () {
    before(assertTestWorld);
    afterEach(sweep);

    // 1. Click .btn-social-step2 with a cancelled dialog → step2Resolved stays false.
    it("Step-2 defense cancelled: step2Resolved stays false", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const card = await postSocialAttack(attacker, defender);
      await stubStep2SocialDefense([null]);  // user cancelled

      await waitFor(() => !!findCardButton(card.id, ".btn-social-step2"));
      findCardButton(card.id, ".btn-social-step2").click();

      // Give the cancelled handler a beat to run; nothing should change.
      await new Promise(r => setTimeout(r, 100));
      const reloaded = game.messages.get(card.id);
      assert.equal(reloaded.flags.exalted2e.socialAttack.step2Resolved, false,
        "step2Resolved still false after cancel");
    });

    // 2. Step-2 defense with empty charmIds → step2Resolved=true, no charm spend.
    it("Step-2 defense with no charms: step2Resolved=true and step2Result captured", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const card = await postSocialAttack(attacker, defender);
      const motesBefore = defender.system.motes.peripheral.value;
      await stubStep2SocialDefense([{
        charmIds: [], firstExcDice: 0, secondExcSucc: 0, moteType: "peripheral"
      }]);

      await waitFor(() => !!findCardButton(card.id, ".btn-social-step2"));
      findCardButton(card.id, ".btn-social-step2").click();

      await waitFor(() =>
        game.messages.get(card.id)?.flags?.exalted2e?.socialAttack?.step2Resolved === true
      );
      const reloaded = game.messages.get(card.id);
      assert.equal(reloaded.flags.exalted2e.socialAttack.step2Resolved, true);
      assert.equal(defender.system.motes.peripheral.value, motesBefore,
        "no defender motes spent (no charms, no excellency)");
    });

    // 3. Step-2 defense with a reflexive defense charm → charm activated, motes drained on defender.
    it("Step-2 defense with a reflexive Integrity charm: charm activates and spends defender motes", async function () {
      const { attacker, defender } = await setupSocialFixture();
      // Reflexive Step-2 charm keyed on integrity (one of the social-defense
      // abilities recognized by the Step-2 candidate filter).
      const defenseCharm = await createTempCharm(defender, {
        name:      "Integrity-Protecting Prana",
        charmType: "reflexive",
        ability:   "integrity",
        steps:     [2],
        cost:      { motes: 5 },
        duration:  "instant"
      });
      const card = await postSocialAttack(attacker, defender);
      const motesBefore = defender.system.motes.peripheral.value;
      await stubStep2SocialDefense([{
        charmIds: [defenseCharm.id],
        firstExcDice: 0, secondExcSucc: 0, moteType: "peripheral"
      }]);

      await waitFor(() => !!findCardButton(card.id, ".btn-social-step2"));
      findCardButton(card.id, ".btn-social-step2").click();
      await waitFor(() =>
        game.messages.get(card.id)?.flags?.exalted2e?.socialAttack?.step2Resolved === true
      );

      assert.equal(defender.system.motes.peripheral.value, motesBefore - 5,
        "defender peripheral drained by 5 (charm cost)");
      const reloaded = game.messages.get(card.id);
      assert.deepEqual(reloaded.flags.exalted2e.socialAttack.defenderCharmIds,
        [defenseCharm.id], "defenderCharmIds records the activated charm");
    });

    // 4. Step-2 excellency dice → defender motes spent on excellency.
    it("Step-2 excellency: defender motes spent on firstExcDice", async function () {
      const { attacker, defender } = await setupSocialFixture();
      // Provide a first-excellency charm on integrity so the dialog logic
      // accepts excellency dice. Production reads exc availability via
      // the integrity-keyed first/second excellency lookup.
      await createTempCharm(defender, {
        name:       "First Excellency (Integrity)",
        excellency: "first",
        ability:    "integrity",
        duration:   "instant"
      });
      const card = await postSocialAttack(attacker, defender);
      const motesBefore = defender.system.motes.peripheral.value;
      await stubStep2SocialDefense([{
        charmIds: [], firstExcDice: 3, secondExcSucc: 0, moteType: "peripheral"
      }]);

      await waitFor(() => !!findCardButton(card.id, ".btn-social-step2"));
      findCardButton(card.id, ".btn-social-step2").click();
      await waitFor(() =>
        game.messages.get(card.id)?.flags?.exalted2e?.socialAttack?.step2Resolved === true
      );

      // 3 dice * 1m = 3m drained from defender's pool.
      assert.equal(defender.system.motes.peripheral.value, motesBefore - 3,
        "defender peripheral drained by 3 (firstExc cost)");
    });

    // 5. UMI marking: attacker's UMI charm sets unnaturalInfluence=true and umiCostSum > 0.
    it("UMI charm activated by attacker: ledger.unnaturalInfluence=true and umiCostSum>0", async function () {
      const { attacker, defender } = await setupSocialFixture();
      const umiCharm = await createTempCharm(attacker, {
        name:      "Husband-Seducing Demon Dance",
        keywords:  ["Unnatural Mental Influence"],
        ability:   "presence",
        duration:  "instant"
      });
      // Production aggregates `umiCost` per UMI charm.
      // CharmData defaults umiCost to 1; that's enough to verify > 0.
      const card = await postSocialAttack(attacker, defender, {
        charmIds: [umiCharm.id]
      });
      const ledger = card.flags.exalted2e.socialAttack;
      assert.equal(ledger.unnaturalInfluence, true,
        "UMI charm activated → unnaturalInfluence flag set");
      assert.ok(ledger.umiCostSum > 0,
        "umiCostSum aggregated from the UMI charm");
      assert.deepEqual(ledger.attackerCharmIds, [umiCharm.id]);
    });

    // 6. clearSocialScene wipes per-attacker socialScene flags from every actor.
    it("clearSocialScene wipes per-actor flags.exalted2e.socialScene", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await defender.update({
        [`flags.exalted2e.socialScene.${attacker.id}.wpDrainedNatural`]: 2,
        [`flags.exalted2e.socialScene.${attacker.id}.unnaturalLimitGranted`]: true
      });
      assert.ok(defender.flags?.exalted2e?.socialScene?.[attacker.id],
        "pre-condition: defender has socialScene flag");

      const { clearSocialScene } = await import("../../../module/ui/social-scene.mjs");
      await clearSocialScene({ silent: true });

      assert.notOk(defender.flags?.exalted2e?.socialScene,
        "socialScene flag wiped by clearSocialScene");
    });

    // 7. clearSocialScene is idempotent (running twice doesn't error and leaves clean state).
    it("clearSocialScene is idempotent on a clean scene", async function () {
      const { attacker, defender } = await setupSocialFixture();
      await defender.update({
        [`flags.exalted2e.socialScene.${attacker.id}.wpDrainedNatural`]: 1
      });
      const { clearSocialScene } = await import("../../../module/ui/social-scene.mjs");
      await clearSocialScene({ silent: true });
      // Second call — no flag to wipe; should not throw.
      await clearSocialScene({ silent: true });
      assert.notOk(defender.flags?.exalted2e?.socialScene,
        "socialScene still absent after second clear");
    });
  });
}
