import { EX2E, getAnimaPalette } from "../config.mjs";
import { scaleTmfxParams, makeFilterParamsKey } from "../helpers/anima-fx-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const EFFECT_TIERS = ["burning", "bonfire", "totemic"];
const DEFAULT_GLOW   = { burning: "none",  bonfire: "pulse", totemic: "pulse" };
const DEFAULT_LIGHT  = { burning: "none",  bonfire: "pulse", totemic: "pulse" };
const TIER_STRENGTH  = { burning: 0.8,     bonfire: 1.0,     totemic: 1.3    };

async function _deleteAnimaFilters(token) {
  const stored = token.document.getFlag("tokenmagic", "filters") ?? [];
  const ids = [...new Set(
    stored.map(f => f.tmFilters?.tmFilterId).filter(id => id?.startsWith("exalted2e-anima"))
  )];
  for (const id of ids) {
    await TokenMagic.deleteFilters(token, id);
  }
}

async function _addAnimaFilters(token, params) {
  for (let i = 0; i < params.length; i++) {
    await TokenMagic.addFilters(token, [{ ...params[i], filterId: `exalted2e-anima-${i}` }]);
  }
}

export class AnimaColorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: { title: "EX2E.AnimaColorDialogTitle" },
    position: { width: 480 },
    actions: {
      assignSlot:     AnimaColorDialog.#onAssignSlot,
      clearSlot:      AnimaColorDialog.#onClearSlot,
      confirm:        AnimaColorDialog.#onConfirm,
      cancel:         AnimaColorDialog.#onCancel,
      editTmfxPreset: AnimaColorDialog.#onEditTmfxPreset
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/anima-color-dialog.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this._actor       = options.actor;
    this._slots       = [...(this._actor.getFlag("exalted2e", "animaColors")        ?? [null, null, null])];
    this._effects     = { ...DEFAULT_GLOW,  ...(this._actor.getFlag("exalted2e", "animaEffects")      ?? {}) };
    this._lights      = { ...DEFAULT_LIGHT, ...(this._actor.getFlag("exalted2e", "animaLightEffects") ?? {}) };
    this._tmfxActive  = game.modules.get("tokenmagic")?.active === true;
    this._tmfxPresets = {
      burning: "none", bonfire: "none", totemic: "none",
      ...(this._actor.getFlag("exalted2e", "animaTmfxPresets") ?? {})
    };
    this._tmfxCustomParams = {
      burning: null, bonfire: null, totemic: null,
      ...(this._actor.getFlag("exalted2e", "animaTmfxCustomParams") ?? {})
    };
    this._tmfxSnapshotFilters = null;
    this._tmfxEditorHookId    = null;
    this._lastEditedTier      = null;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const palette = getAnimaPalette(this._actor);
    const slots   = this._slots;

    const paletteEntries = palette.map(entry => ({
      ...entry,
      slotIndex: slots.indexOf(entry.hex)
    }));

    const glowOptions = Object.entries(EX2E.animaEffects)
      .map(([value, label]) => ({ value, label }));

    const lightOptions = [
      { value: "none", label: "EX2E.AnimaEffectNone" },
      ...Object.entries(CONFIG.Canvas.lightAnimations ?? {})
        .map(([key, def]) => ({ value: key, label: def.label }))
    ];

    let tmfxOptions = null;
    if (this._tmfxActive) {
      const presets = TokenMagic.getPresets() ?? [];
      const sorted  = [...presets].sort((a, b) => a.name.localeCompare(b.name));
      tmfxOptions = [
        { value: "none", label: game.i18n.localize("EX2E.AnimaEffectNone") },
        ...sorted.map(p => ({ value: p.name, label: p.name }))
      ];
    }

    const effectTiers = EFFECT_TIERS.map(tier => ({
      tier,
      label:           EX2E.anima[tier],
      currentGlow:     this._effects[tier]          ?? DEFAULT_GLOW[tier],
      currentLight:    this._lights[tier]           ?? DEFAULT_LIGHT[tier],
      currentTmfx:     this._tmfxPresets[tier]      ?? "none",
      hasCustomParams: this._tmfxCustomParams[tier] !== null
    }));

    return {
      ...ctx,
      slots: [...slots],
      palette: paletteEntries,
      glowOptions,
      lightOptions,
      tmfxActive:  this._tmfxActive,
      tmfxOptions,
      effectTiers,
      hasToken: this._hasTokenOnScene()
    };
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    htmlElement.querySelectorAll("select.acd-effect-select").forEach(sel => {
      sel.addEventListener("change", ev => {
        this._effects[ev.currentTarget.dataset.tier] = ev.currentTarget.value;
      });
    });
    htmlElement.querySelectorAll("select.acd-light-select").forEach(sel => {
      sel.addEventListener("change", ev => {
        this._lights[ev.currentTarget.dataset.tier] = ev.currentTarget.value;
      });
    });
    htmlElement.querySelectorAll("select.acd-tmfx-select").forEach(sel => {
      sel.addEventListener("change", ev => {
        const tier = ev.currentTarget.dataset.tier;
        this._tmfxPresets[tier]      = ev.currentTarget.value;
        this._tmfxCustomParams[tier] = null;
        this.render();
      });
    });
  }

  _hasTokenOnScene() {
    return canvas.tokens?.placeables.some(t => t.actor?.id === this._actor.id) ?? false;
  }

  _getActorToken() {
    return canvas.tokens?.placeables.find(t => t.actor?.id === this._actor.id) ?? null;
  }

  static #onAssignSlot(_event, target) {
    const hex = target.dataset.hex;
    if (!hex) return;
    const firstEmpty = this._slots.indexOf(null);
    if (firstEmpty === -1) return;
    if (this._slots.includes(hex)) return;
    this._slots[firstEmpty] = hex;
    this.render();
  }

  static #onClearSlot(_event, target) {
    const index = Number(target.dataset.index);
    if (isNaN(index) || index < 0 || index > 2) return;
    this._slots[index] = null;
    const filled = this._slots.filter(s => s !== null);
    this._slots = [...filled, ...Array(3 - filled.length).fill(null)];
    this.render();
  }

  static async #onEditTmfxPreset(_event, target) {
    const tier  = target.dataset.tier;
    const token = this._getActorToken();
    if (!token) return;

    this._lastEditedTier = tier;

    if (this._tmfxEditorHookId !== null) {
      Hooks.off("closeApplication", this._tmfxEditorHookId);
      this._tmfxEditorHookId = null;
    }

    if (!this._tmfxSnapshotFilters) {
      const stored = token.document.getFlag("tokenmagic", "filters") ?? [];
      this._tmfxSnapshotFilters = stored
        .filter(f => f.tmFilters?.tmFilterId?.startsWith("exalted2e-anima") && f.tmFilters?.tmParams != null)
        .map(f => ({ ...f.tmFilters.tmParams, filterId: "exalted2e-anima" }));
    }

    await _deleteAnimaFilters(token);
    const customParams = this._tmfxCustomParams[tier];
    if (customParams?.length) {
      await _addAnimaFilters(token, customParams);
    } else {
      const presetName = this._tmfxPresets[tier] ?? "none";
      if (presetName !== "none") {
        const params = TokenMagic.getPreset(presetName);
        if (params) {
          const scalar = TIER_STRENGTH[tier] ?? 1.0;
          const scaledParams = scaleTmfxParams(params, scalar);
          await _addAnimaFilters(token, scaledParams);
        }
      }
    }

    const beforeIds = new Set(
      (token.document.getFlag("tokenmagic", "filters") ?? [])
        .map(f => f.tmFilters?.tmFilterInternalId)
        .filter(Boolean)
    );

    TokenMagic.filterEditor(token);
    const TRANSIENT = new Set(["tmFilterInternalId", "tmFilterOwner", "tmOrigin", "tmRemove", "tmHide"]);
    const hookId = Hooks.on("closeApplication", async (app) => {
      const appName = app.constructor?.name ?? "";
      if (appName !== "FilterSelector" && appName !== "FilterEditor") return;
      Hooks.off("closeApplication", hookId);
      this._tmfxEditorHookId = null;
      const allFilters = token.document.getFlag("tokenmagic", "filters") ?? [];

      const ownFilters = allFilters.filter(f =>
        f.tmFilters?.tmFilterId?.startsWith("exalted2e-anima") && f.tmFilters?.tmParams != null
      );

      const makeParamsKey = (p) => makeFilterParamsKey(p, TRANSIENT);
      const seenKeys = new Set();
      const userFilters = allFilters.filter(f => {
        if (beforeIds.has(f.tmFilters?.tmFilterInternalId)) return false;
        if (f.tmFilters?.tmFilterId?.startsWith("exalted2e-anima")) return false;
        if (!f.tmFilters?.tmParams) return false;
        const key = makeParamsKey(f.tmFilters.tmParams);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      const captured = [...ownFilters, ...userFilters].map(f => {
        const out = { ...f.tmFilters.tmParams, filterId: "exalted2e-anima" };
        TRANSIENT.forEach(k => delete out[k]);
        return out;
      });
      this._tmfxCustomParams[tier] = captured.length ? captured : null;
      if (this.rendered) this.render();
    });
    this._tmfxEditorHookId = hookId;
  }

  async _onClose(options) {
    if (this._tmfxEditorHookId !== null) {
      Hooks.off("closeApplication", this._tmfxEditorHookId);
      this._tmfxEditorHookId = null;
    }
    await super._onClose(options);
  }

  static async #onConfirm() {
    await this._actor.setFlag("exalted2e", "animaColors", this._slots);
    if (this._tmfxActive) {
      // Fallback: hook may miss if TMFX editor class name is unexpected — read token directly.
      if (this._lastEditedTier !== null && this._tmfxCustomParams[this._lastEditedTier] === null) {
        const token = this._getActorToken();
        if (token) {
          const stored = token.document.getFlag("tokenmagic", "filters") ?? [];
          const TRANSIENT = ["tmFilterInternalId","tmFilterOwner","tmOrigin","tmRemove","tmHide"];
          const captured = stored
            .filter(f => f.tmFilters?.tmFilterId?.startsWith("exalted2e-anima") && f.tmFilters?.tmParams != null)
            .map(f => {
              const out = { ...f.tmFilters.tmParams, filterId: "exalted2e-anima" };
              TRANSIENT.forEach(k => delete out[k]);
              return out;
            });
          if (captured.length) this._tmfxCustomParams[this._lastEditedTier] = captured;
        }
      }
      await this._actor.setFlag("exalted2e", "animaTmfxPresets",      this._tmfxPresets);
      await this._actor.setFlag("exalted2e", "animaTmfxCustomParams", this._tmfxCustomParams);
    } else {
      await this._actor.setFlag("exalted2e", "animaEffects",      this._effects);
      await this._actor.setFlag("exalted2e", "animaLightEffects", this._lights);
    }
    this.close();
  }

  static async #onCancel() {
    if (this._tmfxSnapshotFilters !== null) {
      const token = this._getActorToken();
      if (token) {
        try {
          await _deleteAnimaFilters(token);
          if (this._tmfxSnapshotFilters.length) {
            await _addAnimaFilters(token, this._tmfxSnapshotFilters);
          }
        } catch (err) {
          console.error("exalted2e | Failed to restore TMFX filters on cancel:", err);
        }
      }
    }
    this.close();
  }

  static open(actor) {
    if (!actor) return;
    new AnimaColorDialog({ actor, id: `ex2e-anima-color-${actor.id}` }).render(true);
  }
}
