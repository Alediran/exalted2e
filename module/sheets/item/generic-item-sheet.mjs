import { editImageAction } from "../_edit-image.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";
import { EX2E } from "../../config.mjs";
import { manseBudgetState, manseDamageThreshold, mansePowerDesignReqs, canDesignPower, manseSoakRef } from "../../helpers/manse-geomancy.mjs";
import { resolveNewDotValue } from "../../helpers/dot-rating.mjs";
import { buildSocketedSlots } from "../../helpers/equip-slots.mjs";
import { clampBackgroundRating, lookupBackgroundTableValue } from "../../helpers/background-tables.mjs";

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
      socketHearthstone:   GenericItemSheet.#onSocketHearthstone,
      unsocketHearthstone: GenericItemSheet.#onUnsocketHearthstone,
      addMansePower:    GenericItemSheet.#onAddMansePower,
      addMansePowerFromCatalog: GenericItemSheet.#onAddMansePowerFromCatalog,
      deleteMansePower: GenericItemSheet.#onDeleteMansePower,
      rollManseCapping:  GenericItemSheet.#onRollManseCapping,
      designMansePower:  GenericItemSheet.#onDesignMansePower,
      applyManseDamage:  GenericItemSheet.#onApplyManseDamage,
      repairManse:       GenericItemSheet.#onRepairManse,
      clearManseLink:          GenericItemSheet.#onClearManseLink,
      clearFamiliarBackground: GenericItemSheet.#onClearFamiliarBackground,
      clearFamiliarActor:      GenericItemSheet.#onClearFamiliarActor,
      createFamiliarActor:     GenericItemSheet.#onCreateFamiliarActor,
      clearCultBackground:      GenericItemSheet.#onClearCultBackground,
      clearCommandBackground:   GenericItemSheet.#onClearCommandBackground,
      clearFollowersBackground: GenericItemSheet.#onClearFollowersBackground,
      afflictTargets:           GenericItemSheet.#onAfflictTargets
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
    if (item.type === "background") {
      typeChoices = {
        backgroundType: EX2E.backgroundTypeGroups.map(group => ({
          label:   game.i18n.localize(group.labelKey),
          options: group.keys.map(k => ({
            value: k,
            label: game.i18n.localize(EX2E.backgroundTypes[k] ?? k)
          }))
        }))
      };
    }

    const backgroundTypeLabel = item.type === "background" && sys.backgroundType
      ? game.i18n.localize(EX2E.backgroundTypes[sys.backgroundType] ?? "")
      : "";

    let mansePowerAspects = [];
    if (item.type === "manse-power") {
      mansePowerAspects = Object.entries(EX2E.hearthstoneTypes).map(([k, v]) => ({
        value:   k,
        label:   game.i18n.localize(v),
        favored: (sys.aspectFavored ?? []).includes(k),
        only:    (sys.onlyAspect ?? []).includes(k),
      }));
    }

    let manseBackgrounds       = [];
    let manseHearthstones      = [];
    let manseRating            = 0;
    let manseAspect            = "";
    let manseAspectLabel       = "";
    let manseBackgroundName    = "";
    let manseHearthstoneName   = "";
    let manseBudget            = null;
    let manseConstruction      = null;
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
      const linkedHsForCap = item.parent?.items.get(sys.hearthstoneId);
      manseBudget = manseBudgetState(sys, manseRating, {
        linkedHearthstoneRating: linkedHsForCap?.system.rating ?? 0
      });
      const effectiveRating = Math.max(0, manseRating - (sys.powerFailures ?? 0));
      manseConstruction = {
        capped:        !!sys.capped,
        effectiveRating,
        powerFailures: sys.powerFailures ?? 0,
        damage:        sys.damage ?? 0,
        threshold:     manseDamageThreshold(effectiveRating, sys.fragility ?? 0),
        soakRef:       manseSoakRef(sys.fragility ?? 0),
        ownerLore:     item.parent?.system?.abilities?.lore?.value   ?? 0,
        ownerOccult:   item.parent?.system?.abilities?.occult?.value ?? 0,
      };
    }

    let familiarBackgroundName   = "";
    let familiarBackgroundRating = 0;
    let familiarLinkedActorName  = "";
    if (item.type === "familiar") {
      const actor = item.parent;
      if (actor) {
        const linkedBg    = actor.items.get(sys.backgroundId);
        const linkedActor = game.actors?.get(sys.linkedActorId);
        familiarBackgroundName   = linkedBg?.name ?? "";
        familiarBackgroundRating = linkedBg?.system.value ?? 0;
        familiarLinkedActorName  = linkedActor?.name ?? "";
      }
    }

    let cultBackgroundName   = "";
    let cultBackgroundRating = 0;
    let cultMoteRegenDisplay = 0;
    let cultWpHoursDisplay   = 0;
    if (item.type === "cult") {
      const actor = item.parent;
      if (actor) {
        const linkedBg = actor.items.get(sys.backgroundId);
        cultBackgroundName   = linkedBg?.name ?? "";
        cultBackgroundRating = clampBackgroundRating(linkedBg?.system.value);
      }
      cultMoteRegenDisplay = lookupBackgroundTableValue(cultBackgroundRating, EX2E.cultMoteRegen);
      cultWpHoursDisplay   = lookupBackgroundTableValue(cultBackgroundRating, EX2E.cultWpHours);
    }

    let commandBackgroundName   = "";
    let commandBackgroundRating = 0;
    let commandWarDice          = 0;
    if (item.type === "command") {
      const actor = item.parent;
      if (actor) {
        const linkedBg = actor.items.get(sys.backgroundId);
        commandBackgroundName   = linkedBg?.name ?? "";
        commandBackgroundRating = clampBackgroundRating(linkedBg?.system.value);
      }
      commandWarDice = lookupBackgroundTableValue(commandBackgroundRating, EX2E.commandWarDice);
    }

    let followersBackgroundName   = "";
    let followersBackgroundRating = 0;
    let followersMagnitude        = 0;
    if (item.type === "followers") {
      const actor = item.parent;
      if (actor) {
        const linkedBg = actor.items.get(sys.backgroundId);
        followersBackgroundName   = linkedBg?.name ?? "";
        followersBackgroundRating = clampBackgroundRating(linkedBg?.system.value);
      }
      followersMagnitude = lookupBackgroundTableValue(followersBackgroundRating, EX2E.followersMagnitude);
    }

    const enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(item), {
      secrets: this.document.isOwner, relativeTo: this.document
    });

    const useIntimacyIntensity = game.settings.get("exalted2e", "useIntimacyIntensity");

    const magicalMaterials = Object.entries(EX2E.magicalMaterials).map(([k, v]) => ({
      value: k,
      label: game.i18n.localize(v)
    }));

    const mansePowers = item.type === "manse"
      ? (sys.powers ?? []).map((p, i) => {
          const reqAbility = mansePowerDesignReqs(p.cost ?? 0).prereq;
          return {
            ...p,
            overCap:       manseBudget?.violations?.includes(i) ?? false,
            status:        p.status ?? "pending",
            canDesign:     canDesignPower(
              { lore: manseConstruction?.ownerLore ?? 0, occult: manseConstruction?.ownerOccult ?? 0 },
              p.cost ?? 0
            ),
            designReqText: game.i18n.format("EX2E.MansePowerDesignReq", { n: reqAbility }),
          };
        })
      : [];

    return { ...context, item, system: sys, typeChoices, isEditable: this.isEditable,
             enrichedDescription, useIntimacyIntensity,
             isGM: game.user.isGM, magicalMaterials,
             socketedSlots: buildSocketedSlots(this.document),
             manseBackgrounds, manseHearthstones, manseRating, manseAspect, manseAspectLabel,
             manseBackgroundName, manseHearthstoneName,
             manseBudget,
             manseConstruction,
             mansePowers,
             mansePowerAspects,
             backgroundTypeLabel,
             familiarBackgroundName, familiarBackgroundRating, familiarLinkedActorName,
             cultBackgroundName, cultBackgroundRating, cultMoteRegenDisplay, cultWpHoursDisplay,
             commandBackgroundName, commandBackgroundRating, commandWarDice,
             followersBackgroundName, followersBackgroundRating, followersMagnitude };
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
          if (zone.dataset.dropField === "hearthstoneId") {
            const bg        = this.document.parent?.items.get(this.document.system.backgroundId);
            const rating    = bg?.system.value ?? 0;
            const reduction = this.document.system.hearthstoneReduction ?? 0;
            const cap       = Math.max(0, rating - reduction);
            if ((dropped.system.rating ?? 0) > cap) {
              ui.notifications.warn(game.i18n.format("EX2E.ManseHearthstoneTooHigh", { cap }));
              return;
            }
          }
          await this.document.update({ [`system.${zone.dataset.dropField}`]: dropped.id });
        });
      }
    }
    if (this.document.type === "familiar" || this.document.type === "cult"
        || this.document.type === "command" || this.document.type === "followers") {
      for (const zone of this.element.querySelectorAll(".background-drop-zone")) {
        zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("drag-over"); });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", async ev => {
          ev.preventDefault();
          zone.classList.remove("drag-over");
          let data;
          try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
          if (data.type !== "Item") return;
          const dropped = await fromUuid(data.uuid);
          if (!dropped || dropped.type !== "background") return;
          await this.document.update({ "system.backgroundId": dropped.id });
        });
      }
    }
    if (this.document.type === "familiar") {
      const actorZone = this.element.querySelector(".familiar-actor-drop-zone");
      if (actorZone) {
        actorZone.addEventListener("dragover", ev => { ev.preventDefault(); actorZone.classList.add("drag-over"); });
        actorZone.addEventListener("dragleave", () => actorZone.classList.remove("drag-over"));
        actorZone.addEventListener("drop", async ev => {
          ev.preventDefault();
          actorZone.classList.remove("drag-over");
          let data;
          try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
          if (data.type !== "Actor") return;
          const dropped = await fromUuid(data.uuid);
          if (!dropped) return;
          await this.document.update({ "system.linkedActorId": dropped.id });
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
    if (field === "cost") {
      powers[idx].cost = Math.max(0, Math.min(5, parseInt(input.value) || 0));
    } else if (field === "isMaterial") {
      powers[idx].isMaterial = input.checked;
    } else {
      powers[idx][field] = input.value;
    }
    this.document.update({ "system.powers": powers });
  }

  #onDotClick(event) {
    const pip      = event.currentTarget;
    const track    = pip.closest(".dot-rating");
    const name     = track?.dataset.name;
    const newValue = parseInt(pip.dataset.value);
    const min      = parseInt(track?.dataset.min ?? 0);
    const current  = parseInt(track?.dataset.current ?? 0);
    const val      = resolveNewDotValue(newValue, current, min);
    if (!name) return;
    this.document.update({ [name]: val });
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

  static async #onClearFamiliarBackground(_event, _target) {
    await this.document.update({ "system.backgroundId": "" });
  }

  static async #onClearFamiliarActor(_event, _target) {
    await this.document.update({ "system.linkedActorId": "" });
  }

  static async #onCreateFamiliarActor(_event, _target) {
    const name = await foundry.applications.api.DialogV2.prompt({
      window:      { title: game.i18n.localize("EX2E.FamiliarNewActor") },
      content:     `<div style="padding:8px"><input type="text" name="actorName" placeholder="${game.i18n.localize("EX2E.FamiliarNewActor")}" style="width:100%" autofocus></div>`,
      ok:          { label: game.i18n.localize("EX2E.Create"), callback: (_ev, btn) => btn.form.elements.actorName.value },
      rejectClose: false
    });
    if (!name?.trim()) return;
    const circleFolder = game.folders.find(f => f.type === "Actor" && f.name === "The Circle")
      ?? await Folder.create({ name: "The Circle", type: "Actor" });
    const familiarsFolder = game.folders.find(f => f.type === "Actor" && f.name === "Familiars" && f.folder?.id === circleFolder.id)
      ?? await Folder.create({ name: "Familiars", type: "Actor", folder: circleFolder.id });
    const ownership = game.user.isGM ? {} : { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
    const actor = await Actor.create({ name: name.trim(), type: "npc", folder: familiarsFolder.id, ownership });
    if (!actor) return;
    await this.document.update({ "system.linkedActorId": actor.id });
  }

  static async #onClearCultBackground(_event, _target) {
    await this.document.update({ "system.backgroundId": "" });
  }

  static async #onClearCommandBackground(_event, _target) {
    await this.document.update({ "system.backgroundId": "" });
  }

  static async #onClearFollowersBackground(_event, _target) {
    await this.document.update({ "system.backgroundId": "" });
  }

  static async #onAddMansePower(_event, _target) {
    const powers = foundry.utils.deepClone(this.document.system.powers ?? []);
    powers.push({ name: "", cost: 1 });
    await this.document.update({ "system.powers": powers });
  }

  static async #onAddMansePowerFromCatalog(_event, _target) {
    const item        = this.document;
    const actor       = item.parent;
    const bg          = actor?.items.get(item.system.backgroundId);
    const rating      = bg?.system.value ?? 0;
    const linkedHs    = actor?.items.get(item.system.hearthstoneId);
    const manseAspect = linkedHs?.system.hearthstoneType ?? "";
    const powers      = item.system.powers ?? [];
    const { MansePowerPickerDialog } = await import("../../dialogs/manse-power-picker-dialog.mjs");
    const picked = await MansePowerPickerDialog.prompt({
      rating, manseAspect, existingNames: powers.map(p => p.name)
    });
    if (!picked) return;
    const next = foundry.utils.deepClone(powers);
    next.push({ name: picked.name, cost: picked.cost, isMaterial: !!picked.isMaterial });
    await item.update({ "system.powers": next });
  }

  static async #onDeleteMansePower(_event, target) {
    const idx = parseInt(target.dataset.powerIndex, 10);
    if (isNaN(idx)) return;
    const powers = foundry.utils.deepClone(this.document.system.powers ?? []);
    powers.splice(idx, 1);
    await this.document.update({ "system.powers": powers });
  }

  static async #onRollManseCapping(_event, _target) {
    const { rollManseCapping } = await import("../../combat/manse-construction.mjs");
    await rollManseCapping(this.document);
  }

  static async #onDesignMansePower(_event, target) {
    const idx = parseInt(target.dataset.powerIndex);
    if (isNaN(idx)) return;
    const { rollDesignPower } = await import("../../combat/manse-construction.mjs");
    await rollDesignPower(this.document, idx);
  }

  static async #onApplyManseDamage(_event, _target) {
    const input = this.element.querySelector("#manse-damage-input");
    const amount = Math.max(0, parseInt(input?.value) || 0);
    if (amount <= 0) return;
    const { applyManseDamage } = await import("../../combat/manse-construction.mjs");
    await applyManseDamage(this.document, amount);
    if (input) input.value = "";
  }

  static async #onRepairManse(_event, _target) {
    const { rollManseRepair } = await import("../../combat/manse-construction.mjs");
    await rollManseRepair(this.document);
  }

  static async #onAfflictTargets(_event, _target) {
    const item = this.document;
    let actors = [...(game.user.targets ?? [])].map(t => t.actor).filter(Boolean);
    if (!actors.length) actors = (canvas.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
    if (!actors.length) { ui.notifications.warn(game.i18n.localize("EX2E.AfflictNoTargets")); return; }

    let intervals = 1;
    if (item.type === "poison") {
      const parsed = parseInt(item.system.duration, 10);
      const def = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
      const result = await foundry.applications.api.DialogV2.prompt({
        window:  { title: game.i18n.localize("EX2E.AfflictIntervalTitle") },
        content: `<div class="form-group"><label>${game.i18n.localize("EX2E.AfflictIntervalLabel")}</label>
                  <input type="number" name="intervals" value="${def}" min="1" autofocus></div>`,
        ok: { label: game.i18n.localize("EX2E.Afflict"),
              callback: (_ev, btn) => parseInt(btn.form.elements.intervals.value, 10) || def },
      });
      if (result == null) return;
      intervals = Math.max(1, result);
    }
    const { afflictTargets } = await import("../../combat/affliction.mjs");
    await afflictTargets(item, actors, { intervals });
  }
}
