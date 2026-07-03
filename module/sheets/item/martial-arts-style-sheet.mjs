import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class MartialArtsStyleSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "martial-arts-style"],
    position: { width: 480, height: 520 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      editImage:    editImageAction,
      addWeapon:    MartialArtsStyleSheet.#onAddWeapon,
      removeWeapon: MartialArtsStyleSheet.#onRemoveWeapon,
    }
  };

  get title() {
    return this.document.name;
  }

  static PARTS = {
    form: { template: "systems/exalted2e/templates/item/martial-arts-style-sheet.hbs", scrollable: [".sheet-body"] }
  };

  static #onAddWeapon(event, target) {
    const input = this.element.querySelector(".add-weapon-input");
    const name = input?.value?.trim().toLowerCase();
    if (!name) return;
    const current = this.item.system.weapons ?? [];
    if (current.includes(name)) { input.value = ""; return; }
    this.item.update({ "system.weapons": [...current, name] });
    input.value = "";
  }

  static #onRemoveWeapon(event, target) {
    const idx = parseInt(target.dataset.index, 10);
    const current = [...(this.item.system.weapons ?? [])];
    current.splice(idx, 1);
    this.item.update({ "system.weapons": current });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;
    const dd = new foundry.applications.ux.DragDrop({
      dropSelector: ".weapons-editor",
      permissions:  { drop: () => this.isEditable },
      callbacks:    { drop: this._onDrop.bind(this) }
    });
    dd.bind(this.element);

    const dropEl = this.element.querySelector(".weapons-editor");
    if (dropEl) {
      dropEl.addEventListener("dragenter", () => dropEl.classList.add("drag-over"));
      dropEl.addEventListener("dragleave", (e) => {
        if (!dropEl.contains(e.relatedTarget)) dropEl.classList.remove("drag-over");
      });
      dropEl.addEventListener("drop", () => dropEl.classList.remove("drag-over"));
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (data?.type !== "Item") return;
    const item = await fromUuid(data.uuid);
    if (item?.type !== "weapon") return;
    const name = item.name.toLowerCase();
    const current = this.item.system.weapons ?? [];
    if (current.includes(name)) return;
    this.item.update({ "system.weapons": [...current, name] });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    const tierChoices = [
      { value: "terrestrial", label: game.i18n.localize("EX2E.MAStyleTierTerrestrial") },
      { value: "celestial",   label: game.i18n.localize("EX2E.MAStyleTierCelestial") },
      { value: "sidereal",    label: game.i18n.localize("EX2E.MAStyleTierSidereal") }
    ];
    const exaltTypeChoices = [
      { value: "",            label: "—" },
      { value: "solar",       label: "Solar" },
      { value: "lunar",       label: "Lunar" },
      { value: "terrestrial", label: "Dragon-Blooded" },
      { value: "sidereal",    label: "Sidereal" },
      { value: "abyssal",     label: "Abyssal" },
      { value: "infernal",    label: "Infernal" },
      { value: "alchemical",  label: "Alchemical" }
    ];
    return {
      ...context,
      item,
      system:     sys,
      isEditable: this.isEditable,
      tierChoices,
      exaltTypeChoices,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        itemDescription(item), { secrets: item.isOwner, relativeTo: item }
      )
    };
  }
}
