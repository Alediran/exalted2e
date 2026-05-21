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
      unsocketHearthstone: GenericItemSheet.#onUnsocketHearthstone,
      addMansePower:    GenericItemSheet.#onAddMansePower,
      deleteMansePower: GenericItemSheet.#onDeleteMansePower,
      clearManseLink:   GenericItemSheet.#onClearManseLink
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

    let manseBackgrounds       = [];
    let manseHearthstones      = [];
    let manseRating            = 0;
    let manseAspect            = "";
    let manseAspectLabel       = "";
    let manseBackgroundName    = "";
    let manseHearthstoneName   = "";
    let manseUsedBudget        = 0;
    let manseRemainingBudget   = 0;
    let manseOverBudget        = false;
    if (item.type === "manse") {
      const actor = item.parent;
      if (actor) {
        manseBackgrounds  = actor.items
          .filter(i => i.type === "background")
          .map(i => ({ id: i.id, name: i.name, value: i.system.value }));
        manseHearthstones = actor.items
          .filter(i => i.type === "hearthstone")
          .map(i => ({ id: i.id, name: i.name }));
        const linkedBg       = actor.items.get(sys.backgroundId);
        const linkedHs       = actor.items.get(sys.hearthstoneId);
        manseRating          = linkedBg?.system.value ?? 0;
        manseBackgroundName  = linkedBg?.name ?? "";
        manseAspect          = linkedHs?.system.hearthstoneType ?? "";
        manseAspectLabel     = manseAspect ? (EX2E.hearthstoneTypes[manseAspect] ?? "") : "";
        manseHearthstoneName = linkedHs?.name ?? "";
      }
      manseUsedBudget      = (sys.powers ?? []).reduce((sum, p) => sum + (p.cost ?? 0), 0);
      manseRemainingBudget = manseRating - manseUsedBudget;
      manseOverBudget      = manseUsedBudget > manseRating;
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

    const mansePowers = item.type === "manse" ? [...(sys.powers ?? [])] : [];

    return { ...context, item, system: sys, typeChoices, isEditable: this.isEditable,
             enrichedDescription, useIntimacyIntensity,
             isGM: game.user.isGM, isBreedingTrait, magicalMaterials,
             socketedSlots: _buildSocketedSlots(this.document),
             manseBackgrounds, manseHearthstones, manseRating, manseAspect, manseAspectLabel,
             manseBackgroundName, manseHearthstoneName,
             manseUsedBudget, manseRemainingBudget, manseOverBudget,
             mansePowers };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;
    for (const pip of this.element.querySelectorAll(".dot-rating .dot")) {
      pip.addEventListener("click", this.#onDotClick.bind(this));
    }
    if (this.document.type === "manse") {
      for (const input of this.element.querySelectorAll("[data-power-index]")) {
        input.addEventListener("change", this.#onPowerFieldChange.bind(this));
      }
      for (const zone of this.element.querySelectorAll(".manse-drop-zone")) {
        zone.addEventListener("dragover", ev => {
          ev.preventDefault();
          zone.classList.add("drag-over");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", async ev => {
          ev.preventDefault();
          zone.classList.remove("drag-over");
          let data;
          try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
          if (data.type !== "Item") return;
          const dropped = await fromUuid(data.uuid);
          if (!dropped || dropped.type !== zone.dataset.dropAccepts) return;
          await this.document.update({ [`system.${zone.dataset.dropField}`]: dropped.id });
        });
      }
    }
  }

  #onPowerFieldChange(event) {
    const input = event.currentTarget;
    const idx   = parseInt(input.dataset.powerIndex);
    const field = input.dataset.powerField;
    if (isNaN(idx) || !field) return;
    const powers = foundry.utils.deepClone(this.document.system.powers ?? []);
    if (!powers[idx]) return;
    powers[idx][field] = field === "cost"
      ? Math.max(0, Math.min(3, parseInt(input.value) || 0))
      : input.value;
    this.document.update({ "system.powers": powers });
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

  static async #onClearManseLink(_event, target) {
    const field = target.dataset.field;
    if (!field) return;
    await this.document.update({ [`system.${field}`]: "" });
  }

  static async #onAddMansePower(_event, _target) {
    const powers = foundry.utils.deepClone(this.document.system.powers ?? []);
    powers.push({ name: "", cost: 1 });
    await this.document.update({ "system.powers": powers });
  }

  static async #onDeleteMansePower(_event, target) {
    const idx = parseInt(target.dataset.powerIndex, 10);
    if (isNaN(idx)) return;
    const powers = foundry.utils.deepClone(this.document.system.powers ?? []);
    powers.splice(idx, 1);
    await this.document.update({ "system.powers": powers });
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
