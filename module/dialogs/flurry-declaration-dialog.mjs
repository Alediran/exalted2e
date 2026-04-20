import { EX2E } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Default action key seeded into new rows when the dialog opens. Resolved
 * lazily so edits to EX2E.actions don't require changing this constant —
 * the first action flagged `isFlurry: true` in config wins.
 */
function defaultFlurryActionKey() {
  const entry = Object.entries(EX2E.actions).find(([, a]) => a.isFlurry);
  return entry?.[0] ?? Object.keys(EX2E.actions)[0];
}

/**
 * FlurryDeclarationDialog — lets the active combatant lay out every action
 * they'll take this turn before rolling anything.
 *
 * Canon resolution once the flurry is declared:
 *   • Speed         = max(action.speed)
 *   • Dice penalty  = (N − 1) internal penalty applied to every roll
 *   • DV penalty    = max(action.dvMod) + (N − 1), stamped as an AE
 *
 * On confirm the dialog stamps the DV-penalty AE on the actor and writes a
 * flurry flag onto the combatant; the attack pipeline reads the dice penalty
 * from there, and Finish Turn uses the stored speed for the tick advance.
 */
export class FlurryDeclarationDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-flurry-declaration-dialog",
    tag:      "dialog",
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 440, height: "auto" },
    window:   {
      title:     "EX2E.FlurryTitle",
      resizable: false
    },
    actions: {
      addAction:    FlurryDeclarationDialog.#onAddAction,
      removeAction: FlurryDeclarationDialog.#onRemoveAction,
      confirm:      FlurryDeclarationDialog.#onConfirm,
      cancel:       FlurryDeclarationDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/flurry-declaration-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve   = resolve;
    this._resolved  = false;
    this._actor     = options.actor     ?? null;
    this._actorName = options.actorName ?? this._actor?.name ?? "";
    // Flurries need at least 2 actions; prime the UI with two Attack rows.
    this._actions = [this._rowFromAction(defaultFlurryActionKey()),
                     this._rowFromAction(defaultFlurryActionKey())];
  }

  /** Build a row seeded from a config action key. Speed/dvMod are overridable. */
  _rowFromAction(key) {
    const a = EX2E.actions[key] ?? EX2E.actions[defaultFlurryActionKey()] ?? { speed: 5, dvMod: 0 };
    return { actionKey: key, speed: a.speed, dvMod: a.dvMod, weaponId: "" };
  }

  /**
   * Compose the dropdown's option list: shared flurry-eligible actions plus
   * one entry per (weapon, mode) the actor owns. Sheathed-weapon modes are
   * emitted with `disabled: true` so they render greyed out.
   */
  _buildActionOptions() {
    const core = EX2E.getActionList().filter(a => a.isFlurry);
    const weaponOpts = [];
    for (const w of (this._actor?.items ?? [])) {
      if (w.type !== "weapon") continue;
      const modes = w.system.modes ?? [];
      modes.forEach((mode, idx) => {
        const label = modes.length > 1 ? `${w.name} — ${mode.name}` : w.name;
        weaponOpts.push({
          key:      `weapon:${w.id}:${idx}`,
          label,
          // Attack Speed for the mode; fall back to raw speed if derived isn't present.
          speed:    mode.effectiveSpeed ?? mode.speed ?? 5,
          // Attacks carry a baseline -1 DV penalty in this system — user can override per row.
          dvMod:    1,
          preset:   false,
          isFlurry: true,
          disabled: !w.system.equipped
        });
      });
    }
    return [...core, ...weaponOpts];
  }

  /**
   * Weapons eligible for the per-row "Draw" picker: owned weapons that are
   * not currently equipped, excluding the auto-generated Unarmed Attacks
   * (always available, nothing to draw).
   */
  _buildUnequippedWeapons() {
    const list = [];
    for (const w of (this._actor?.items ?? [])) {
      if (w.type !== "weapon") continue;
      if (w.system.equipped) continue;
      if (w.getFlag("exalted2e", "unarmed")) continue;
      list.push({ id: w.id, name: w.name });
    }
    return list;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const n = this._actions.length;
    // Cache the computed lists so the dropdown-change handler can resolve
    // speed/dvMod for weapon-mode keys (which aren't in EX2E.actions).
    this._actionOptions     = this._buildActionOptions();
    this._unequippedWeapons = this._buildUnequippedWeapons();
    return {
      ...context,
      actorName:         this._actorName,
      actions:           this._actions,
      actionOptions:     this._actionOptions,
      unequippedWeapons: this._unequippedWeapons,
      drawActionKey:     "draw",
      canRemove:         n > 2,
      // Live preview so the player sees what the flurry will cost before
      // committing to it.
      preview: {
        count:       n,
        dicePenalty: n - 1,
        speed:       this._actions.reduce((m, a) => Math.max(m, a.speed ?? 0), 0),
        dvPenalty:   this._actions.reduce((m, a) => Math.max(m, a.dvMod ?? 0), 0) + (n - 1)
      }
    };
  }

  /**
   * Wire the per-row action dropdown so picking a preset repopulates the
   * Speed and DV Mod inputs for that row and toggles the Draw-weapon picker.
   * Manual edits to either input are preserved until the dropdown changes
   * again.
   *
   * Also attaches a change listener to every Draw-row weapon picker so
   * declaring (or changing) a Draw target re-evaluates which weapon-mode
   * options are disabled across all rows — attack modes for a drawn weapon
   * become selectable in the same flurry regardless of action order.
   */
  _onRender(context, options) {
    const form = this.element.querySelector("form");
    if (!form) return;
    form.querySelectorAll(".flurry-row[data-index] [name$='.actionKey']").forEach(select => {
      select.addEventListener("change", (ev) => {
        const key = ev.currentTarget.value;
        const opt = this._actionOptions?.find(o => o.key === key);
        const row = ev.currentTarget.closest(".flurry-row");
        const idx = row?.dataset.index;
        if (opt) {
          const speedInput = row?.querySelector("[name$='.speed']");
          const dvInput    = row?.querySelector("[name$='.dvMod']");
          if (speedInput) speedInput.value = opt.speed;
          if (dvInput)    dvInput.value    = opt.dvMod;
        }
        // Toggle the Draw-weapon picker associated with this row.
        const drawRow = idx !== undefined
          ? form.querySelector(`.flurry-draw-row[data-index='${idx}']`)
          : null;
        if (drawRow) drawRow.classList.toggle("hidden", key !== "draw");
        // Changing an action key can add or remove a Draw (e.g. row switches
        // from "draw" to an attack mode), so re-evaluate disabled states.
        this._updateDisabledStates();
      });
    });
    form.querySelectorAll(".flurry-draw-row [name$='.weaponId']").forEach(select => {
      select.addEventListener("change", () => this._updateDisabledStates());
    });
    // Apply once on mount so any initial state is reflected (harmless no-op
    // for the default two-row state).
    this._updateDisabledStates();
  }

  /**
   * Reconcile the `disabled` attribute on every weapon-mode option across
   * the form: a weapon's modes are selectable when the weapon is currently
   * equipped OR some row in this same flurry declares a Draw for it.
   * Ordering of actions in the flurry does not matter — the flurry is a set.
   */
  _updateDisabledStates() {
    const form = this.element?.querySelector("form");
    if (!form) return;

    // Collect the weapon IDs being drawn in this flurry right now.
    const drawnIds = new Set();
    form.querySelectorAll(".flurry-row[data-index]").forEach(row => {
      const key = row.querySelector("[name$='.actionKey']")?.value;
      if (key !== "draw") return;
      const idx = row.dataset.index;
      const drawRow = form.querySelector(`.flurry-draw-row[data-index='${idx}']`);
      const wid = drawRow?.querySelector("[name$='.weaponId']")?.value;
      if (wid) drawnIds.add(wid);
    });

    // Toggle disabled on every weapon:<id>:<mode> option. Equipped weapons
    // stay enabled unconditionally; sheathed ones are enabled iff drawn.
    form.querySelectorAll(".flurry-row[data-index] [name$='.actionKey'] option").forEach(opt => {
      const key = opt.value;
      if (!key || !key.startsWith("weapon:")) return;
      const [, wid] = key.split(":");
      const weapon = this._actor?.items.get(wid);
      if (!weapon) return;
      const available = weapon.system.equipped || drawnIds.has(wid);
      opt.disabled = !available;
    });
  }

  /** Read every row's current input values back into the in-memory action list. */
  _syncFromForm() {
    const form = this.element.querySelector("form");
    if (!form) return;
    const rows = form.querySelectorAll(".flurry-row[data-index]");
    const next = [];
    rows.forEach((row) => {
      const idx = row.dataset.index;
      // Draw rows render their weapon picker as a sibling .flurry-draw-row;
      // only that sibling actually exists in the DOM, so look it up by index.
      const drawRow = idx !== undefined
        ? form.querySelector(`.flurry-draw-row[data-index='${idx}']`)
        : null;
      next.push({
        actionKey: row.querySelector("[name$='.actionKey']")?.value ?? defaultFlurryActionKey(),
        speed:     parseInt(row.querySelector("[name$='.speed']")?.value) || 0,
        dvMod:     parseInt(row.querySelector("[name$='.dvMod']")?.value) || 0,
        weaponId:  drawRow?.querySelector("[name$='.weaponId']")?.value ?? ""
      });
    });
    if (next.length > 0) this._actions = next;
  }

  static #onAddAction(event, target) {
    this._syncFromForm();
    this._actions.push(this._rowFromAction(defaultFlurryActionKey()));
    this.render();
  }

  static #onRemoveAction(event, target) {
    this._syncFromForm();
    if (this._actions.length <= 2) return;
    const idx = parseInt(target.dataset.index);
    if (Number.isFinite(idx)) this._actions.splice(idx, 1);
    this.render();
  }

  static async #onConfirm(event, target) {
    this._syncFromForm();
    if (this._actions.length < 2) {
      ui.notifications.warn(game.i18n.localize("EX2E.FlurryMinTwoActions"));
      return;
    }
    const count       = this._actions.length;
    const dicePenalty = count - 1;
    const speed       = this._actions.reduce((m, a) => Math.max(m, a.speed ?? 0), 0);
    const maxDvMod    = this._actions.reduce((m, a) => Math.max(m, a.dvMod ?? 0), 0);
    const dvPenalty   = maxDvMod + (count - 1);

    // Any Draw row with a selected weapon equips that weapon now. Doing it
    // at declaration lets the player roll attack actions later in the same
    // flurry against weapons they just drew.
    if (this._actor) {
      const drawnIds = new Set(
        this._actions
          .filter(a => a.actionKey === "draw" && a.weaponId)
          .map(a => a.weaponId)
      );
      const updates = [];
      for (const id of drawnIds) {
        const w = this._actor.items.get(id);
        if (w && !w.system.equipped) {
          updates.push({ _id: id, "system.equipped": true });
        }
      }
      if (updates.length > 0) {
        await this._actor.updateEmbeddedDocuments("Item", updates);
      }
    }

    this._resolved = true;
    this._resolve({
      // Preserve actionKey + any drawn weaponId so the flurry flag reads
      // naturally later (tooltips / audit logs / Finish Turn bookkeeping).
      actions: this._actions.map(a => ({
        actionKey: a.actionKey,
        name:      this._labelForActionKey(a.actionKey),
        speed:     a.speed,
        dvMod:     a.dvMod,
        weaponId:  a.weaponId ?? ""
      })),
      count, dicePenalty, speed, dvPenalty
    });
    this.close();
  }

  /**
   * Resolve a display label for any action key — core config entry, or a
   * `weapon:<id>:<modeIndex>` key pointing at one of the actor's weapon modes.
   */
  _labelForActionKey(key) {
    const cfg = EX2E.actions[key];
    if (cfg) return game.i18n.localize(cfg.labelKey);
    const opt = this._actionOptions?.find(o => o.key === key);
    return opt?.label ?? key;
  }

  static #onCancel(event, target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  /** @returns {Promise<null | {actions, count, dicePenalty, speed, dvPenalty}>} */
  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new FlurryDeclarationDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
