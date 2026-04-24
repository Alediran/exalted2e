import { EX2E } from "../../config.mjs";

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
      addMode:    WeaponSheet.#onAddMode,
      removeMode: WeaponSheet.#onRemoveMode,
      addTag:     WeaponSheet.#onAddTag,
      removeTag:  WeaponSheet.#onRemoveTag
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
      })
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
