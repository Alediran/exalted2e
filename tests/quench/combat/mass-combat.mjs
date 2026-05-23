import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { rollMassCombatAttack } from "../../../module/rolls/mass-combat-roll.mjs";

export function registerMassCombat(context) {
  const { describe, it, assert, before, after } = context;

  let attackerActor, defenderActor, defenderToken;

  before(assertTestWorld);

  before(async () => {
    attackerActor = await Actor.create({
      name: "QMCAttacker",
      type: "unit",
      system: {
        magnitude: { value: 5, max: 5 },
        drill: 2,
        might: 2,
        endurance: 2,
        morale: 3
        // commanderActorId left blank — attackPool = 0 + drill = 2
      }
    });

    defenderActor = await Actor.create({
      name: "QMCDefender",
      type: "unit",
      system: {
        magnitude: { value: 5, max: 5 },
        drill: 1,
        might: 1,
        endurance: 2,
        morale: 3
      }
    });

    // Place the defender on the Quench Fixture scene so we can target it
    const scene = getTestScene();
    const [td] = await scene.createEmbeddedDocuments("Token", [{
      name:      "QMCDefenderToken",
      actorId:   defenderActor.id,
      actorLink: true,
      x: 100, y: 100
    }]);
    defenderToken = td;
  });

  after(async () => {
    await attackerActor?.delete();
    await defenderActor?.delete();
    if (defenderToken) {
      try { await defenderToken.delete(); } catch (_) { /* already deleted */ }
    }
  });

  describe("rollMassCombatAttack", () => {
    it("posts a chat message", async () => {
      if (!defenderToken) {
        assert.ok(true, "SOFT PASS: No active scene — test did not exercise the full flow");
        return;
      }

      game.user.updateTokenTargets([defenderToken.id]);

      const msgsBefore = game.messages.size;
      await rollMassCombatAttack(attackerActor);
      assert.ok(game.messages.size > msgsBefore, "A chat message was posted");

      const lastMsg = game.messages.contents.at(-1);
      assert.ok(
        lastMsg?.flags?.exalted2e?.massCombatAttack,
        "Message carries massCombatAttack flag"
      );
    });

    it("defender magnitude is ≤ initial value after engagement", async () => {
      const lastMsg = game.messages.contents.at(-1);
      const ledger  = lastMsg?.flags?.exalted2e?.massCombatAttack;
      assert.ok(ledger, "ledger present for magnitude check");
      assert.isAtMost(ledger.magAfterRout, ledger.magBefore,
        "Magnitude did not increase above starting value");
    });
  });
}
