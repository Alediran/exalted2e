import { editImageAction } from "../_edit-image.mjs";
import { moteCostString } from "../../rolls/activation-ledger.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class ComboSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "combo"],
    position: { width: 520, height: 560 },
    window:   { resizable: true },
    form:     { submitOnChange: true, closeOnSubmit: false },
    actions:  {
      editImage:   editImageAction,
      addCharm:    ComboSheet.#onAddCharm,
      removeCharm: ComboSheet.#onRemoveCharm,
      moveUp:      ComboSheet.#onMoveUp,
      moveDown:    ComboSheet.#onMoveDown
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header: { template: "systems/exalted2e/templates/item/combo/header.hbs" },
    body:   { template: "systems/exalted2e/templates/item/combo/body.hbs", scrollable: [".sheet-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;
    const actor   = item.actor;

    // Resolve each charmUid to an owned charm (by stable UID). Missing
    // UIDs get rendered as "broken" rows so the user can prune them.
    const byUid = new Map();
    if (actor) {
      for (const i of actor.items) {
        if (i.type !== "charm") continue;
        const uid = i.system?.charmUid;
        if (uid) byUid.set(uid, i);
      }
    }
    const rows = (sys.charmUids ?? []).map((uid, index) => {
      const charm = byUid.get(uid) ?? null;
      return {
        index,
        uid,
        resolved: !!charm,
        id:       charm?.id ?? "",
        name:     charm?.name ?? game.i18n.localize("EX2E.ComboBroken"),
        img:      charm?.img  ?? "icons/svg/hazard.svg",
        costMeta: charm ? this._charmCostMeta(charm) : ""
      };
    });

    return {
      ...context,
      item,
      system:      sys,
      rows,
      hasActor:    !!actor,
      isEditable:  this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description ?? "", {
        secrets: this.document.isOwner, relativeTo: this.document
      })
    };
  }

  /** One-line cost preview like `5m 1wp` for a resolved charm row. */
  _charmCostMeta(charm) {
    const c = charm.system?.cost ?? {};
    const parts = [];
    const mStr = moteCostString(c); if (mStr) parts.push(mStr);
    if (c.willpower)        parts.push(`+${c.willpower}wp`);
    if (c.bashingHealth)    parts.push(`${c.bashingHealth}b`);
    if (c.lethalHealth)     parts.push(`${c.lethalHealth}l`);
    if (c.aggravatedHealth) parts.push(`${c.aggravatedHealth}a`);
    if (c.xp)               parts.push(`${c.xp}xp`);
    return parts.join(" ");
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.isEditable) return;

    // Accept drops anywhere over the sheet body (description + charm list),
    // not just on a specific row.
    const dd = new foundry.applications.ux.DragDrop({
      dropSelector: ".combo-body",
      permissions:  { drop: () => this.isEditable },
      callbacks:    { drop: this._onDrop.bind(this) }
    });
    dd.bind(this.element);
  }

  // ── Combo-Basic / Form-type validation helpers ────────────────────────
  static #isReflexiveForCombo(charm) {
    return charm.system?.charmType === "reflexive" ||
           (charm.system?.keywords ?? []).includes("Combo-Basic");
  }

  static #isComboBasic(charm) {
    return (charm.system?.keywords ?? []).includes("Combo-Basic");
  }

  // Returns a localised error string, or null when the addition is legal.
  static #validateAdd(incoming, existing) {
    if (incoming.system?.charmType === "form" && existing.some(c => c.system?.charmType === "form"))
      return game.i18n.localize("EX2E.ComboOneFormType");
    if (ComboSheet.#isComboBasic(incoming) && existing.some(c => !ComboSheet.#isReflexiveForCombo(c)))
      return game.i18n.localize("EX2E.ComboBasicOnlyWithReflexive");
    if (!ComboSheet.#isReflexiveForCombo(incoming) && existing.some(c => ComboSheet.#isComboBasic(c)))
      return game.i18n.localize("EX2E.ComboBasicOnlyWithReflexive");
    return null;
  }

  // Resolve UIDs to charm items for validation.
  #existingCharms(actor) {
    return (this.document.system.charmUids ?? [])
      .map(uid => actor.items.find(i => i.type === "charm" && i.system?.charmUid === uid))
      .filter(Boolean);
  }

  async _onDrop(event) {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data?.type !== "Item") return;

    const dropped = await fromUuid(data.uuid);
    if (!dropped) return;

    if (dropped.type !== "charm") {
      ui.notifications.warn(game.i18n.localize("EX2E.ComboOnlyCharms"));
      return;
    }

    const actor = this.document.actor;
    if (!actor || dropped.actor?.id !== actor.id) {
      ui.notifications.warn(game.i18n.localize("EX2E.ComboDropFromSameActorOnly"));
      return;
    }

    const err = ComboSheet.#validateAdd(dropped, this.#existingCharms(actor));
    if (err) { ui.notifications.warn(err); return; }

    const uid = dropped.system?.charmUid;
    if (!uid) return;

    const existing      = this.document.system.charmUids  ?? [];
    const existingNames = this.document.system.charmNames ?? [];
    if (existing.includes(uid)) return;   // no-op on duplicate

    await this.document.update({
      "system.charmUids":  [...existing,      uid],
      "system.charmNames": [...existingNames, dropped.name ?? ""]
    });
  }

  static async #onAddCharm(event, target) {
    const actor = this.document.actor;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("EX2E.ComboUnownedPlaceholder"));
      return;
    }
    const existing      = new Set(this.document.system.charmUids ?? []);
    const existingItems = this.#existingCharms(actor);
    const candidates = actor.items
      .filter(i => i.type === "charm" && i.system?.charmUid && !existing.has(i.system.charmUid))
      .filter(i => !ComboSheet.#validateAdd(i, existingItems))
      .map(i => ({ uid: i.system.charmUid, name: i.name, img: i.img }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const { ComboCharmPickerDialog } = await import("../../dialogs/combo-charm-picker-dialog.mjs");
    const picked = await ComboCharmPickerDialog.prompt({ candidates });
    if (!picked?.length) return;

    // Resolve names from the candidates list so we can store them for
    // compendium-import remapping (see preCreateItem hook in exalted2e.mjs).
    const nameByUid    = new Map(candidates.map(c => [c.uid, c.name]));
    const pickedNames  = picked.map(uid => nameByUid.get(uid) ?? "");

    // Append — Foundry's array-element merge is unreliable, so clone and
    // rewrite the full array path (matches the pattern documented in
    // CLAUDE.md under "ArrayField updates").
    const next      = [...(this.document.system.charmUids  ?? []), ...picked];
    const nextNames = [...(this.document.system.charmNames ?? []), ...pickedNames];
    await this.document.update({ "system.charmUids": next, "system.charmNames": nextNames });
  }

  static async #onRemoveCharm(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(idx)) return;
    const next      = foundry.utils.deepClone(this.document.system.charmUids  ?? []);
    const nextNames = foundry.utils.deepClone(this.document.system.charmNames ?? []);
    next.splice(idx, 1);
    nextNames.splice(idx, 1);
    await this.document.update({ "system.charmUids": next, "system.charmNames": nextNames });
  }

  static async #onMoveUp(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(idx) || idx <= 0) return;
    const next      = foundry.utils.deepClone(this.document.system.charmUids  ?? []);
    const nextNames = foundry.utils.deepClone(this.document.system.charmNames ?? []);
    [next[idx - 1], next[idx]]           = [next[idx],      next[idx - 1]];
    [nextNames[idx - 1], nextNames[idx]] = [nextNames[idx], nextNames[idx - 1]];
    await this.document.update({ "system.charmUids": next, "system.charmNames": nextNames });
  }

  static async #onMoveDown(event, target) {
    const idx = parseInt(target.dataset.index);
    if (!Number.isFinite(idx)) return;
    const next      = foundry.utils.deepClone(this.document.system.charmUids  ?? []);
    const nextNames = foundry.utils.deepClone(this.document.system.charmNames ?? []);
    if (idx >= next.length - 1) return;
    [next[idx],      next[idx + 1]]      = [next[idx + 1],      next[idx]];
    [nextNames[idx], nextNames[idx + 1]] = [nextNames[idx + 1], nextNames[idx]];
    await this.document.update({ "system.charmUids": next, "system.charmNames": nextNames });
  }
}
