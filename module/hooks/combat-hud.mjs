/**
 * combat-hud.mjs – Combat HUD hook wiring.
 *
 * registerCombatTrackerHooks() — top-level renderCombatTracker handlers (×3).
 * wireCombatHud()             — HUD/ring/anima-glow hooks wired inside ready.
 */

import { EX2E }               from "../config.mjs";
import { ActionQuickbar }     from "../ui/action-quickbar.mjs";
import { TickWheel }          from "../ui/tick-wheel.mjs";
import { JoinBattlePanel }    from "../ui/join-battle-panel.mjs";
import { refreshTokenAnimaGlow } from "../ui/token-anima-glow.mjs";
import { CountermagicDialog } from "../dialogs/countermagic-dialog.mjs";
import { MassCombatActionDialog } from "../apps/mass-combat-action-dialog.mjs";
import { HeroMassCombatDialog }   from "../apps/hero-mass-combat-dialog.mjs";

// ── Combat Tracker Controls ────────────────────────────────────────────────
// Inject two Exalted-specific buttons into the combat tracker:
//   • Join Battle — GM rolls Wits+Awareness for every combatant and assigns
//     each one's starting tick.
//   • Finish Turn — opens a Speed prompt, advances the current combatant's
//     tick, and re-sorts the tracker.
export function registerCombatTrackerHooks() {
  Hooks.on("renderCombatTracker", (app, html, _data) => {
    const el = html instanceof HTMLElement ? html : (html?.[0] ?? html);
    if (!el?.querySelector) return;
    const combat = app.viewed;
    if (!combat) return;

    // Exalted 2e uses tick-based initiative, so Foundry's default
    // Previous/Next Round and Previous/Next Turn buttons don't map onto the
    // rules. Remove them on every render; "Finish Turn" replaces them.
    for (const action of ["previousRound", "previousTurn", "nextTurn", "nextRound"]) {
      el.querySelectorAll(`[data-action='${action}'], [data-control='${action}']`)
        .forEach(btn => btn.remove());
    }

    // Encounter-phase detection drives which buttons appear:
    //   • Phase 1 (not all combatants have JB yet): Roll JB buttons visible,
    //     Begin Encounter hidden. Players rolling individually via Foundry's
    //     per-combatant button keeps us in Phase 1 until everyone's rolled.
    //   • Phase 2 (everyone has JB, not started): Begin Encounter visible
    //     (Foundry default)
    //   • Phase 3 (started): Finish Turn visible
    //
    // We key phase detection off our own `joinBattleSuccesses` flag rather
    // than `initiative`, because Foundry can auto-populate initiative=0 when
    // combatants are created (auto-roll setting + null formula), which would
    // otherwise trip us into Phase 2 prematurely.
    const combatants = combat.combatants.contents ?? [...combat.combatants];
    const jbRolled = combatants.length > 0 && combatants.every(c => {
      const s = c.flags?.exalted2e?.joinBattleSuccesses;
      return typeof s === "number";
    });

    // Phase 1 — strip Foundry's Begin Encounter button until JB is rolled.
    // The JB roll buttons themselves live in the Join Battle HUD panel, so
    // this is the only thing left to do in the tracker DOM.
    if (!jbRolled) {
      el.querySelectorAll(`[data-action='startCombat'], [data-control='startCombat']`)
        .forEach(btn => btn.remove());
    }
    // Phase 2: native Begin Encounter is visible.
    // Phase 3: wheel UI + action quickbar handle all in-combat controls;
    // only Foundry's own End Encounter remains in the tracker footer.

    // ── Multi-tick action badge ────────────────────────────────────────────
    // Decorate combatant rows with the active multi-tick action's
    // progress (e.g., "Aiming (2/3)"). Cheap re-render — the tracker
    // re-renders on every combatant.update, which is exactly when the
    // badge needs to refresh.
    for (const c of combatants) {
      const action = c.flags?.exalted2e?.multiTickAction;
      if (!action) continue;
      const handler = EX2E.multiTickHandlers[action.actionKey];
      let text;
      if (typeof handler?.getBadgeText === "function") {
        text = handler.getBadgeText(action);
      } else {
        // Default: "{label} ({elapsed}/{total})" — Aim path
        const labelKey = handler?.badgeLabelKey ?? "EX2E.MultiTickActionGeneric";
        const label    = game.i18n.localize(labelKey);
        const elapsed  = action.ticksElapsed ?? 0;
        const total    = action.totalTicks   ?? 0;
        text = game.i18n.format("EX2E.MultiTickActionProgress",
                                { label, elapsed, total });
      }
      // Foundry v13's tracker rows expose `data-combatant-id`; fall back
      // to `data-id` for forward-compat with theme overrides.
      const row = el.querySelector(`[data-combatant-id="${c.id}"]`)
               ?? el.querySelector(`[data-id="${c.id}"]`);
      if (!row) continue;
      const nameEl = row.querySelector(".token-name") ?? row.querySelector(".name");
      if (!nameEl) continue;
      const badge = document.createElement("span");
      badge.classList.add("ex2e-mt-badge");
      badge.textContent = text;
      nameEl.appendChild(badge);
    }
  });


  // ── Countermagic: inject "Counter Spell" button into combat tracker rows ────
  Hooks.on("renderCombatTracker", (app, html) => {
    const el = html instanceof HTMLElement ? html : (html?.[0] ?? html);
    if (!el?.querySelector) return;
    const combat = app.viewed;
    if (!combat) return;

    const counterActor = game.canvas?.tokens?.controlled?.[0]?.actor
                      ?? game.user?.character ?? null;

    for (const combatant of combat.combatants) {
      const action = combatant.flags?.exalted2e?.multiTickAction ?? null;
      if (!action) continue;
      if (action.actionKey !== "sorcery" && action.actionKey !== "necromancy") continue;

      const state     = action.state ?? {};
      const circle    = state.circle ?? 1;
      const tradition = action.actionKey === "necromancy" ? "necromancy" : "sorcery";

      if (!game.user.isGM && counterActor) {
        const { buildEligibleCharms } = game.exalted2e?._countermagicHelpers ?? {};
        if (typeof buildEligibleCharms === "function") {
          if (!buildEligibleCharms(counterActor, circle, tradition).length) continue;
        }
      }

      const row = el.querySelector(`[data-combatant-id="${combatant.id}"]`)
               ?? el.querySelector(`[data-id="${combatant.id}"]`);
      if (!row) continue;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ex2e-counter-spell-btn";
      btn.dataset.combatantId = combatant.id;
      btn.title = game.i18n.format("EX2E.CounterSpellBtn", { spell: state.spellName ?? "" });
      btn.innerHTML = `<i class="fa-solid fa-wand-sparkles"></i>`;
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const actor = game.canvas?.tokens?.controlled?.[0]?.actor
                   ?? game.user?.character ?? null;
        if (!actor) {
          ui.notifications.warn(game.i18n.localize("EX2E.CountermagicNoActor"));
          return;
        }
        await CountermagicDialog.open({ type: "shaping", combatant }, actor);
      });
      row.appendChild(btn);
    }
  });

  // ── Mass Combat: inject unit controls into combat tracker rows ───────────────
  Hooks.on("renderCombatTracker", (app, html) => {
    const el = html instanceof HTMLElement ? html : (html?.[0] ?? html);
    if (!el?.querySelector) return;
    const combat = app.viewed;
    if (!combat) return;

    for (const combatant of combat.combatants) {
      const row = el.querySelector(`[data-combatant-id="${combatant.id}"]`)
               ?? el.querySelector(`[data-id="${combatant.id}"]`);
      if (!row) continue;

      const controlsEl = row.querySelector(".combatant-controls")
                      ?? row.querySelector(".token-controls");

      if (combatant.actor?.type === "unit") {
        if (combatant.flags?.exalted2e?.hesitating) {
          const nameEl = row.querySelector(".token-name") ?? row.querySelector(".name");
          if (nameEl) {
            const badge = document.createElement("span");
            badge.className = "ex2e-hesitating-badge";
            badge.title     = game.i18n.localize("EX2E.UnitHesitates");
            badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i>`;
            nameEl.appendChild(badge);
          }
        }

        const formation = combatant.actor.system.formation ?? "unordered";
        if (!formation) continue;
        const formKey   = formation.charAt(0).toUpperCase() + formation.slice(1);
        const formLabel = game.i18n.localize(`EX2E.Formation${formKey}`);
        if (controlsEl) {
          const formSpan = document.createElement("span");
          formSpan.className   = "ex2e-formation-label";
          formSpan.textContent = formLabel;
          controlsEl.prepend(formSpan);
        }

        const btn = document.createElement("button");
        btn.type      = "button";
        btn.className = "ex2e-declare-action-btn";
        btn.title     = game.i18n.localize("EX2E.DeclareAction");
        btn.innerHTML = `<i class="fas fa-khanda"></i>`;
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            await MassCombatActionDialog.prompt({ unitActor: combatant.actor });
          } catch (err) {
            ui.notifications.error(game.i18n.localize("EX2E.MassCombatActionError"));
            console.error("EX2E | MassCombatActionDialog failed:", err);
          }
        });
        if (controlsEl) controlsEl.appendChild(btn);

      } else if (combatant.actor) {
        const btn = document.createElement("button");
        btn.type      = "button";
        btn.className = "ex2e-hero-actions-btn";
        btn.title     = game.i18n.localize("EX2E.HeroMassCombatActions");
        btn.innerHTML = `<i class="fas fa-user-sword"></i>`;
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            await HeroMassCombatDialog.prompt({ heroActor: combatant.actor });
          } catch (err) {
            ui.notifications.error(game.i18n.localize("EX2E.HeroMassCombatActionError"));
            console.error("EX2E | HeroMassCombatDialog failed:", err);
          }
        });
        if (controlsEl) controlsEl.appendChild(btn);
      }
    }
  });
}

export function wireCombatHud() {
  // Action quickbar + tick wheel + JB panel — one instance of each per
  // client, refreshed from the same combat / combatant / active-effect
  // hooks. The JB panel is phase-1 only, the wheel and bar are phase-3.
  ActionQuickbar.instance.refresh();
  TickWheel.instance.refresh();
  JoinBattlePanel.instance.refresh();
  const hudRefresh = () => {
    ActionQuickbar.instance.refresh();
    TickWheel.instance.refresh();
    JoinBattlePanel.instance.refresh();
  };
  Hooks.on("updateCombat",      hudRefresh);
  Hooks.on("createCombat",      hudRefresh);
  Hooks.on("deleteCombat",      hudRefresh);
  Hooks.on("combatStart",       hudRefresh);
  Hooks.on("combatTurn",        hudRefresh);
  Hooks.on("createCombatant",   hudRefresh);
  Hooks.on("deleteCombatant",   hudRefresh);
  Hooks.on("updateCombatant",   hudRefresh);

  // Combat token ring — suppress Foundry's built-in active-combatant ring
  // for tokens that are not on the current tick and free to act. Uses
  // token.ring.visible (PIXI DisplayObject property on TokenRing, Foundry
  // v12+). No-op when token.ring is absent (rings not configured for this
  // world or token). Applied both on combat-state changes and on per-token
  // redraws (refreshToken fires after every Foundry ring update, so we
  // can override visibility there without conflicting with the glow cache).
  function _setCombatantRingVisible(token, combat) {
    if (!token.ring) return;
    if (!combat?.started) { token.ring.visible = true; return; }
    const combatant = combat.combatants.find(c => c.tokenId === token.id);
    if (!combatant)       { token.ring.visible = true; return; }
    // Free to act = at or behind the current tick and not yet committed.
    token.ring.visible =
      (combatant.initiative ?? Infinity) <= combat.currentTick
      && !combatant.flags?.exalted2e?.actedThisTick;
  }
  function _refreshAllCombatTokenRings() {
    if (!canvas?.ready) return;
    const combat = game.combat;
    for (const token of (canvas.tokens?.placeables ?? [])) {
      _setCombatantRingVisible(token, combat);
    }
  }
  Hooks.on("updateCombat",    _refreshAllCombatTokenRings);
  Hooks.on("updateCombatant", _refreshAllCombatTokenRings);
  Hooks.on("createCombat",    _refreshAllCombatTokenRings);
  Hooks.on("deleteCombat",    _refreshAllCombatTokenRings);
  Hooks.on("combatStart",     _refreshAllCombatTokenRings);
  // Token selection — out-of-combat the quickbar resolves its actor from
  // the controlled token first, so refresh whenever selection changes.
  Hooks.on("controlToken",      hudRefresh);
  // Reflect DV-penalty AE changes (e.g., after rolling an attack, or
  // when a flurry DV AE is stamped) so the pending indicator updates.
  Hooks.on("createActiveEffect", hudRefresh);
  Hooks.on("deleteActiveEffect", hudRefresh);
  // Weapon equip toggles during a turn should re-evaluate the attack submenu.
  Hooks.on("updateItem",        hudRefresh);
  Hooks.on("createItem",        hudRefresh);
  Hooks.on("deleteItem",        hudRefresh);

  // Anima token glow — refresh on actor data change and on token redraw.
  // refreshToken fires on every pan/zoom frame, so skip when nothing changed.
  Hooks.on("updateActor", (actor) => {
    for (const token of actor.getActiveTokens()) {
      const tier   = actor.system?.anima ?? "none";
      const colors = actor.getFlag?.("exalted2e", "animaColors") ?? [null, null, null];
      const newKey = `${tier}|${colors.join(",")}`;
      if (token._ex2eGlowCacheKey === newKey) continue;
      token._ex2eGlowCacheKey = null;
      refreshTokenAnimaGlow(token);
    }
  });
  Hooks.on("refreshToken", (token) => {
    const actor = token.actor;
    if (actor) {
      const tier     = actor.system?.anima ?? "none";
      const colors   = actor.getFlag?.("exalted2e", "animaColors") ?? [null, null, null];
      const cacheKey = `${tier}|${colors.join(",")}`;
      if (token._ex2eGlowCacheKey !== cacheKey) {
        token._ex2eGlowCacheKey = cacheKey;
        refreshTokenAnimaGlow(token);
      }
    }
    // Re-apply ring visibility after every Foundry redraw — Foundry resets
    // PIXI state on refresh so this must run unconditionally (no cache gate).
    _setCombatantRingVisible(token, game.combat);
  });
}
