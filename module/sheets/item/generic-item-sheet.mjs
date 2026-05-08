import { editImageAction } from "../_edit-image.mjs";
import { EX2E } from "../../config.mjs";

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
      editImage:           editImageAction,
      toggleIsBreeding:    GenericItemSheet.#onToggleIsBreeding,
      socketHearthstone:   GenericItemSheet.#onSocketHearthstone,
      unsocketHearthstone: GenericItemSheet.#onUnsocketHearthstone
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
    if (item.type === "hearthstone") {
      typeChoices = {
        hearthstoneType: Object.entries(EX2E.hearthstoneTypes).map(([k, v]) => ({
          value: k,
          label: game.i18n.localize(v)
        }))
      };
    }

    const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
      secrets: this.document.isOwner, relativeTo: this.document
    });

    const useIntimacyIntensity = game.settings.get("exalted2e", "useIntimacyIntensity");
    const isBreedingTrait = !!(item.flags?.exalted2e?.isBreeding);

    const magicalMaterials = Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
      value: k,
      label: game.i18n.localize(v)
    }));

    return { ...context, item, system: sys, typeChoices, isEditable: this.isEditable,
             enrichedDescription, useIntimacyIntensity,
             isGM: game.user.isGM, isBreedingTrait, magicalMaterials,
             socketedSlots: _buildSocketedSlots(this.document) };
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
}

function _buildSocketedSlots(item) {
  const count      = item.system?.hearthstoneSlots ?? 0;
  const ids        = item.system?.hearthstones ?? [];
  const actorItems = item.parent ? [...item.parent.items] : [];
  return Array.from({ length: count }, (_, i) => {
    const id    = ids[i] ?? "";
    const stone = id ? actorItems.find(s => s.id === id && s.type === "hearthstone") : null;
    return { index: i, filled: !!stone, stoneId: id, stoneName: stone?.name ?? "", stoneRating: stone?.system?.rating ?? 0 };
  });
}
