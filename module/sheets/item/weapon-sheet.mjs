import { EX2E } from "../../config.mjs";
import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class WeaponSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "weapon"],
    position: { width: 480, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:           editImageAction,
      addMode:             WeaponSheet.#onAddMode,
      removeMode:          WeaponSheet.#onRemoveMode,
      addTag:              WeaponSheet.#onAddTag,
      removeTag:           WeaponSheet.#onRemoveTag,
      socketHearthstone:   WeaponSheet.#onSocketHearthstone,
      unsocketHearthstone: WeaponSheet.#onUnsocketHearthstone
    }
  };

  get title() {
    return `${game.i18n.localize(this.item.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/weapon/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/weapon/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    return {
      ...context,
      item,
      system:      sys,
      config:      EX2E,
      damageTypes: [
        { value: "bashing",    label: game.i18n.localize("EX2E.DmgBashing") },
        { value: "lethal",     label: game.i18n.localize("EX2E.DmgLethal") },
        { value: "aggravated", label: game.i18n.localize("EX2E.DmgAggravated") }
      ],
      allTags:          EX2E.weaponTags,
      magicalMaterials: Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
        value: k,
        label: game.i18n.localize(v)
      })),
      isEditable: this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      socketedSlots: _buildSocketedSlots(this.document)
    };
  }

  static async #onAddMode(event, target) {
    const modes = foundry.utils.deepClone(this.document.system.modes ?? []);
    modes.push({ name: `Mode ${modes.length + 1}` });
    await this.document.update({ "system.modes": modes });
  }

  static async #onRemoveMode(event, target) {
    const idx = parseInt(target.dataset.index);
    const modes = foundry.utils.deepClone(this.document.system.modes ?? []);
    if (modes.length <= 1) return;                     // always keep at least one mode
    modes.splice(idx, 1);
    await this.document.update({ "system.modes": null });
    await this.document.update({ "system.modes": modes });
  }

  static async #onAddTag(event, target) {
    const modeIdx = parseInt(target.dataset.modeIndex);
    const modes = foundry.utils.deepClone(this.document.system.modes ?? []);
    if (!modes[modeIdx]) return;
    modes[modeIdx].tags = [...(modes[modeIdx].tags ?? []), EX2E.weaponTags[0] ?? ""];
    await this.document.update({ "system.modes": modes });
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

  static async #onRemoveTag(event, target) {
    const modeIdx = parseInt(target.dataset.modeIndex);
    const tagIdx  = parseInt(target.dataset.index);
    const modes   = foundry.utils.deepClone(this.document.system.modes ?? []);
    if (!modes[modeIdx]) return;
    const tags = [...(modes[modeIdx].tags ?? [])];
    tags.splice(tagIdx, 1);
    modes[modeIdx].tags = tags;
    await this.document.update({ "system.modes": null });
    await this.document.update({ "system.modes": modes });
  }

  _onRender(context, options) {
    this.element.querySelectorAll(".dot-rating .dot").forEach(dot => {
      dot.addEventListener("click", this.#onDotClick.bind(this));
    });
  }

  async #onDotClick(event) {
    if (!this.isEditable) return;
    const pip      = event.currentTarget;
    const track    = pip.closest(".dot-rating");
    const name     = track?.dataset.name;
    if (!name) return;

    const clicked  = parseInt(pip.dataset.value);
    const current  = parseInt(track.dataset.current ?? 0);
    const min      = parseInt(track.dataset.min ?? 0);
    // Only the first pip toggles to minimum; any other pip sets its own value.
    const newVal   = (clicked === 1 && current === 1) ? min : clicked;

    // ArrayField paths (system.modes.<i>.<field>) need clone-then-replace
    const modeMatch = name.match(/^system\.modes\.(\d+)\.(\w+)$/);
    if (modeMatch) {
      const idx   = parseInt(modeMatch[1]);
      const field = modeMatch[2];
      const modes = foundry.utils.deepClone(this.document.system.modes ?? []);
      if (!modes[idx]) return;
      modes[idx][field] = newVal;
      await this.document.update({ "system.modes": null });
      await this.document.update({ "system.modes": modes });
      return;
    }

    await this.document.update({ [name]: newVal });
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
