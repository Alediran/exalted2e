import { XpCostsConfigDialog } from "../dialogs/xp-costs-config-dialog.mjs";
import { PermissionsConfigDialog } from "../dialogs/permissions-config-dialog.mjs";
import { ActionBarConfig } from "../apps/action-bar-config.mjs";
import { ActionQuickbar } from "../ui/action-quickbar.mjs";

export function _applyUiTheme(theme) {
  document.body.classList.toggle("ex2e-light-mode", theme === "light");
}

export function registerSettings() {
  // ── System Settings ─────────────────────────────────────────────────────
  game.settings.register("exalted2e", "useErrataMaterials", {
    name:    "EX2E.SettingErrataMaterials",
    hint:    "EX2E.SettingErrataMaterialsHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register("exalted2e", "systemMigrationVersion", {
    scope:   "world",
    config:  false,
    type:    String,
    default: ""
  });

  game.settings.register("exalted2e", "useIntimacyIntensity", {
    name:    "EX2E.SettingIntimacyIntensity",
    hint:    "EX2E.SettingIntimacyIntensityHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  game.settings.register("exalted2e", "backgroundMethod", {
    name:    "EX2E.SettingBackgroundMethod",
    hint:    "EX2E.SettingBackgroundMethodHint",
    scope:   "world",
    config:  true,
    type:    String,
    choices: {
      xp:   "EX2E.SettingBackgroundMethodXP",
      free: "EX2E.SettingBackgroundMethodFree"
    },
    default: "xp"
  });

  // ── Automation Settings ────────────────────────────────────────────────
  game.settings.register("exalted2e", "autoApplyDamage", {
    name:    "EX2E.SettingAutoApplyDamage",
    hint:    "EX2E.SettingAutoApplyDamageHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
  });

  game.settings.register("exalted2e", "theCircleSeeded", {
    name:    "EX2E.SettingTheCircleSeeded",
    hint:    "EX2E.SettingTheCircleSeededHint",
    scope:   "world",
    config:  false,   // hidden — internal seed tracker
    type:    Boolean,
    default: false
  });

  // ── XP Cost Engine Config ──────────────────────────────────────────────
  // Stored as a single nested object so overrides per field can live
  // alongside one another; anything absent falls through to the defaults
  // baked into helpers/xp-cost-defaults.mjs.
  game.settings.register("exalted2e", "xpCosts", {
    name:    "EX2E.XpCostsConfigTitle",
    scope:   "world",
    config:  false,   // surfaced via the menu below instead of a checkbox
    type:    Object,
    default: {}
  });

  // ── Permissions ────────────────────────────────────────────────────────
  // Per-action minimum role, overlaid onto PERMISSION_DEFAULTS. Sparse —
  // only tweaked keys appear in storage.
  game.settings.register("exalted2e", "permissions", {
    name:    "EX2E.PermissionsConfigTitle",
    scope:   "world",
    config:  false,
    type:    Object,
    default: {}
  });

  game.settings.registerMenu("exalted2e", "xpCostsMenu", {
    name:       "EX2E.XpCostsConfigTitle",
    label:      "EX2E.XpCostsConfigButton",
    hint:       "EX2E.XpCostsConfigHint",
    icon:       "fa-solid fa-coins",
    type:       XpCostsConfigDialog,
    restricted: true   // GM-only
  });

  game.settings.registerMenu("exalted2e", "permissionsMenu", {
    name:       "EX2E.PermissionsConfigTitle",
    label:      "EX2E.PermissionsConfigButton",
    hint:       "EX2E.PermissionsConfigHint",
    icon:       "fa-solid fa-user-shield",
    type:       PermissionsConfigDialog,
    restricted: true   // GM-only
  });

  game.settings.register("exalted2e", "uiTheme", {
    name:     "EX2E.SettingUiTheme",
    hint:     "EX2E.SettingUiThemeHint",
    scope:    "client",
    config:   true,
    type:     String,
    choices:  {
      dark:  "EX2E.SettingUiThemeDark",
      light: "EX2E.SettingUiThemeLight",
    },
    default:  "dark",
    onChange: value => _applyUiTheme(value),
  });

  game.settings.register("exalted2e", "actionBarStyle", {
    name:    "EX2E.SettingActionBarStyle",
    hint:    "EX2E.SettingActionBarStyleHint",
    scope:   "client",
    config:  true,
    type:    String,
    choices: {
      dock:   "EX2E.SettingActionBarStyleDock",
      radial: "EX2E.SettingActionBarStyleRadial",
    },
    default: "dock",
    onChange: () => ActionQuickbar.instance.refresh(),
  });

  game.settings.register("exalted2e", "actionBarPinned", {
    scope:   "client",
    config:  false,
    type:    Array,
    default: ["attack", "guard", "move"],
    onChange: () => ActionQuickbar.instance.refresh(),
  });

  game.settings.registerMenu("exalted2e", "actionBarPinnedMenu", {
    name:       "EX2E.ActionBarPinnedMenuName",
    label:      "EX2E.ActionBarPinnedMenuLabel",
    hint:       "EX2E.ActionBarPinnedMenuHint",
    icon:       "fa-solid fa-grip",
    type:       ActionBarConfig,
    restricted: false,
  });
}
