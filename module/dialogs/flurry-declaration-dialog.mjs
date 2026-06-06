import { EX2E } from "../config.mjs";
import { computeFlurryPreview, normalizeFlurryActions, effectiveModeRate, isModeOptionEnabled }
  from "../combat/flurry-math.mjs";

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
    // Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
    // miscomputes `left` when it writes through a native modal <dialog>
    // element that also has `height: "auto"`, which left the dialog
    // stuck off-axis. Using the standard Foundry window frame instead
    // gives us predictable, draggable positioning.
    classes:  ["exalted2e", "roll-dialog"],
    position: { width: 440, height: "auto" },
    window:   {
      title:        "EX2E.FlurryTitle",
      resizable:    false,
      minimizable:  false
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
   * one entry per (weapon, mode) the actor owns. A sheathed weapon's modes
   * are enabled if any row in the flurry is drawing that weapon — ordering
   * of actions doesn't matter; the flurry is a set.
   *
   * @param {Set<string>} [drawnIds]  Weapon IDs drawn by the current flurry.
   */
  _buildActionOptions(drawnIds = new Set()) {
    const isClinchController = game.combat?.combatants
      .find(c => c.actorId === this._actor?.id)
      ?.flags?.exalted2e?.clinch?.role === "controller";
    const core = EX2E.getActionList().filter(
      a => a.isFlurry && (!a.clinchOnly || isClinchController)
    );
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
          disabled: !w.system.equipped && !drawnIds.has(w.id)
        });
      });
    }
    return [...core, ...weaponOpts];
  }

  /** Set of weapon IDs every `draw` row in this._actions is targeting. */
  _collectDrawnIds() {
    const s = new Set();
    for (const a of this._actions) {
      if (a.actionKey === "draw" && a.weaponId) s.add(a.weaponId);
    }
    return s;
  }

  /**
   * If any row still points at a weapon-mode that is no longer available
   * (weapon got un-drawn, or was deleted), reset that row to the default
   * flurry action so the declaration stays internally consistent.
   */
  _normalizeActions(drawnIds) {
    const fallbackKey = defaultFlurryActionKey();
    const fallbackCfg = EX2E.actions[fallbackKey] ?? { speed: 5, dvMod: 0 };
    const equipById = {};
    for (const w of (this._actor?.items ?? [])) {
      if (w.type === "weapon") equipById[w.id] = { equipped: w.system.equipped };
    }
    this._actions = normalizeFlurryActions(
      this._actions, drawnIds, equipById,
      { key: fallbackKey, speed: fallbackCfg.speed, dvMod: fallbackCfg.dvMod }
    );
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
    // First normalize the in-memory action set against the current drawn
    // set — any row whose selected attack mode has gone unavailable (its
    // Draw was removed or retargeted) is reset to the default flurry
    // action. Do this before the options list is built so the rendered
    // `<select>` values match reality.
    const drawnIds = this._collectDrawnIds();
    this._normalizeActions(drawnIds);
    const n = this._actions.length;
    const isClinchController = game.combat?.combatants
      .find(c => c.actorId === this._actor?.id)
      ?.flags?.exalted2e?.clinch?.role === "controller";
    // Cache the computed lists so the dropdown-change handler can resolve
    // speed/dvMod for weapon-mode keys (which aren't in EX2E.actions).
    this._actionOptions     = this._buildActionOptions(drawnIds);
    this._unequippedWeapons = this._buildUnequippedWeapons();

    return {
      ...context,
      actorName:          this._actorName,
      actions:            this._actions,
      actionOptions:      this._actionOptions,
      unequippedWeapons:  this._unequippedWeapons,
      drawActionKey:      "draw",
      canRemove:          n > 2,
      isClinchController,
      // Live preview so the player sees what the flurry will cost before
      // committing to it. Recomputed in-place by `_updatePreview` as the
      // user edits rows.
      preview: this._computePreview()
    };
  }

  /**
   * Pure function over `this._actions`: returns the flurry's resolved
   * count / dice penalty / speed / DV penalty. Quick-draw flurries (a
   * Draw row paired with its weapon attack) use the MIN speed of the two
   * rows instead of the MAX — a Speed-5 Draw plus a Speed-5 Punch still
   * resolves on tick 5 rather than tick 10.
   */
  _computePreview() {
    return computeFlurryPreview(this._actions);
  }

  /**
   * Sync the live DOM back into `this._actions`, recompute the preview,
   * and patch the preview panel in place. Called on every input change
   * so speed / DV / quick-draw feedback stays current without a full
   * re-render (which would drop the user's focus / selection).
   */
  _updatePreview() {
    this._syncFromForm();
    const preview = this._computePreview();
    const form = this.element?.querySelector("form");
    const panel = form?.querySelector(".flurry-preview");
    if (!panel) return;
    const nodes = panel.querySelectorAll("[data-preview]");
    nodes.forEach(node => {
      const key = node.dataset.preview;
      const val = preview[key];
      if (val === undefined) return;
      // Keep the original "label: value" layout — only replace the numeric
      // tail (everything after the last whitespace) or the whole text if
      // no label is present.
      node.textContent = String(val);
    });
  }

  /**
   * Wire each action dropdown (repopulates the row's Speed + DV Mod and
   * toggles the Draw picker) and each Draw weapon picker (re-evaluates
   * cross-row availability). Both end in `_updateRowValidity`, which
   * updates disabled states and resets any row whose selection has gone
   * stale — all done in-place on the current DOM so the user's selection
   * doesn't get stomped by a concurrent re-render.
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
        const drawRow = idx !== undefined
          ? form.querySelector(`.flurry-draw-row[data-index='${idx}']`)
          : null;
        if (drawRow) drawRow.classList.toggle("hidden", key !== "draw");
        this._updateRowValidity();
        this._updatePreview();
      });
    });
    form.querySelectorAll(".flurry-draw-row [name$='.weaponId']").forEach(select => {
      select.addEventListener("change", () => {
        this._updateRowValidity();
        this._updatePreview();
      });
    });
    // Manual edits to per-row Speed / DV Mod should also refresh the
    // preview — a player might hand-tune either.
    form.querySelectorAll(".flurry-row[data-index] [name$='.speed'], .flurry-row[data-index] [name$='.dvMod']")
      .forEach(input => {
        input.addEventListener("input", () => this._updatePreview());
      });
    // Seed with one pass so any initial state (e.g. after add/remove) is
    // consistent with the current draw declarations.
    this._updateRowValidity();
    this._updatePreview();
  }

  /**
   * Sweep the live DOM: recompute which weapon IDs the flurry is drawing
   * and how many times each weapon-mode is being used, then toggle
   * `option.disabled` on every weapon-mode option accordingly. If any
   * row's currently-selected option has become disabled, reset that row
   * in-place to the default flurry action.
   *
   * A weapon-mode option is selectable in a given `<select>` iff:
   *   1) the weapon is currently equipped OR drawn somewhere in the flurry
   *   2) the OTHER rows in the flurry have used this mode fewer than
   *      `mode.effectiveRate` times (keeping Punch-rate-3 / Kick-rate-2
   *      style limits honoured)
   */
  _updateRowValidity() {
    const form = this.element?.querySelector("form");
    if (!form) return;
    const fallbackKey = defaultFlurryActionKey();
    const fallbackCfg = EX2E.actions[fallbackKey] ?? { speed: 5, dvMod: 0 };

    // Drawn weapons = every row whose action is "draw" with a picked weaponId.
    const drawnIds = new Set();
    // Usage count per weapon:<id>:<mode> key across every row in the flurry.
    const usage = new Map();
    form.querySelectorAll(".flurry-row[data-index]").forEach(row => {
      const k = row.querySelector("[name$='.actionKey']")?.value;
      if (k?.startsWith("weapon:")) {
        usage.set(k, (usage.get(k) ?? 0) + 1);
      }
      if (k === "draw") {
        const idx = row.dataset.index;
        const drawRow = form.querySelector(`.flurry-draw-row[data-index='${idx}']`);
        const wid = drawRow?.querySelector("[name$='.weaponId']")?.value;
        if (wid) drawnIds.add(wid);
      }
    });

    const charmRateBonus = this._computeCharmRateBonus();
    form.querySelectorAll(".flurry-row[data-index] [name$='.actionKey']").forEach(select => {
      const selectValue = select.value;
      // 1) Refresh disabled state on every weapon:<id>:<mode> option.
      select.querySelectorAll("option").forEach(opt => {
        const key = opt.value;
        if (!key || !key.startsWith("weapon:")) return;
        const [, wid, modeIdxStr] = key.split(":");
        const weapon = this._actor?.items.get(wid);
        if (!weapon) return;
        const mode = weapon.system.modes?.[parseInt(modeIdxStr)];
        const rate = effectiveModeRate(mode?.effectiveRate ?? mode?.rate, charmRateBonus);
        const total     = usage.get(key) ?? 0;
        // Count uses OTHER than this select's own current pick — lets the
        // row keep rendering its existing selection even when the mode is
        // fully spent across the flurry.
        const otherUses = (selectValue === key) ? total - 1 : total;
        opt.disabled = !isModeOptionEnabled(weapon.system.equipped, drawnIds.has(wid), otherUses, rate);
      });

      // 2) If the currently selected option is now disabled, reset the row.
      const current = select.options[select.selectedIndex];
      if (!current?.disabled) return;
      select.value = fallbackKey;
      const row        = select.closest(".flurry-row");
      const speedInput = row?.querySelector("[name$='.speed']");
      const dvInput    = row?.querySelector("[name$='.dvMod']");
      if (speedInput) speedInput.value = fallbackCfg.speed;
      if (dvInput)    dvInput.value    = fallbackCfg.dvMod;
      const idx = row?.dataset.index;
      const drawRow = idx !== undefined
        ? form.querySelector(`.flurry-draw-row[data-index='${idx}']`)
        : null;
      if (drawRow) drawRow.classList.toggle("hidden", fallbackKey !== "draw");
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
    // One source of truth — the confirmed flurry must match the preview.
    const { count, dicePenalty, speed, dvPenalty } = this._computePreview();
    
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

    // Enrich each action with the metadata the chat card / downstream
    // consumers need: attack actions carry weaponId + modeIndex so a chat
    // button can fire rollAttack; draw actions carry the drawn weapon's
    // name for display.
    const enrichedActions = this._actions.map(a => {
      const base = {
        actionKey: a.actionKey,
        name:      this._labelForActionKey(a.actionKey),
        speed:     a.speed,
        dvMod:     a.dvMod,
        weaponId:  a.weaponId ?? ""
      };
      if (a.actionKey?.startsWith("weapon:")) {
        const [, weaponId, modeIdxStr] = a.actionKey.split(":");
        return {
          ...base,
          isAttack:  true,
          weaponId,
          modeIndex: parseInt(modeIdxStr) || 0
        };
      }
      if (a.actionKey === "draw") {
        const weapon = a.weaponId ? this._actor?.items.get(a.weaponId) : null;
        return { ...base, isDraw: true, drawnWeaponName: weapon?.name ?? "" };
      }
      return base;
    });

    this._resolved = true;
    this._resolve({
      actions:  enrichedActions,
      actorId:   this._actor?.id ?? null,
      actorName: this._actor?.name ?? this._actorName,
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

  _computeCharmRateBonus() {
    return this._actor?.system?.bonuses?.rateBonus ?? 0;
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
