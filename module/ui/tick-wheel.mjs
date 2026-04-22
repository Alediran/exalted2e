import { ensureCombatHUD } from "./action-quickbar.mjs";

/**
 * TickWheel — collapsible visual battle wheel (0..6 slots) anchored to the
 * combat HUD alongside the action quickbar.
 *
 * Collapsed: a narrow toggle pill showing the current tick number.
 * Expanded: a 7-slot dial with the current tick highlighted and each
 * combatant rendered as a dot in their `initiative % 7` slot.
 *
 * The wheel is purely a view — tick logic lives on ExaltedCombat.
 */
export class TickWheel {
  static _instance = null;

  static get instance() {
    if (!this._instance) this._instance = new TickWheel();
    return this._instance;
  }

  constructor() {
    this._root = null;
    this._collapsed = false;
    this._build();
  }

  _build() {
    const hud = ensureCombatHUD();
    const root = document.createElement("div");
    root.id = "ex2e-tick-wheel";
    root.classList.add("ex2e-tick-wheel", "hidden");
    // Insert before any existing bar so the wheel is on the left.
    hud.insertBefore(root, hud.firstChild);
    this._root = root;
  }

  refresh() {
    const combat = game.combat;
    if (!combat?.started) return this._hide();
    if (combat.combatants.size === 0) return this._hide();
    this._render(combat);
    this._show();
  }

  _show() { this._root.classList.remove("hidden"); }
  _hide() { this._root.classList.add("hidden"); }

  _render(combat) {
    this._root.classList.toggle("collapsed", this._collapsed);
    if (this._collapsed) {
      this._renderCollapsed(combat);
    } else {
      this._renderExpanded(combat);
    }
  }

  _renderCollapsed(combat) {
    const tick = combat.currentTick;
    const wheelTick = ((tick % 7) + 7) % 7;
    this._root.innerHTML = `
      <button type="button" class="tw-toggle" title="${game.i18n.localize("EX2E.TickWheelExpand")}">
        <i class="fa-solid fa-circle-dot"></i>
        <span class="tw-tick">${wheelTick}</span>
      </button>
    `;
    this._root.querySelector(".tw-toggle").addEventListener("click", () => {
      this._collapsed = false;
      this._render(combat);
    });
  }

  _renderExpanded(combat) {
    const tick = combat.currentTick;
    const wheelTick = ((tick % 7) + 7) % 7;

    // Bucket combatants by wheel slot.
    const slotCombatants = Array.from({ length: 7 }, () => []);
    for (const c of combat.combatants) {
      const init = Number.isFinite(c.initiative) ? c.initiative : 0;
      const slot = ((init % 7) + 7) % 7;
      slotCombatants[slot].push(c);
    }

    const nextTickBtn = game.user.isGM
      ? `<button type="button" class="tw-next-tick" title="${game.i18n.localize("EX2E.NextTickTooltip")}" aria-label="${game.i18n.localize("EX2E.NextTick")}">
           <i class="fa-solid fa-clock-rotate-left"></i>
         </button>`
      : "";

    this._root.innerHTML = `
      <div class="tw-header">
        <span class="tw-title">${game.i18n.localize("EX2E.TickWheelTitle")}</span>
        <button type="button" class="tw-toggle" title="${game.i18n.localize("EX2E.TickWheelCollapse")}">
          <i class="fa-solid fa-caret-down"></i>
        </button>
      </div>
      <div class="tw-svg-wrap">
        ${this._buildSvg(wheelTick, slotCombatants)}
        ${nextTickBtn}
      </div>
      <div class="tw-footer">
        ${game.i18n.format("EX2E.TickWheelCycleLabel", {
          cycle: Math.floor(tick / 7) + 1,
          tick:  wheelTick
        })}
      </div>
    `;
    this._root.querySelector(".tw-toggle").addEventListener("click", () => {
      this._collapsed = true;
      this._render(combat);
    });
    this._root.querySelector(".tw-next-tick")?.addEventListener("click", async () => {
      await combat.advanceWheel();
    });
  }

  /**
   * Build the 7-slot dial as a single SVG string. Slot 0 is at 12 o'clock;
   * subsequent slots distribute clockwise.
   */
  _buildSvg(currentSlot, slotCombatants) {
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const ringR = 72;
    const slotR = 20;
    const dotR = 4;

    const slotPos = i => {
      const theta = (i * 2 * Math.PI) / 7 - Math.PI / 2;
      return { x: cx + ringR * Math.cos(theta), y: cy + ringR * Math.sin(theta) };
    };

    const parts = [];
    // Outer guide ring.
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${ringR}" class="tw-ring"/>`
    );
    // 7 slots.
    for (let i = 0; i < 7; i++) {
      const { x, y } = slotPos(i);
      const isCurrent = i === currentSlot;
      const combatants = slotCombatants[i];
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${slotR}" class="tw-slot${isCurrent ? " tw-slot-current" : ""}"/>`,
        `<text x="${x}" y="${y}" class="tw-slot-label${isCurrent ? " tw-slot-label-current" : ""}" dominant-baseline="central" text-anchor="middle">${i}</text>`
      );
      // Combatant dots around the slot edge.
      if (combatants.length > 0) {
        const n = Math.min(combatants.length, 6);
        for (let k = 0; k < n; k++) {
          const phi = (k * 2 * Math.PI) / 6 - Math.PI / 2;
          const dx = x + (slotR + dotR + 2) * Math.cos(phi);
          const dy = y + (slotR + dotR + 2) * Math.sin(phi);
          const c = combatants[k];
          const isPC = !!c.actor?.hasPlayerOwner;
          parts.push(
            `<circle cx="${dx}" cy="${dy}" r="${dotR}" class="tw-combatant ${isPC ? "tw-combatant-pc" : "tw-combatant-npc"}"><title>${_escape(c.name)}</title></circle>`
          );
        }
        if (combatants.length > 6) {
          parts.push(
            `<text x="${x}" y="${y + slotR + 10}" class="tw-slot-overflow" text-anchor="middle">+${combatants.length - 6}</text>`
          );
        }
      }
    }
    // Center pointer + label.
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="28" class="tw-hub"/>`,
      `<text x="${cx}" y="${cy - 4}" class="tw-hub-label" text-anchor="middle">${game.i18n.localize("EX2E.TickWheelTickShort")}</text>`,
      `<text x="${cx}" y="${cy + 12}" class="tw-hub-value" text-anchor="middle">${currentSlot}</text>`
    );

    return `<svg viewBox="0 0 ${size} ${size}" class="tw-svg" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  }
}

/** Minimal HTML-escape for untrusted text (combatant names). */
function _escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));
}
