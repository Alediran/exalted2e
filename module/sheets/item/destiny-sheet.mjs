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
      donDestiny:       DestinySheet.#onDonDestiny,
      shuckDestiny:     DestinySheet.#onShuckDestiny,
      spendEndurance:   DestinySheet.#onSpendEndurance,
      restoreEndurance: DestinySheet.#onRestoreEndurance,
      rollDisguise:     DestinySheet.#onRollDisguise,
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
      isResplendent: sys.destinyType === "resplendent",
      worn:          !!sys.worn,
      colleges: Object.entries(EX.siderealColleges ?? {}).map(([k, v]) => ({
        value: k, label: game.i18n.localize(v.labelKey)
      })),
      destinyTypes: [
        { value: "ascending",   label: game.i18n.localize("EX2E.DestinyTypeAscending") },
        { value: "descending",  label: game.i18n.localize("EX2E.DestinyTypeDescending") },
        { value: "resplendent", label: game.i18n.localize("EX2E.DestinyTypeResplendent") },
      ],
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

  static async #onDonDestiny(_event, _target) {
    const item  = this.document;
    const actor = item.parent;
    if (!actor) { ui.notifications.warn(game.i18n.localize("EX2E.ResplendentNoActor")); return; }
    if (item.system.ended) { ui.notifications.warn(game.i18n.localize("EX2E.ResplendentAlreadyEnded")); return; }

    const { stampIdentityAE, removeIdentityAE } = await import("../../combat/resplendent-destiny.mjs");

    // One worn at a time: shuck any other worn resplendent destiny first.
    for (const other of actor.items) {
      if (other.id === item.id) continue;
      if (other.type === "destiny" && other.system.destinyType === "resplendent" && other.system.worn) {
        await other.update({ "system.worn": false });
        await removeIdentityAE(actor, other.id);
      }
    }

    // Donning costs 1 Willpower (Speed 3 — narrative).
    const wp = actor.system.willpower?.value ?? 0;
    await actor.update({ "system.willpower.value": Math.max(0, wp - 1) });

    await item.update({ "system.worn": true });
    await stampIdentityAE(item);

    const collegeLabel = game.i18n.localize(
      game.exalted2e.EX2E.siderealColleges?.[item.system.college]?.labelKey ?? item.system.college
    );
    await ChatMessage.create({
      content: game.i18n.format("EX2E.ResplendentDonChat",
        { actor: actor.name, identity: item.system.identity || item.name, college: collegeLabel }),
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }

  static async #onShuckDestiny(_event, _target) {
    const item  = this.document;
    const actor = item.parent;
    if (!actor) return;
    const { removeIdentityAE } = await import("../../combat/resplendent-destiny.mjs");
    await item.update({ "system.worn": false });
    await removeIdentityAE(actor, item.id);
    await ChatMessage.create({
      content: game.i18n.format("EX2E.ResplendentShuckChat",
        { actor: actor.name, identity: item.system.identity || item.name }),
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }

  static async #onSpendEndurance(_event, _target) {
    const cur = this.document.system.endurance?.value ?? 0;
    await this.document.update({ "system.endurance.value": Math.max(0, cur - 1) });
  }

  static async #onRestoreEndurance(_event, _target) {
    const sys  = this.document.system;
    const cur  = sys.endurance?.value ?? 0;
    const max  = sys.endurance?.max   ?? 0;
    const next = Math.min(max, cur + 1);
    const update = { "system.endurance.value": next };
    if (next > 0 && sys.ended) update["system.ended"] = false;
    await this.document.update(update);
  }

  static async #onRollDisguise(_event, _target) {
    const item  = this.document;
    const actor = item.parent;
    if (!actor) { ui.notifications.warn(game.i18n.localize("EX2E.ResplendentNoActor")); return; }
    const man = actor.system.attributes?.manipulation?.value ?? 0;
    const lar = actor.system.abilities?.larceny?.value       ?? 0;
    const roll = await new ExaltedRoll({
      pool:      Math.max(1, man + lar + 3),
      actorName: actor.name,
      flavor:    game.i18n.format("EX2E.ResplendentDisguiseFlavor", { identity: item.system.identity || item.name }),
    }).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  }
}
