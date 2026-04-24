const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import {
  XP_COST_DEFAULTS,
  XP_COST_EXALT_ORDER
} from "../helpers/xp-cost-defaults.mjs";

/**
 * XpCostsConfigDialog — GM-only editor for the `exalted2e.xpCosts`
 * world setting. Opened via a `registerMenu` button in the system
 * settings panel.
 *
 * Layout: one scrollable form with a General block at the top and a
 * collapsible <details> section per exalt type. Each field shows the
 * stored override (or blank) with the hard-coded default as its
 * placeholder, so the dialog always signals "this is a tuning knob,
 * not the authoritative rule."
 *
 * Reset: wipes the setting back to `{}` after a confirm dialog, then
 * re-renders with every field blanked.
 */
export class XpCostsConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-xp-costs-config",
    tag:      "form",
    classes:  ["exalted2e", "ex2e-xp-costs-config"],
    position: { width: 600, height: "auto" },
    window:   {
      title:          "EX2E.XpCostsConfigTitle",
      resizable:      true,
      contentClasses: ["ex2e-xp-costs-config-body"]
    },
    form: {
      handler:       XpCostsConfigDialog.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false
    },
    actions: {
      resetDefaults: XpCostsConfigDialog.#onReset
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/xp-costs-config-dialog.hbs" }
  };

  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const stored = game.settings.get("exalted2e", "xpCosts") ?? {};
    return {
      ...ctx,
      general:  _buildRows("general", stored, XP_COST_DEFAULTS.general),
      sections: XP_COST_EXALT_ORDER.map(type => ({
        key:      type,
        labelKey: `EX2E.Exalt${_titleCase(type)}`,
        rows:     _buildRows(type, stored, XP_COST_DEFAULTS[type])
      }))
    };
  }

  static async #onSubmit(event, form, formData) {
    const raw = formData?.object ?? {};
    const cleaned = {};
    for (const [path, val] of Object.entries(raw)) {
      if (val === "" || val === null || val === undefined) continue;
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      foundry.utils.setProperty(cleaned, path, n);
    }
    await game.settings.set("exalted2e", "xpCosts", cleaned);
    ui.notifications.info(game.i18n.localize("EX2E.XpCostsSaved"));
  }

  static async #onReset(event, target) {
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: "EX2E.XpCostsResetTitle" },
      content: `<p>${game.i18n.localize("EX2E.XpCostsResetPrompt")}</p>`,
      rejectClose: false,
      modal:   true
    });
    if (!proceed) return;
    await game.settings.set("exalted2e", "xpCosts", {});
    ui.notifications.info(game.i18n.localize("EX2E.XpCostsResetDone"));
    await this.render({ force: true });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function _buildRows(sectionKey, stored, defaults) {
  const overrides = stored?.[sectionKey] ?? {};
  const rows = [];
  for (const [k, def] of Object.entries(defaults)) {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, k)
                     && overrides[k] !== null
                     && overrides[k] !== undefined
                     && overrides[k] !== "";
    rows.push({
      name:         `${sectionKey}.${k}`,
      labelKey:     `EX2E.XpCostField${_titleCase(k)}`,
      value:        hasOverride ? overrides[k] : "",
      placeholder:  def
    });
  }
  return rows;
}

function _titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
