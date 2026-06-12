// module/apps/native-ma-styles-config.mjs
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { EX2E } from "../config.mjs";

/**
 * NativeMaStylesConfig — GM-only editor for the `exalted2e.nativeMartialArtsStyles`
 * world setting. Maps each Exalt type to a list of MA style names that are
 * "native" to that type. One style per line in each textarea.
 */
export class NativeMaStylesConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:       "ex2e-native-ma-styles-config",
    tag:      "form",
    classes:  ["exalted2e", "ex2e-native-ma-styles-config"],
    position: { width: 600, height: "auto" },
    window:   { title: "EX2E.NativeMaStylesConfigTitle", resizable: false },
    form: {
      handler:        NativeMaStylesConfig.#onSubmit,
      closeOnSubmit:  true,
      submitOnChange: false,
    },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/apps/native-ma-styles-config.hbs" },
  };

  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const saved  = game.settings.get("exalted2e", "nativeMartialArtsStyles") ?? {};
    const EXCLUDED = new Set(["mortal", "spirit", "martialarts"]);
    const splats = Object.entries(EX2E.splatTypes)
      .filter(([key]) => !EXCLUDED.has(key))
      .map(([key, labelKey]) => ({
        key,
        label:  game.i18n.localize(labelKey),
        styles: (saved[key] ?? []).join("\n"),
      }));
    return { ...ctx, splats };
  }

  static async #onSubmit(event, form, formData) {
    const raw    = formData.object;
    const result = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("styles.")) {
        const splat   = key.slice(7);
        result[splat] = String(value ?? "").split("\n").map(s => s.trim()).filter(Boolean);
      }
    }
    await game.settings.set("exalted2e", "nativeMartialArtsStyles", result);
  }
}
