import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

/**
 * Item sheet for the `form` (Heart's Blood) item type. Lets the user
 * edit the form's attributes, type, tags, mutations, source, and description.
 */
export class FormSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "form"],
    position: { width: 540, height: 640 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      addMutation:    FormSheet.#onAddMutation,
      removeMutation: FormSheet.#onRemoveMutation,
      editImage:      editImageAction
    }
  };

  get title() {
    return this.document.name;
  }

  static PARTS = {
    form: { template: "systems/exalted2e/templates/item/form-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item:       this.document,
      system:     this.document.system,
      isEditable: this.isEditable,
      formTypes:           ["human", "animal", "beast", "spirit", "wyldborn"],
      mutationCategories:  ["pox", "affliction", "blight", "abomination"],
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.document.system.description,
        { secrets: this.document.isOwner, relativeTo: this.document }
      )
    };
  }

  /**
   * Wire dot-pip click handlers after each render. Mirrors the
   * CharacterSheet pattern (see #onTrackClick) — clicking pip 1 when the
   * track's already at 1 toggles down to `min`; otherwise the click sets
   * the value, clamped to min.
   */
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
    const val      = (newValue === 1 && current === 1)
      ? min
      : Math.max(min, newValue);
    if (!name) return;
    this.document.update({ [name]: val });
  }

  static async #onAddMutation(event, target) {
    const list = foundry.utils.deepClone(this.document.system.mutations ?? []);
    list.push({ name: "", category: "pox", description: "" });
    await this.document.update({ "system.mutations": list });
  }

  static async #onRemoveMutation(event, target) {
    const idx = Number(target.dataset.index);
    if (!Number.isFinite(idx)) return;
    const list = foundry.utils.deepClone(this.document.system.mutations ?? []);
    list.splice(idx, 1);
    await this.document.update({ "system.mutations": list });
  }
}
