import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class GenericItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "generic"],
    position: { width: 440, height: 420 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:        editImageAction,
      toggleIsBreeding: GenericItemSheet.#onToggleIsBreeding
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/generic/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/generic/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    // Build type-specific choices
    let typeChoices = {};
    if (item.type === "intimacy") {
      typeChoices = {
        intimacyType: [
          { value: "tie",       label: game.i18n.localize("EX2E.IntimacyTie") },
          { value: "principle", label: game.i18n.localize("EX2E.IntimacyPrinciple") }
        ],
        intensity: [
          { value: "minor",    label: game.i18n.localize("EX2E.IntensityMinor") },
          { value: "major",    label: game.i18n.localize("EX2E.IntensityMajor") },
          { value: "defining", label: game.i18n.localize("EX2E.IntensityDefining") }
        ]
      };
    }
    if (item.type === "meritflaw") {
      typeChoices = {
        meritFlawType: [
          { value: "merit", label: game.i18n.localize("EX2E.MeritFlawMerit") },
          { value: "flaw",  label: game.i18n.localize("EX2E.MeritFlawFlaw") }
        ]
      };
    }

    const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
      secrets: this.document.isOwner, relativeTo: this.document
    });

    const useIntimacyIntensity = game.settings.get("exalted2e", "useIntimacyIntensity");
    const isBreedingTrait = !!(item.flags?.exalted2e?.isBreeding);
    return { ...context, item, system: sys, typeChoices, isEditable: this.isEditable,
             enrichedDescription, useIntimacyIntensity,
             isGM: game.user.isGM, isBreedingTrait };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;
    for (const pip of this.element.querySelectorAll(".dot-rating .dot")) {
      pip.addEventListener("click", this.#onDotClick.bind(this));
    }
  }

  #onDotClick(event) {
    const pip      = event.currentTarget;
    const track    = pip.closest(".dot-rating");
    const name     = track?.dataset.name;
    const newValue = parseInt(pip.dataset.value);
    const min      = parseInt(track?.dataset.min ?? 0);
    const current  = parseInt(track?.dataset.current ?? 0);
    const val      = (newValue === 1 && current === 1) ? min : Math.max(min, newValue);
    if (!name) return;
    this.document.update({ [name]: val });
  }

  static async #onToggleIsBreeding(event, target) {
    const item = this.document;
    if (item.type !== "background") return;
    const current = item.flags?.exalted2e?.isBreeding ?? false;
    const next    = !current;
    await item.update({
      "flags.exalted2e.isBreeding":    next,
      "flags.exalted2e.gmOnlyRemoval": next
    });
  }
}
