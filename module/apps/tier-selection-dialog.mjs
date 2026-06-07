import { parseTierSelection } from "../helpers/app-dialog-helpers.mjs";

export class TierSelectionDialog {
  /**
   * Show a radio-group dialog for selecting an active tier or standard mode.
   * @param {{ active: object[] }} opts
   * @returns {Promise<{ standard: boolean, tier?: object }|null>}
   *   null = user cancelled (activation aborts)
   *   { standard: true } = standard mode selected
   *   { standard: false, tier } = specific tier selected
   */
  static async prompt({ active }) {
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/apps/tier-selection-dialog.hbs",
      { active }
    );
    return foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.ChooseActivationMode") },
      content,
      ok: {
        label: game.i18n.localize("EX2E.Confirm") ?? "Confirm",
        callback: (_ev, button) =>
          parseTierSelection(button.form?.elements?.tierSelection?.value ?? "standard", active),
      }
    });
  }
}
