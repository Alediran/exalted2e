import { EX2E } from "../../config.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";
import { resolveNewDotValue } from "../../helpers/dot-rating.mjs";
import { buildSocketedSlots } from "../../helpers/equip-slots.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class ArmorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "armor"],
    position: { width: 440, height: 460 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:           editImageAction,
      addTag:              ArmorSheet.#onAddTag,
      removeTag:           ArmorSheet.#onRemoveTag,
      socketHearthstone:   ArmorSheet.#onSocketHearthstone,
      unsocketHearthstone: ArmorSheet.#onUnsocketHearthstone
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/armor/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/armor/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item:   this.document,
      system: this.document.system,
      config: EX2E,
      allTags: EX2E.armorTags,
      magicalMaterials: Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
        value: k,
        label: game.i18n.localize(v)
      })),
      isEditable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(this.document), {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      socketedSlots: buildSocketedSlots(this.document)
    };
  }

  static async #onSocketHearthstone(_event, target) {
    const slotIndex = parseInt(target.dataset.slotIndex);
    const artifact  = this.document;
    const actor     = artifact.parent;
    if (!actor) return;

    const socketedIds = new Set();
    for (const item of actor.items) {
      const stones = item.system?.hearthstones;
      if (Array.isArray(stones)) {
        for (const id of stones) { if (id) socketedIds.add(id); }
      }
    }

    const available = actor.items.filter(i => i.type === "hearthstone" && !socketedIds.has(i.id));
    if (!available.length) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoHearthstonesAvailable"));
      return;
    }

    const chosenId = await foundry.applications.api.DialogV2.prompt({
      window:      { title: game.i18n.localize("EX2E.SelectHearthstone") },
      content:     `<div style="padding:8px"><select name="stoneId" style="width:100%">
        ${available.map(s => `<option value="${s.id}">${s.name} (★${s.system.rating})</option>`).join("")}
      </select></div>`,
      ok:          { label: game.i18n.localize("EX2E.SocketHearthstone"), callback: (_ev, btn) => btn.form.elements.stoneId.value },
      rejectClose: false
    });
    if (!chosenId) return;

    const stones = foundry.utils.deepClone(artifact.system.hearthstones ?? []);
    stones[slotIndex] = chosenId;
    await artifact.update({ "system.hearthstones": stones });
  }

  static async #onUnsocketHearthstone(_event, target) {
    const slotIndex = parseInt(target.dataset.slotIndex);
    const stones    = foundry.utils.deepClone(this.document.system.hearthstones ?? []);
    stones[slotIndex] = "";
    await this.document.update({ "system.hearthstones": stones });
  }

  static async #onAddTag(event, target) {
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.push(EX2E.armorTags[0] ?? "");
    await this.document.update({ "system.tags": tags });
  }

  static async #onRemoveTag(event, target) {
    const idx  = parseInt(target.dataset.index);
    const tags = foundry.utils.deepClone(this.document.system.tags ?? []);
    tags.splice(idx, 1);
    await this.document.update({ "system.tags": tags });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;
    for (const pip of this.element.querySelectorAll(".dot-rating .dot")) {
      pip.addEventListener("click", this.#onDotClick.bind(this));
    }
  }

  async #onDotClick(event) {
    const pip      = event.currentTarget;
    const track    = pip.closest(".dot-rating");
    const name     = track?.dataset.name;
    if (!name) return;
    const newValue = parseInt(pip.dataset.value);
    const min      = parseInt(track?.dataset.min ?? 0);
    const current  = parseInt(track?.dataset.current ?? 0);
    const val      = resolveNewDotValue(newValue, current, min);
    await this.document.update({ [name]: val });
  }
}
