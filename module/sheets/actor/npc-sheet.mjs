import { ExaltedRoll } from "../../rolls/exalted-roll.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { ex2eCan } from "../../helpers/permissions.mjs";

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
      editImage:        editImageAction,
      rollPool:         NpcSheet.#onRollPool,
      applyDamage:      NpcSheet.#onApplyDamage,
      healDamage:       NpcSheet.#onHealDamage,
      createItem:       NpcSheet.#onCreateItem,
      editItem:         NpcSheet.#onEditItem,
      deleteItem:       NpcSheet.#onDeleteItem,
      rollSocialAttack: NpcSheet.#onRollSocialAttack,
      activateCombo:      NpcSheet.#onActivateCombo,
      togglePurchaseMode: NpcSheet.#onTogglePurchaseMode
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

    const combos = actor.items.filter(i => i.type === "combo").sort((a, b) => a.name.localeCompare(b.name));
    const byUid  = new Map();
    for (const c of charms) { const uid = c.system?.charmUid; if (uid) byUid.set(uid, c); }
    const comboRows = combos.map(combo => {
      const uids = combo.system?.charmUids ?? [];
      const resolved = []; let missingCount = 0;
      for (const uid of uids) { const c = byUid.get(uid); if (c) resolved.push(c); else missingCount++; }
      const prev = { motes: 0, willpower: 0, bashing: 0, lethal: 0, aggravated: 0 };
      for (const c of resolved) {
        const cost = c.system?.cost ?? {};
        prev.motes      += Number(cost.motes)            || 0;
        prev.willpower  += Number(cost.willpower)        || 0;
        prev.bashing    += Number(cost.bashingHealth)    || 0;
        prev.lethal     += Number(cost.lethalHealth)     || 0;
        prev.aggravated += Number(cost.aggravatedHealth) || 0;
      }
      const bits = [];
      if (prev.motes)      bits.push(`${prev.motes}m`);
      if (prev.willpower)  bits.push(`${prev.willpower}wp`);
      if (prev.bashing)    bits.push(`${prev.bashing}b`);
      if (prev.lethal)     bits.push(`${prev.lethal}l`);
      if (prev.aggravated) bits.push(`${prev.aggravated}a`);
      return {
        id: combo.id, name: combo.name, img: combo.img,
        iconStrip:   resolved.slice(0, 6).map(c => ({ id: c.id, name: c.name, img: c.img })),
        totalCount:  uids.length, missingCount,
        costPreview: bits.join(" "), canActivate: resolved.length > 0
      };
    });

    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    return {
      ...context, actor, system: sys, charms, combos: comboRows, isEditable: this.isEditable,
      enrichedPowers: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.powers, enrichOpts),
      enrichedNotes:  await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.notes, enrichOpts)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (ex2eCan("purchaseMode")) {
      const header   = this.element.querySelector(".window-header");
      const controls = header?.querySelector(".header-control");
      if (header && controls) {
        const locked = !!this.document.system.purchaseLocked;
        let btn = header.querySelector(".ex2e-purchase-toggle");
        if (!btn) {
          btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.action = "togglePurchaseMode";
          controls.before(btn);
        }
        btn.className = "header-control ex2e-purchase-toggle" + (locked ? " active" : "");
        btn.title = game.i18n.localize(locked ? "EX2E.PurchaseModeOn" : "EX2E.PurchaseModeOff");
        btn.innerHTML = `<i class="fa-solid ${locked ? "fa-lock" : "fa-lock-open"}"></i>`;
      }
    }
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

  static async #onTogglePurchaseMode() {
    if (!ex2eCan("purchaseMode")) return;
    const cur = this.document.system.purchaseLocked ?? false;
    await this.document.update({ "system.purchaseLocked": !cur });
  }

  static async #onActivateCombo(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item?.type === "combo") await item.activateCombo();
  }

  static async #onRollSocialAttack(event, target) {
    const { SocialAttackDialog } = await import("../../dialogs/social-attack-dialog.mjs");
    const { ExaltedRoll }        = await import("../../rolls/exalted-roll.mjs");

    let picked = game.user.targets.first()?.actor ?? null;
    if (!picked) {
      const { pickTargetActor } = await import("../../helpers/targeting.mjs");
      picked = await pickTargetActor();
      if (!picked) return;
    }

    const options = await SocialAttackDialog.prompt({ attacker: this.actor, target: picked });
    if (!options) return;

    await ExaltedRoll.rollSocialAttack(this.actor, options);
  }
}
