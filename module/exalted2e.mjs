/**
 * exalted2e.mjs – Main entry point for the Exalted 2nd Edition Foundry VTT system.
 */

// ── Imports ────────────────────────────────────────────────────────────────
import { EX2E }             from "./config.mjs";
import { registerHandlebars } from "./setup/register-handlebars.mjs";
import { registerSettings, _applyUiTheme } from "./setup/register-settings.mjs";
import { registerDocuments } from "./setup/register-documents.mjs";
import { registerSheets } from "./setup/register-sheets.mjs";
import { aimHandler }     from "./combat/multi-tick-aim.mjs";
import { sorceryHandler, interruptShaping } from "./combat/multi-tick-sorcery.mjs";
import { _seedAnimaPowersCompendium } from "./helpers/anima-power-seeds.mjs";
import { registerItemLifecycleHooks } from "./hooks/item-lifecycle.mjs";
import {
  registerActorLifecycleHooks,
  _limitBreakPending,
  _patternBitePending,
  _resonanceEruptionPending,
} from "./hooks/actor-lifecycle.mjs";
import { registerChatCardHooks, wireAttackSuccess } from "./hooks/chat-cards.mjs";
import { runMigrations } from "./migration/runner.mjs";
import { _seedEffectsCompendium, _seedTheCircleFolder } from "./setup/seeders.mjs";
import { registerUiButtonHooks } from "./hooks/ui-buttons.mjs";
import { registerRegionHooks } from "./hooks/regions.mjs";
import { registerCombatFlowHooks } from "./hooks/combat-flow.mjs";
import { registerCombatTrackerHooks, wireCombatHud } from "./hooks/combat-hud.mjs";

// ── Init Hook ──────────────────────────────────────────────────────────────
Hooks.once("init", function () {
  console.log("Exalted 2e | Initialising system...");

  // ── Document classes, data models, CONFIG ──────────────────────────────
  registerDocuments();

  // ── Sheet Registration ──────────────────────────────────────────────────
  registerSheets();

  // ── System Settings ─────────────────────────────────────────────────────
  registerSettings();

  // ── Multi-tick action handlers ─────────────────────────────────────────
  // Single-slot per combatant; handlers register here so the wheel-tick
  // loop and commit dispatcher can fire onTick / onComplete /
  // onCommitOther / onAbort by actionKey.
  EX2E.multiTickHandlers.aim     = aimHandler;
  EX2E.multiTickHandlers.sorcery = sorceryHandler;

  // ── Handlebars Helpers + Template Pre-load ─────────────────────────────
  registerHandlebars();

  console.log("Exalted 2e | System initialised.");
});

registerActorLifecycleHooks();
registerItemLifecycleHooks();

// ── Ready Hook ─────────────────────────────────────────────────────────────
Hooks.once("ready", async function () {
  console.log("Exalted 2e | System ready.");
  _applyUiTheme(game.settings.get("exalted2e", "uiTheme"));

  wireCombatHud();

  wireAttackSuccess();

  // ── Socket: GM proxy for countermagic operations on foreign documents ───
  game.socket.on("system.exalted2e", async (payload) => {
    if (!game.user.isGM) return;
    if (payload.targetGmId && game.user.id !== payload.targetGmId) return;

    if (payload?.action === "dispelSpellEffect") {
      const { actorId, effectId } = payload;
      const actor = game.actors.get(actorId);
      if (!actor) return;
      const ae = actor.effects.get(effectId);
      if (ae) await ae.delete();
      return;
    }

    if (payload?.action === "interruptShaping") {
      const { combatantId, interrupterName } = payload;
      const combatant = game.combats?.contents
        .flatMap(c => c.combatants?.contents ?? [])
        .find(c => c.id === combatantId);
      if (combatant) await interruptShaping(combatant, interrupterName);
      return;
    }
  });

  // GM-only from here (compendium seeding + migration both write world data).
  if (!game.user.isGM) return;

  await _seedEffectsCompendium();
  await _seedAnimaPowersCompendium();
  await _seedTheCircleFolder();

  game.exalted2e._countermagicHelpers = await import("./helpers/countermagic-helpers.mjs");

  // Run the versioned migration pipeline LAST: its backup-confirm dialog
  // blocks until answered, so it must never sit upstream of the seeding
  // above (an unanswered dialog would otherwise stall the rest of ready).
  await runMigrations();
});

registerUiButtonHooks();

// ── Quench (in-Foundry test harness) ──────────────────────────────────────
// Tests ship with the system bundle but only register when the Quench
// module is installed and active. Production users pay zero cost — the
// import never runs without Quench.
//
// IMPORTANT: this must run at `init`, not `ready`. Quench fires its
// `quenchReady` hook from inside its own `ready` handler; if we import
// the test entry point during our `ready` handler, our `Hooks.once`
// subscriber may register AFTER `quenchReady` has already fired, in
// which case the subscriber never runs and the panel shows no batches.
// Subscribing at `init` puts the once-listener in place before any
// `ready` handler runs.
Hooks.once("init", async function () {
  if (game.modules.get("quench")?.active) {
    try {
      await import("../tests/quench/index.mjs");
    } catch (err) {
      console.error("Exalted 2e | Quench test harness failed to load", err);
    }
  }
});

// Re-export pending guards so tests importing from this entry continue to work.
export { _limitBreakPending, _patternBitePending, _resonanceEruptionPending } from "./hooks/actor-lifecycle.mjs";


registerRegionHooks();
registerCombatFlowHooks();

registerCombatTrackerHooks();

// Re-export resolution handlers (defined in chat-cards.mjs) so tests importing
// them from this entry keep working, without a circular import.
export { _resolveLimitBreak, _resolveActOfVillainy } from "./hooks/chat-cards.mjs";

// ── Chat-card hooks (moved to module/hooks/chat-cards.mjs) ────────────────
registerChatCardHooks();


