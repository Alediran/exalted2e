import { register, sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld, getTestScene } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { placeToken } from "../_helpers/scenes.mjs";
import { startTempCombat, advanceWheel } from "../_helpers/combat.mjs";

/**
 * Poll until predicate truthy or timeoutMs elapses. Returns the predicate's
 * value (so callers can capture matched DOM nodes). Throws on timeout.
 */
async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerCombatHudSmoke(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("combat HUD — smoke (real DOM)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[115] renders the current tick in the tick-wheel HUD after wheel advance", async () => {
      const a = await createTempCharacter({ name: "Q-Hud-A" });
      const b = await createTempCharacter({ name: "Q-Hud-B" });
      await placeToken(a, getTestScene());
      await placeToken(b, getTestScene());
      const combat = await startTempCombat([a, b], { rollJoinBattle: true });

      // Wheel root must exist and be visible after combat is started + JB rolled
      const wheelEl = document.querySelector("#ex2e-tick-wheel");
      assert.ok(wheelEl, "#ex2e-tick-wheel exists in the DOM");
      await waitFor(() => !wheelEl.classList.contains("hidden"));

      await advanceWheel(combat);

      const expectedWheelTick = ((combat.currentTick % 7) + 7) % 7;
      // The tick is rendered either as `.tw-tick` (collapsed) or in the
      // `.tw-footer` text (expanded). Whichever mode the panel is in, ONE of
      // these must contain the new wheelTick.
      await waitFor(() => {
        const collapsedText = wheelEl.querySelector(".tw-tick")?.textContent ?? "";
        const footerText    = wheelEl.querySelector(".tw-footer")?.textContent ?? "";
        return collapsedText.includes(String(expectedWheelTick))
            || footerText.includes(String(expectedWheelTick));
      });

      const collapsedText = wheelEl.querySelector(".tw-tick")?.textContent ?? "";
      const footerText    = wheelEl.querySelector(".tw-footer")?.textContent ?? "";
      const matched = collapsedText.includes(String(expectedWheelTick))
                   || footerText.includes(String(expectedWheelTick));
      assert.ok(matched,
        `tick-wheel DOM contains wheelTick ${expectedWheelTick} (collapsed='${collapsedText}', footer='${footerText}')`);
    });

    it("[116] transitions from Roll section to Begin section once joinBattleSuccesses lands", async () => {
      const a = await createTempCharacter({ name: "Q-JB-A" });
      const b = await createTempCharacter({ name: "Q-JB-B" });
      await placeToken(a, getTestScene());
      await placeToken(b, getTestScene());

      // Custom Combat creation — startTempCombat unconditionally calls
      // startCombat (per recon), but the JB panel's Roll section requires
      // !combat.started, so we skip the helper and create the combat directly.
      const combat = await Combat.create({ scene: getTestScene().id });
      register(combat);
      await combat.createEmbeddedDocuments("Combatant", [
        { actorId: a.id, tokenId: a.getActiveTokens()[0]?.id ?? null },
        { actorId: b.id, tokenId: b.getActiveTokens()[0]?.id ?? null }
      ]);
      // DO NOT call combat.startCombat() — leave it as !started so the JB
      // panel renders the Roll section.

      const panel = document.querySelector("#ex2e-jb-panel");
      assert.ok(panel, "#ex2e-jb-panel exists in the DOM");
      await waitFor(() => !panel.classList.contains("hidden"));

      // Roll section: GM user → expect .jb-roll-all button (Test world is GM)
      await waitFor(() => panel.querySelector(".jb-roll-all"));
      assert.ok(panel.querySelector(".jb-roll-all"),
        "Roll section renders Roll All button (GM-only)");
      assert.equal(panel.querySelector(".jb-begin"), null,
        "Begin button NOT yet rendered");

      // Stamp joinBattleSuccesses on every combatant. Refresh the panel to
      // pick up the new state (combat hooks may not fire on flag-only changes).
      for (const c of combat.combatants) {
        await c.setFlag("exalted2e", "joinBattleSuccesses", 5);
      }

      await waitFor(() => panel.querySelector(".jb-begin"));
      assert.ok(panel.querySelector(".jb-begin"),
        "Begin section rendered after all combatants have joinBattleSuccesses");
      assert.equal(panel.querySelector(".jb-roll-all"), null,
        "Roll All button removed after transition");
    });
  });
}
