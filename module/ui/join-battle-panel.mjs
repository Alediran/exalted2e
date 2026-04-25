import { ensureCombatHUDLeftColumn } from "./action-quickbar.mjs";
import { ex2eCan } from "../helpers/permissions.mjs";

/**
 * JoinBattlePanel — phase-1 HUD that surfaces Join Battle controls right
 * above the tick wheel so the GM (and players) don't have to visit the
 * combat tracker tab just to kick off initiative.
 *
 * Shown only when a combat exists, isn't started yet, and at least one
 * combatant still needs a JB roll. Renders:
 *   • Roll Join Battle          (current user's unrolled combatants)
 *   • Roll All / Roll NPCs      (GM only)
 *
 * Always renders the End Scene button to any user with combatFlow
 * permission, regardless of combat state.
 */
export class JoinBattlePanel {
  static _instance = null;

  static get instance() {
    if (!this._instance) this._instance = new JoinBattlePanel();
    return this._instance;
  }

  constructor() {
    this._root = null;
    this._build();
  }

  _build() {
    const col = ensureCombatHUDLeftColumn();
    const root = document.createElement("div");
    root.id = "ex2e-jb-panel";
    root.classList.add("ex2e-jb-panel", "hidden");
    // Stack above the wheel.
    col.insertBefore(root, col.firstChild);
    this._root = root;
  }

  refresh() {
    const combat = game.combat;
    const canDriveCombat = ex2eCan("combatFlow");

    // Determine which (if any) JB-phase section to render above End Scene.
    let topSection = null;  // "rolls" | "begin" | null

    if (combat && !combat.started) {
      const combatants = combat.combatants.contents ?? [...combat.combatants];
      if (combatants.length > 0) {
        const unrolled = combatants.filter(c =>
          typeof c.flags?.exalted2e?.joinBattleSuccesses !== "number"
        );
        if (unrolled.length === 0) {
          if (canDriveCombat) topSection = "begin";
        } else {
          const myUnrolled = unrolled.filter(c =>
            !!c.actor?.testUserPermission(game.user, "OWNER")
          );
          if (canDriveCombat || myUnrolled.length > 0) topSection = "rolls";
        }
      }
    }

    // End Scene visibility — always shown to combat-flow-capable users.
    const showEndScene = canDriveCombat;

    if (!topSection && !showEndScene) {
      this._hide();
      return;
    }

    this._render({ combat, canDriveCombat, topSection, showEndScene });
    this._show();
  }

  _render({ combat, canDriveCombat, topSection, showEndScene }) {
    const parts = [];

    if (topSection === "rolls") {
      parts.push(`<div class="jb-title">${game.i18n.localize("EX2E.JoinBattle")}</div>`);
      if (canDriveCombat) {
        parts.push(
          `<div class="jb-row">
             <button type="button" class="jb-btn jb-roll-all" title="${game.i18n.localize("EX2E.RollJoinBattle")}">
               <i class="fa-solid fa-dice-d10"></i> ${game.i18n.localize("EX2E.RollJoinBattle")}
             </button>
             <button type="button" class="jb-btn jb-roll-npcs" title="${game.i18n.localize("EX2E.RollJoinBattleNPC")}">
               <i class="fa-solid fa-skull"></i> ${game.i18n.localize("EX2E.RollJoinBattleNPC")}
             </button>
           </div>`
        );
      } else {
        parts.push(
          `<button type="button" class="jb-btn jb-roll-mine" title="${game.i18n.localize("EX2E.RollJoinBattle")}">
             <i class="fa-solid fa-dice-d10"></i> ${game.i18n.localize("EX2E.RollJoinBattle")}
           </button>`
        );
      }
    } else if (topSection === "begin") {
      parts.push(`<div class="jb-title">${game.i18n.localize("EX2E.JoinBattle")}</div>`);
      parts.push(
        `<button type="button" class="jb-btn jb-begin" title="${game.i18n.localize("EX2E.BeginEncounterTooltip")}">
           <i class="fa-solid fa-flag"></i> ${game.i18n.localize("EX2E.BeginEncounter")}
         </button>`
      );
    }

    if (showEndScene) {
      parts.push(
        `<div class="jb-row jb-end-scene-row">
           <button type="button" class="jb-btn jb-end-scene" title="${game.i18n.localize("EX2E.EndScene")}">
             <i class="fa-solid fa-flag-checkered"></i> ${game.i18n.localize("EX2E.EndScene")}
           </button>
         </div>`
      );
    }

    this._root.innerHTML = parts.join("");

    // Wire click handlers based on which sections rendered.
    this._root.querySelector(".jb-roll-mine")?.addEventListener("click", async () => {
      if (!combat) return;
      const combatants = combat.combatants.contents ?? [...combat.combatants];
      const myUnrolled = combatants.filter(c =>
        typeof c.flags?.exalted2e?.joinBattleSuccesses !== "number" &&
        !!c.actor?.testUserPermission(game.user, "OWNER")
      );
      const ids = myUnrolled.map(c => c.id);
      if (ids.length > 0) await combat.rollInitiative(ids);
    });
    this._root.querySelector(".jb-roll-all")?.addEventListener("click", async () => {
      if (combat) await combat.rollJoinBattle();
    });
    this._root.querySelector(".jb-roll-npcs")?.addEventListener("click", async () => {
      if (combat) await combat.rollJoinBattleForNPCs();
    });
    this._root.querySelector(".jb-begin")?.addEventListener("click", async () => {
      if (combat) await combat.startCombat();
    });
    this._root.querySelector(".jb-end-scene")?.addEventListener("click", async () => {
      const { clearSocialScene } = await import("./social-scene.mjs");
      await clearSocialScene();
    });
  }

  _show() { this._root.classList.remove("hidden"); }
  _hide() { this._root.classList.add("hidden"); }
}
