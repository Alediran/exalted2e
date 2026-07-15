import { ExaltedRoll } from "../../rolls/exalted-roll.mjs";
import { itemDescription } from "../../helpers/localize-description.mjs";
import { editImageAction } from "../_edit-image.mjs";
import { ex2eCan } from "../../helpers/permissions.mjs";
import { parseCostFormula } from "../../rolls/activation-ledger.mjs";
import { resolveNewDotValue } from "../../helpers/dot-rating.mjs";

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
      onEditImage:      editImageAction,
      rollPool:         NpcSheet.#onRollPool,
      applyDamage:      NpcSheet.#onApplyDamage,
      healDamage:       NpcSheet.#onHealDamage,
      createItem:       NpcSheet.#onCreateItem,
      editItem:         NpcSheet.#onEditItem,
      deleteItem:       NpcSheet.#onDeleteItem,
      rollSocialAttack: NpcSheet.#onRollSocialAttack,
      activateCombo:      NpcSheet.#onActivateCombo,
      togglePurchaseMode: NpcSheet.#onTogglePurchaseMode,
      sendItemToChat:     NpcSheet.#onSendItemToChat,
      activateCharm:      NpcSheet.#onActivateCharm,
      addAttack:          NpcSheet.#onAddAttack,
      deleteAttack:       NpcSheet.#onDeleteAttack,
      rollNpcAttack:      NpcSheet.#onRollNpcAttack,
      openCharmTree:      NpcSheet.#onOpenCharmTree
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
        const cost   = c.system?.cost ?? {};
        const parsed = parseCostFormula(cost.formula ?? "") ?? {};
        prev.motes      += parsed.motes           ?? 0;
        prev.willpower  += parsed.willpower        ?? 0;
        prev.bashing    += parsed.bashingHealth    ?? 0;
        prev.lethal     += parsed.lethalHealth     ?? 0;
        prev.aggravated += parsed.aggravatedHealth ?? 0;
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

    let extraHealthLevels = null;
    if (sys.isExtra) {
      const agg  = Math.min(sys.health.aggravated ?? 0, 3);
      const let_ = Math.min(sys.health.lethal     ?? 0, 3 - agg);
      const bash = Math.min(sys.health.bashing    ?? 0, 3 - agg - let_);
      const total = agg + let_ + bash;
      const cls  = i => i < agg ? "aggravated" : i < agg + let_ ? "lethal" : i < total ? "bashing" : "empty";
      const mark = c => c === "aggravated" ? "X" : c === "lethal" ? "/" : c === "bashing" ? "\\" : "";
      const box  = i => { const c = cls(i); return { dmgClass: c, mark: mark(c) }; };
      const incCls = total >= 3 ? cls(2) : "empty";
      extraHealthLevels = [
        { label: "-0",  ...box(0) },
        { label: "-1",  ...box(1) },
        { label: "-3",  ...box(2) },
        { label: "Inc", dmgClass: incCls, mark: mark(incCls) }
      ];
    }

    const cap = k => k.charAt(0).toUpperCase() + k.slice(1);
    const attributeGroups = [
      { labelKey: "EX2E.AttrGroupPhysical", keys: ["strength", "dexterity", "stamina"] },
      { labelKey: "EX2E.AttrGroupSocial",   keys: ["charisma", "manipulation", "appearance"] },
      { labelKey: "EX2E.AttrGroupMental",   keys: ["perception", "intelligence", "wits"] }
    ].map(g => ({
      labelKey: g.labelKey,
      attrs: g.keys.map(k => ({
        key: k,
        name: `system.attributes.${k}.value`,
        labelKey: `EX2E.Attr${cap(k)}`,
        value: sys.attributes?.[k]?.value ?? 1
      }))
    }));

    const abilityColumns = [
      ["archery", "athletics", "awareness", "bureaucracy", "craft", "dodge", "integrity", "investigation", "larceny"],
      ["linguistics", "lore", "martialArts", "medicine", "melee", "occult", "performance", "presence"],
      ["resistance", "ride", "sail", "socialize", "stealth", "survival", "thrown", "war"]
    ].map(keys => keys.map(k => ({
      key: k,
      name: `system.abilities.${k}.value`,
      labelKey: `EX2E.Ability${cap(k)}`,
      value: sys.abilities?.[k]?.value ?? 0
    })));

    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    return {
      ...context, actor, system: sys, charms, combos: comboRows, isEditable: this.isEditable,
      isExtra: sys.isExtra,
      attributeGroups, abilityColumns, extraHealthLevels,
      enrichedPowers:    await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.powers,    enrichOpts),
      enrichedNotes:     await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.notes,     enrichOpts),
      enrichedBiography: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.biography, enrichOpts)
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

    // Box clicks (willpower temporal track)
    this.element.querySelectorAll(".box-rating .box").forEach(box => {
      box.addEventListener("click", (ev) => {
        if (!this.isEditable) return;
        const track   = ev.currentTarget.closest(".box-rating");
        const name    = track?.dataset.name;
        const newVal  = parseInt(ev.currentTarget.dataset.value);
        const min     = parseInt(track?.dataset.min  ?? 0);
        const current = parseInt(track?.dataset.current ?? 0);
        if (name) this.document.update({ [name]: resolveNewDotValue(newVal, current, min) });
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

  static async #onSendItemToChat(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    const enrichOpts = { secrets: this.document.isOwner, relativeTo: this.document };
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const powers     = item.system.powers     ? await TextEditor.enrichHTML(item.system.powers,     enrichOpts) : "";
    const desc       = item.system.description ? await TextEditor.enrichHTML(itemDescription(item), enrichOpts) : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<h2>${item.name}</h2>${powers}${desc}`,
      flags:   { exalted2e: { itemId: item.id, actorId: this.document.id } }
    });
  }

  static async #onActivateCharm(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item?.type === "charm") await item.activateCharm();
  }

  static async #onAddAttack() {
    const attacks = foundry.utils.deepClone(this.document.system.attacks ?? []);
    attacks.push({ name: "Attack", pool: 5, damage: "5L", speed: 5, rate: 1 });
    await this.document.update({ "system.attacks": attacks });
  }

  static async #onDeleteAttack(event, target) {
    const idx = parseInt(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (isNaN(idx)) return;
    const attacks = foundry.utils.deepClone(this.document.system.attacks ?? []);
    attacks.splice(idx, 1);
    await this.document.update({ "system.attacks": attacks });
  }

  static async #onRollNpcAttack(event, target) {
    const idx = parseInt(target.closest("[data-attack-index]")?.dataset.attackIndex);
    if (isNaN(idx)) return;
    await ExaltedRoll.rollNpcAttack(this.document, idx);
  }

  static #onOpenCharmTree(event, target) {
    const { CharmTreeDialog } = game.exalted2e;
    CharmTreeDialog.open({ actor: this.actor });
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

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop(event);

    const item = await Item.fromDropData(data);
    if (!item) return;

    const sourceActor = item.parent instanceof Actor ? item.parent : null;

    if (!sourceActor || sourceActor.uuid === this.actor.uuid) return super._onDrop(event);

    const TRANSFERABLE = new Set(["weapon", "armor", "background", "meritflaw"]);
    if (!TRANSFERABLE.has(item.type)) {
      ui.notifications.warn(game.i18n.localize("EX2E.ItemNotTransferable"));
      return false;
    }

    if (!sourceActor.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("EX2E.ItemTransferNoPermission"));
      return false;
    }

    const itemData = item.toObject();
    delete itemData._id;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!created) return false;

    await item.delete();
    return created;
  }
}
