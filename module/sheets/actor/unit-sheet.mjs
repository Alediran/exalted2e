import { editImageAction } from "../_edit-image.mjs";

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return {
    ActorSheetV2:               sheets.ActorSheetV2,
    HandlebarsApplicationMixin: api.HandlebarsApplicationMixin
  };
})();

export class UnitSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "actor", "unit"],
    position: { width: 480, height: 620 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions: {
      onEditImage:    editImageAction,
      setMagnitude:   UnitSheet.#setMagnitude,
      clearCommander: UnitSheet.#clearCommander,
      declareAction:  UnitSheet.#declareAction
    }
  };

  static PARTS = {
    stats: { template: "systems/exalted2e/templates/actor/unit/unit-sheet.hbs", scrollable: [".unit-scroll-body"] }
  };

  get title() {
    return this.actor.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.system;

    const magnitudeDots = [];
    for (let n = sys.magnitude.max; n >= 1; n--) {
      magnitudeDots.push({
        n,
        filled:    n <= sys.magnitude.value,
        sizeLabel: game.i18n.localize(`EX2E.MagnitudeSize${n}`)
      });
    }

    const commander = sys.commanderActor ?? null;
    const healthPct = sys.health.max > 0
      ? Math.round((sys.health.value / sys.health.max) * 100)
      : 0;

    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    return {
      ...context,
      actor:       this.actor,
      system:      sys,
      isEditable:  this.isEditable,
      magnitudeDots,
      commanderName: commander?.name ?? null,
      commanderImg:  commander?.img  ?? null,
      healthPct,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.description, enrichOpts
      )
    };
  }

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data.type !== "Actor") return super._onDrop(event);
    const actor = await Actor.fromDropData(data);
    if (actor?.type === "character") {
      await this.actor.update({ "system.commanderActorId": actor.id });
    }
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
    const val      = (newValue === 1 && current === 1)
      ? min
      : Math.max(min, newValue);
    if (!name) return;
    this.document.update({ [name]: val });
  }

  static async #setMagnitude(event, target) {
    const n       = Number(target.dataset.value);
    const current = this.actor.system.magnitude.value;
    const newVal  = n <= current ? n - 1 : n;
    await this.actor.update({ "system.magnitude.value": Math.max(0, newVal) });
  }

  static async #clearCommander(_event, _target) {
    await this.actor.update({ "system.commanderActorId": "" });
  }

  static async #declareAction(_event, _target) {
    if (this.actor.system.isRouted) return;
    const { MassCombatActionDialog } = await import("../../apps/mass-combat-action-dialog.mjs");
    await MassCombatActionDialog.prompt({ unitActor: this.actor });
  }
}
