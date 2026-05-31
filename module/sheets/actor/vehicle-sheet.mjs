import { editImageAction } from "../_edit-image.mjs";

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ActorSheetV2: sheets.ActorSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class VehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "actor", "vehicle"],
    position: { width: 480, height: 600 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      onEditImage: editImageAction,
      createItem: VehicleSheet.#onCreateItem,
      editItem:   VehicleSheet.#onEditItem,
      deleteItem: VehicleSheet.#onDeleteItem,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/actor/vehicle/header.hbs" },
    body:   { template: "systems/exalted2e/templates/actor/vehicle/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.document;
    const sys     = actor.system;
    return {
      ...context,
      actor,
      system:             sys,
      isEditable:         this.isEditable,
      showEssenceSection: (sys.essence?.value ?? 0) > 0,
      weapons:            actor.items.filter(i => i.type === "weapon"),
      charms:             actor.items.filter(i => i.type === "charm"),
      vehicleTypeOptions: [
        { value: "mount",      label: game.i18n.localize("EX2E.VehicleTypeMount") },
        { value: "warstrider", label: game.i18n.localize("EX2E.VehicleTypeWarstrider") },
        { value: "ship",       label: game.i18n.localize("EX2E.VehicleTypeShip") },
        { value: "other",      label: game.i18n.localize("EX2E.VehicleTypeOther") },
      ],
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, { secrets: actor.isOwner, relativeTo: actor }
      ),
    };
  }

  static #onCreateItem(_event, target) {
    const type   = target.dataset.type ?? "weapon";
    const system = type === "weapon" ? { equipped: true } : {};
    this.document.createEmbeddedDocuments("Item", [{
      name: game.i18n.localize("EX2E.NewItem"),
      type,
      system
    }]);
  }

  static #onEditItem(_event, target) {
    const item = this.document.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  static #onDeleteItem(_event, target) {
    this.document.items.get(target.dataset.itemId)?.delete();
  }
}
