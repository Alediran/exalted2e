import { EX2E } from "../../config.mjs";
import { computeSpellCastButtonState } from "../../ui/spell-cast-button.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

/**
 * SpellSheet — header + body layout for both Sorcery and Necromancy
 * spells. Follows the knack-sheet pattern (single body, no tabs) since
 * spells don't carry an Attack block in MVP.
 */
export class SpellSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "spell"],
    position: { width: 520, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      castSpell: SpellSheet.#onCastSpell
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/spell/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/spell/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    // ── Cast button state ──────────────────────────────────────────────
    const castButton = this._computeCastButtonState();

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      traditionChoices: [
        { value: "sorcery",    label: game.i18n.localize("EX2E.TraditionSorcery") },
        { value: "necromancy", label: game.i18n.localize("EX2E.TraditionNecromancy") }
      ],
      circleChoices: this._circleChoicesFor(sys.tradition),
      durations: Object.entries(EX2E.durations).map(([k,v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      isEditable:  this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      castButton
    };
  }

  /**
   * Compute the Cast button's UI state. Delegates to the shared
   * computeSpellCastButtonState helper so the spell-sheet's button and
   * the character-sheet's Charms-tab spell-row activate button stay
   * consistent.
   */
  _computeCastButtonState() {
    return computeSpellCastButtonState(this.document);
  }

  /**
   * Cast button click — delegates to the shared cast-spell flow.
   * The flow handles all branching (continue / cast / first-shape with
   * dialog) and is also called by the Charms tab spell-row "cast" button
   * via CharacterSheet.#onActivateCharm.
   */
  static async #onCastSpell(_event, _target) {
    const { castSpellFlow } = await import("../../ui/cast-spell-flow.mjs");
    await castSpellFlow(this.document);
  }

  /**
   * The circle dropdown re-labels based on tradition:
   *   sorcery    → Terrestrial / Celestial / Solar
   *   necromancy → Shadowlands / Labyrinth / Void
   */
  _circleChoicesFor(tradition) {
    const keys = tradition === "necromancy"
      ? ["CircleShadowlands", "CircleLabyrinth", "CircleVoid"]
      : ["CircleTerrestrial", "CircleCelestial", "CircleSolar"];
    return keys.map((k, i) => ({
      value: i + 1,
      label: game.i18n.localize(`EX2E.${k}`)
    }));
  }

}
