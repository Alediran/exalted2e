// module/dialogs/permissions-config-dialog.mjs
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import {
  PERMISSION_DEFAULTS,
  PERMISSION_KEY_ORDER
} from "../helpers/permissions-defaults.mjs";
import { REQUIRED_ROLE_CHOICES } from "../helpers/permissions.mjs";

/**
 * PermissionsConfigDialog — GM-only editor for the `exalted2e.permissions`
 * world setting. Opened from the `permissions` settings menu. One row per
 * key in PERMISSION_KEY_ORDER, each a <select> populated with
 * REQUIRED_ROLE_CHOICES. Sparse storage: only keys whose stored value
 * actually differs from the default end up in the saved object.
 */
export class PermissionsConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-permissions-config",
    tag:      "form",
    classes:  ["exalted2e", "ex2e-permissions-config"],
    position: { width: 560, height: "auto" },
    window:   {
      title:          "EX2E.PermissionsConfigTitle",
      resizable:      true,
      contentClasses: ["ex2e-permissions-config-body"]
    },
    form: {
      handler:        PermissionsConfigDialog.#onSubmit,
      closeOnSubmit:  true,
      submitOnChange: false
    },
    actions: {
      resetDefaults: PermissionsConfigDialog.#onReset
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/permissions-config-dialog.hbs" }
  };

  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const stored = game.settings.get("exalted2e", "permissions") ?? {};
    const rows   = PERMISSION_KEY_ORDER.map(key => {
      const storedVal = stored?.[key];
      const hasOverride = storedVal !== null
                       && storedVal !== undefined
                       && storedVal !== "";
      const current = hasOverride ? Number(storedVal) : PERMISSION_DEFAULTS[key];
      return {
        key,
        name:     key,
        labelKey: `EX2E.PermissionField${_titleCase(key)}`,
        descKey:  `EX2E.PermissionField${_titleCase(key)}Desc`,
        choices:  REQUIRED_ROLE_CHOICES.map(c => ({
          value:    c.value,
          labelKey: c.labelKey,
          selected: c.value === current
        }))
      };
    });
    return { ...ctx, rows };
  }

  static async #onSubmit(event, form, formData) {
    const raw = formData?.object ?? {};
    const cleaned = {};
    for (const key of PERMISSION_KEY_ORDER) {
      const val = raw[key];
      if (val === "" || val === null || val === undefined) continue;
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      if (n === PERMISSION_DEFAULTS[key]) continue;
      cleaned[key] = n;
    }
    await game.settings.set("exalted2e", "permissions", cleaned);
    ui.notifications.info(game.i18n.localize("EX2E.PermissionsSaved"));
  }

  static async #onReset(event, target) {
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window:      { title: "EX2E.PermissionsResetTitle" },
      content:     `<p>${game.i18n.localize("EX2E.PermissionsResetPrompt")}</p>`,
      rejectClose: false,
      modal:       true
    });
    if (!proceed) return;
    await game.settings.set("exalted2e", "permissions", {});
    ui.notifications.info(game.i18n.localize("EX2E.PermissionsResetDone"));
    await this.render({ force: true });
  }
}

function _titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
