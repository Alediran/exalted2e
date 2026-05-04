import { editImageAction } from "../_edit-image.mjs";
import { ExaltedRoll } from "../../rolls/exalted-roll.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class DestinySheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "destiny"],
    position: { width: 540, height: 640 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      editImage:       editImageAction,
      finalizeDestiny: DestinySheet.#onFinalizeDestiny,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/destiny/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/destiny/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    const EX      = game.exalted2e.EX2E;

    const toOption = (key, entry) => ({
      key:            isNaN(key) ? key : Number(key),
      label:          game.i18n.localize(entry.labelKey),
      paradoxDice:    entry.paradoxDice ?? 0,
      effectPoints:   entry.effectPoints ?? 0,
      invitesCensure: !!entry.invitesCensure,
    });

    const providences  = Object.entries(EX.destinyProvidence).map(([k, v]) => toOption(k, v));
    const triggers     = Object.entries(EX.destinyTrigger).map(([k, v]) => toOption(k, v));
    const scopes       = Object.entries(EX.destinyScope).map(([k, v]) => toOption(k, v));
    const durations    = Object.entries(EX.destinyDuration).map(([k, v]) => toOption(k, v));
    const frequencies  = Object.entries(EX.destinyFrequency).map(([k, v]) => toOption(k, v));

    const collegeEntry = EX.siderealColleges?.[sys.college];
    const collegeLabel = collegeEntry ? game.i18n.localize(collegeEntry.labelKey) : sys.college;

    const maidenEntry = sys.collegeMaiden ? EX.siderealMaidens?.[sys.collegeMaiden] : null;
    const maidenLabel = maidenEntry ? game.i18n.localize(maidenEntry) : sys.collegeMaiden;

    const providenceEntry = EX.destinyProvidence[sys.providence?.key];
    const providenceRequiresVirtue = !!providenceEntry?.requiresVirtue;

    return {
      ...context,
      item,
      system: sys,
      isEditable: this.isEditable,
      providences,
      triggers,
      scopes,
      durations,
      frequencies,
      collegeLabel,
      maidenLabel,
      providenceRequiresVirtue,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, { secrets: item.isOwner, relativeTo: item }
      ),
    };
  }

  static async #onFinalizeDestiny(_event, _target) {
    const item  = this.document;
    const sys   = item.system;
    const actor = item.parent;

    if (sys.finalized) return;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("EX2E.DestinyNoActor"));
      return;
    }

    const paradoxPool = Math.max(1, sys.paradoxDice);
    const roll = new ExaltedRoll({
      pool:      paradoxPool,
      flavor:    game.i18n.localize("EX2E.DestinyParadoxDice"),
      actorName: actor.name,
    });
    const result = await roll.evaluate();
    await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });

    const gained         = result.successes;
    const currentParadox = actor.system.splat?.sidereal?.paradox ?? 0;
    const newParadox     = Math.min(10, currentParadox + gained);

    await actor.update({ "system.splat.sidereal.paradox": newParadox });
    await item.update({ "system.finalized": true, "system.paradoxGained": gained });
  }
}
