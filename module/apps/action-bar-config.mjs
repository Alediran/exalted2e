// module/apps/action-bar-config.mjs
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { EX2E } from "../config.mjs";

/** Action keys that can be pinned (Attack + Finish are always shown, so omitted). */
function pinnableActions() {
  const rows = [
    { key: "cast", labelKey: "EX2E.ActionCast", icon: "fa-solid fa-hat-wizard" },
  ];
  for (const [key, cfg] of Object.entries(EX2E.actions)) {
    if (cfg.clinchOnly) continue;
    rows.push({ key, labelKey: cfg.labelKey, icon: cfg.icon ?? "fa-solid fa-circle" });
  }
  return rows;
}

/**
 * ActionBarConfig — per-player editor for the `exalted2e.actionBarPinned`
 * client setting. An ordered, reorderable list of pinnable actions: tick a row
 * to put the action on the radial bar, and drag rows (or use the ▲/▼ buttons)
 * to set the order they appear. On save, the checked rows are stored in their
 * displayed order. Attack and Finish Turn are always on the bar, so they're
 * not listed.
 */
export class ActionBarConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:       "ex2e-action-bar-config",
    tag:      "form",
    classes:  ["exalted2e", "ex2e-action-bar-config"],
    position: { width: 420, height: "auto" },
    window:   { title: "EX2E.ActionBarPinnedTitle", resizable: true },
    form: {
      handler:        ActionBarConfig.#onSubmit,
      closeOnSubmit:  true,
      submitOnChange: false
    },
    actions: {
      moveUp:   ActionBarConfig.#onMoveUp,
      moveDown: ActionBarConfig.#onMoveDown,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/action-bar-config.hbs" }
  };

  async _prepareContext(options) {
    const ctx     = await super._prepareContext(options);
    const pinned  = game.settings.get("exalted2e", "actionBarPinned") ?? [];
    const byKey   = new Map(pinnableActions().map(r => [r.key, r]));
    const rows    = [];
    // Pinned actions first, in their saved order…
    for (const key of pinned) {
      const r = byKey.get(key);
      if (r) { rows.push({ ...r, checked: true }); byKey.delete(key); }
    }
    // …then the rest (unpinned), in the default pinnable order.
    for (const r of pinnableActions()) {
      if (byKey.has(r.key)) rows.push({ ...r, checked: false });
    }
    return { ...ctx, rows };
  }

  /** Move a row one slot earlier in the list (DOM-only; read back on submit). */
  static #onMoveUp(event, target) {
    event.preventDefault();
    const row  = target.closest(".ex2e-pin-row");
    const prev = row?.previousElementSibling;
    if (row && prev?.classList.contains("ex2e-pin-row")) prev.before(row);
  }

  /** Move a row one slot later in the list. */
  static #onMoveDown(event, target) {
    event.preventDefault();
    const row  = target.closest(".ex2e-pin-row");
    const next = row?.nextElementSibling;
    if (row && next?.classList.contains("ex2e-pin-row")) next.after(row);
  }

  /** Wire HTML5 drag-to-reorder on the rows after each render. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const list = this.element.querySelector(".ex2e-action-bar-config-body");
    if (!list) return;
    let dragRow = null;
    for (const row of list.querySelectorAll(".ex2e-pin-row")) {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", (e) => {
        dragRow = row;
        row.classList.add("ex2e-dragging");
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("ex2e-dragging");
        dragRow = null;
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!dragRow || dragRow === row) return;
        const rect  = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        if (after) row.after(dragRow); else row.before(dragRow);
      });
    }
  }

  static async #onSubmit(event, form, formData) {
    // Read the checked rows in their current DOM order so drag/▲▼ ordering is
    // preserved into the stored array.
    const keys = [...form.querySelectorAll(".ex2e-pin-row")]
      .filter(row => row.querySelector('input[type="checkbox"]')?.checked)
      .map(row => row.dataset.actionKey)
      .filter(Boolean);
    await game.settings.set("exalted2e", "actionBarPinned", keys);
    ui.notifications.info(game.i18n.localize("EX2E.ActionBarSaved"));
  }
}
