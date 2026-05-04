import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class UrgeSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "urge"],
    position: { width: 480, height: 520 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      editImage:    editImageAction,
      createEffect: UrgeSheet.#onCreateEffect,
      editEffect:   UrgeSheet.#onEditEffect,
      deleteEffect: UrgeSheet.#onDeleteEffect,
      toggleEffect: UrgeSheet.#onToggleEffect,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/urge/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/urge/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    const effects = Array.from(this.document.effects).map(e => ({
      id:       e.id,
      name:     e.name,
      img:      e.img ?? "icons/svg/aura.svg",
      disabled: e.disabled,
    }));

    return {
      ...context,
      item,
      system:              sys,
      isEditable:          this.isEditable,
      effects,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, { secrets: item.isOwner, relativeTo: item }
      ),
    };
  }

  static async #onCreateEffect(_event, _target) {
    const created = await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.localize("EX2E.NewEffect"),
      img:      "icons/svg/aura.svg",
      disabled: true
    }]);
    created[0]?.sheet?.render({ force: true });
  }

  static async #onEditEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    effect?.sheet?.render({ force: true });
  }

  static async #onDeleteEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    if (!effect) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("EX2E.DeleteEffectConfirm").replace("{name}", effect.name) },
      yes: { label: game.i18n.localize("Yes"), icon: "fa-solid fa-trash" },
      no:  { label: game.i18n.localize("No"),  icon: "fa-solid fa-times" }
    });
    if (confirmed) await effect.delete();
  }

  static async #onToggleEffect(_event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect   = this.document.effects.get(effectId);
    if (!effect) return;
    await effect.update({ disabled: !effect.disabled });
  }
}
