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
 * client setting. A checklist of pinnable actions; checked keys are written
 * back as an array. Attack and Finish Turn are always present and not listed.
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
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/action-bar-config.hbs" }
  };

  async _prepareContext(options) {
    const ctx     = await super._prepareContext(options);
    const pinned  = new Set(game.settings.get("exalted2e", "actionBarPinned") ?? []);
    const rows    = pinnableActions().map(r => ({ ...r, checked: pinned.has(r.key) }));
    return { ...ctx, rows };
  }

  static async #onSubmit(event, form, formData) {
    const raw = formData?.object ?? {};
    const keys = pinnableActions().map(r => r.key).filter(k => raw[k]);
    await game.settings.set("exalted2e", "actionBarPinned", keys);
    ui.notifications.info(game.i18n.localize("EX2E.ActionBarSaved"));
  }
}
