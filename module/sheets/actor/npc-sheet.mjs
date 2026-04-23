import { ExaltedRoll } from "../../rolls/exalted-roll.mjs";

const { ActorSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ActorSheetV2: sheets.ActorSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "actor", "npc"],
    position: { width: 580, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollPool:    NpcSheet.#onRollPool,
      applyDamage: NpcSheet.#onApplyDamage,
      healDamage:  NpcSheet.#onHealDamage,
      createItem:  NpcSheet.#onCreateItem,
      editItem:    NpcSheet.#onEditItem,
      deleteItem:  NpcSheet.#onDeleteItem
    }
  };

  get title() {
    return `${game.i18n.localize(this.actor.name)}`;
  }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/actor/npc/header.hbs" },
    body:   { template: "systems/exalted2e/templates/actor/npc/body.hbs",   scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor   = this.document;
    const sys     = actor.system;
    const charms  = actor.items.filter(i => i.type === "charm").sort((a,b) => a.name.localeCompare(b.name));

    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    return {
      ...context, actor, system: sys, charms, isEditable: this.isEditable,
      enrichedPowers: await TextEditor.enrichHTML(sys.powers, enrichOpts),
      enrichedNotes:  await TextEditor.enrichHTML(sys.notes, enrichOpts)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Dot clicks for NPC simple pools
    this.element.querySelectorAll(".dot-rating .dot").forEach(dot => {
      dot.addEventListener("click", (ev) => {
        if (!this.isEditable) return;
        const track = ev.currentTarget.closest(".dot-rating");
        const name  = track?.dataset.name;
        const val   = parseInt(ev.currentTarget.dataset.value);
        if (name) this.document.update({ [name]: val });
      });
    });
  }

  static async #onRollPool(event, target) {
    const pool     = parseInt(target.dataset.pool) || 1;
    const flavor   = target.dataset.flavor   ?? "";
    const category = target.dataset.category ?? "all";
    await ExaltedRoll.rollPool(this.document, { pool, flavor, category });
  }

  static async #onApplyDamage(event, target) {
    const type   = target.dataset.damageType ?? "lethal";
    const amount = parseInt(target.dataset.amount ?? 1);
    await this.document.applyDamage(amount, type);
  }

  static async #onHealDamage(event, target) {
    await this.document.healDamage(parseInt(target.dataset.amount ?? 1));
  }

  static async #onCreateItem(event, target) {
    const type = target.dataset.type ?? "charm";
    await Item.create({ name: `New ${type}`, type }, { parent: this.document });
  }

  static async #onEditItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    item?.sheet?.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) await item.delete();
  }
}
