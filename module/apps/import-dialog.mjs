import {
  detectContentType,
  splitCharmBlocks,
  parseCharmBlock,
  parseWeaponBlock,
  parseArmorBlock,
  parseNpcBlock,
  charmToItemData,
  weaponToItemData,
  armorToItemData,
  npcToActorData,
} from "../helpers/text-importer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * ImportDialog – GM tool for creating Items (charms/weapons/armor) or NPC
 * Actors by pasting raw rulebook text.
 *
 * Open via:
 *   ImportDialog.open("item")   — from Items directory
 *   ImportDialog.open("actor")  — from Actors directory
 */
export class ImportDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @type {"item"|"actor"} */
  #mode;

  /** @type {object[]}  Parsed result objects waiting to be created */
  #parsed = [];

  /** @type {string|null}  Warning message from last parse attempt */
  #warning = null;

  constructor(mode = "item", options = {}) {
    super(options);
    this.#mode = mode;
  }

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "import-dialog"],
    position: { width: 640, height: "auto" },
    window:   { resizable: true },
    actions: {
      parseText:       ImportDialog.#onParseText,
      createDocuments: ImportDialog.#onCreateDocuments,
      clearResults:    ImportDialog.#onClearResults,
    },
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/import-dialog.hbs" },
  };

  get title() {
    const key = this.#mode === "actor" ? "EX2E.ImportNPCs" : "EX2E.ImportItems";
    return game.i18n.localize(key);
  }

  static open(mode = "item") {
    new ImportDialog(mode).render({ force: true });
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const EX  = game.exalted2e.EX2E;

    // Build character-type options for the charm import selector
    const exaltTypeOptions = Object.entries(EX.splatTypes ?? {})
      .filter(([k]) => k !== "martialarts")
      .map(([value, labelKey]) => ({ value, label: game.i18n.localize(labelKey) }));

    // Content-type options depend on mode
    const contentTypeOptions = this.#mode === "actor"
      ? [{ value: "npc",    label: game.i18n.localize("EX2E.ImportTypeNpc") }]
      : [
          { value: "auto",   label: game.i18n.localize("EX2E.ImportTypeAuto")   },
          { value: "charm",  label: game.i18n.localize("EX2E.ImportTypeCharm")  },
          { value: "weapon", label: game.i18n.localize("EX2E.ImportTypeWeapon") },
          { value: "armor",  label: game.i18n.localize("EX2E.ImportTypeArmor")  },
        ];

    return {
      ...ctx,
      mode:               this.#mode,
      isActorMode:        this.#mode === "actor",
      exaltTypeOptions,
      contentTypeOptions,
      parsed:             this.#parsed,
      parsedCount:        this.#parsed.length,
      warning:            this.#warning,
      createLabel:        this.#mode === "actor"
        ? game.i18n.format("EX2E.ImportCreateActors", { count: this.#parsed.length })
        : game.i18n.format("EX2E.ImportCreateItems",  { count: this.#parsed.length }),
    };
  }

  // ── Action Handlers ──────────────────────────────────────────────────────

  static async #onParseText(_event, _target) {
    this.#warning = null;
    this.#parsed  = [];

    const el          = this.element;
    const text        = el.querySelector("[name='pasteText']")?.value?.trim() ?? "";
    const contentType = el.querySelector("[name='contentType']")?.value ?? "auto";
    const exaltType   = el.querySelector("[name='exaltType']")?.value   ?? "solar";
    const source      = el.querySelector("[name='source']")?.value?.trim() ?? "";

    if (!text) {
      this.#warning = game.i18n.localize("EX2E.ImportNoText");
      return this.render();
    }

    const detected = contentType === "auto" ? detectContentType(text) : contentType;

    try {
      if (detected === "charm") {
        const blocks = splitCharmBlocks(text);
        if (!blocks.length) {
          // Fall back to treating the whole text as one block
          blocks.push(text);
        }
        this.#parsed = blocks
          .map(b => parseCharmBlock(b, exaltType))
          .filter(Boolean)
          .map(p => ({ ...p, exaltType, source: source || p.source }));

      } else if (detected === "weapon") {
        const p = parseWeaponBlock(text);
        if (p) this.#parsed = [p];

      } else if (detected === "armor") {
        const p = parseArmorBlock(text);
        if (p) this.#parsed = [p];

      } else if (detected === "npc") {
        const p = parseNpcBlock(text);
        if (p) this.#parsed = [p];

      } else {
        this.#warning = game.i18n.localize("EX2E.ImportUnknownType");
      }

      if (!this.#parsed.length && !this.#warning) {
        this.#warning = game.i18n.localize("EX2E.ImportParseEmpty");
      }
    } catch (err) {
      this.#warning = game.i18n.format("EX2E.ImportParseError", { error: err.message });
      console.error("ImportDialog | parse error:", err);
    }

    this.render();
  }

  static async #onCreateDocuments(_event, _target) {
    if (!this.#parsed.length) return;

    try {
      if (this.#mode === "actor") {
        const dataArr = this.#parsed.map(npcToActorData);
        const created = await Actor.create(dataArr);
        const count   = Array.isArray(created) ? created.length : 1;
        ui.notifications.info(game.i18n.format("EX2E.ImportCreatedActors", { count }));
      } else {
        const dataArr = this.#parsed.map(p => {
          if (p._importType === "weapon") return weaponToItemData(p);
          if (p._importType === "armor")  return armorToItemData(p);
          return charmToItemData(p);
        });
        const created = await Item.create(dataArr);
        const count   = Array.isArray(created) ? created.length : 1;
        ui.notifications.info(game.i18n.format("EX2E.ImportCreatedItems", { count }));
      }

      this.#parsed  = [];
      this.#warning = null;
      this.element.querySelector("[name='pasteText']").value = "";
      this.render();
    } catch (err) {
      ui.notifications.error(game.i18n.format("EX2E.ImportCreateError", { error: err.message }));
      console.error("ImportDialog | create error:", err);
    }
  }

  static #onClearResults(_event, _target) {
    this.#parsed  = [];
    this.#warning = null;
    this.render();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Restore textarea content across re-renders (re-renders clear the input)
    const textarea = this.element.querySelector("[name='pasteText']");
    if (textarea && this._savedText) textarea.value = this._savedText;

    textarea?.addEventListener("input", e => { this._savedText = e.target.value; });

    // Show/hide charm-specific controls based on content type selector
    const ctSelect = this.element.querySelector("[name='contentType']");
    const charmOnly = this.element.querySelectorAll(".charm-only");
    const updateCharmVisibility = () => {
      const isCharm = !ctSelect || ctSelect.value === "charm" || ctSelect.value === "auto";
      charmOnly.forEach(el => { el.style.display = isCharm ? "" : "none"; });
    };
    ctSelect?.addEventListener("change", updateCharmVisibility);
    updateCharmVisibility();
  }
}
