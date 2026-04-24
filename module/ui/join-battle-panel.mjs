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
    if (!combat || combat.started) return this._hide();
    const combatants = combat.combatants.contents ?? [...combat.combatants];
    if (combatants.length === 0) return this._hide();

    const unrolled = combatants.filter(c =>
      typeof c.flags?.exalted2e?.joinBattleSuccesses !== "number"
    );
    const canDriveCombat = ex2eCan("combatFlow");

    // Phase 2: every combatant has rolled JB but combat hasn't started.
    // Offer Begin Encounter to users who can drive combat flow.
    if (unrolled.length === 0) {
      if (!canDriveCombat) return this._hide();
      this._renderBegin(combat);
      this._show();
      return;
    }

    // Phase 1: roll buttons.
    const myUnrolled = unrolled.filter(c =>
      !!c.actor?.testUserPermission(game.user, "OWNER")
    );
    if (!canDriveCombat && myUnrolled.length === 0) return this._hide();

    this._renderRolls(combat, canDriveCombat, myUnrolled);
    this._show();
  }

  _renderRolls(combat, canDriveCombat, myUnrolled) {
    const parts = [
      `<div class="jb-title">${game.i18n.localize("EX2E.JoinBattle")}</div>`
    ];

    if (canDriveCombat) {
      // Both GM buttons share a row so the panel stays compact.
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

    this._root.innerHTML = parts.join("");

    this._root.querySelector(".jb-roll-mine")?.addEventListener("click", async () => {
      const ids = myUnrolled.map(c => c.id);
      if (ids.length > 0) await combat.rollInitiative(ids);
    });
    this._root.querySelector(".jb-roll-all")?.addEventListener("click", async () => {
      await combat.rollJoinBattle();
    });
    this._root.querySelector(".jb-roll-npcs")?.addEventListener("click", async () => {
      await combat.rollJoinBattleForNPCs();
    });
  }

  _renderBegin(combat) {
    this._root.innerHTML = `
      <div class="jb-title">${game.i18n.localize("EX2E.JoinBattle")}</div>
      <button type="button" class="jb-btn jb-begin" title="${game.i18n.localize("EX2E.BeginEncounterTooltip")}">
        <i class="fa-solid fa-flag"></i> ${game.i18n.localize("EX2E.BeginEncounter")}
      </button>
    `;
    this._root.querySelector(".jb-begin")?.addEventListener("click", async () => {
      await combat.startCombat();
    });
  }

  _show() { this._root.classList.remove("hidden"); }
  _hide() { this._root.classList.add("hidden"); }
}
