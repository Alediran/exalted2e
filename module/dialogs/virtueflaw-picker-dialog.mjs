import { EX2E } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * VirtueFlawPickerDialog — lists every VirtueFlaw item from the world and
 * every Item compendium, filtered by exalt type and a free-text search.
 * Resolves with `{ uuid }` of the chosen entry, or null if cancelled.
 */
export class VirtueFlawPickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-virtueflaw-picker",
    tag:     "dialog",
    classes: ["exalted2e", "roll-dialog", "virtueflaw-picker"],
    position: { width: 520, height: 520 },
    window: {
      title:     "EX2E.SelectVirtueFlaw",
      resizable: true
    },
    actions: {
      selectEntry: VirtueFlawPickerDialog.#onSelectEntry,
      confirmPick: VirtueFlawPickerDialog.#onConfirm
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/virtueflaw-picker-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve   = resolve;
    this._resolved  = false;
    this._exaltType = options.exaltType ?? "solar";
    this._search    = "";
    this._entries   = [];
    this._selectedUuid = null;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!this._entriesLoaded) {
      this._entries = await VirtueFlawPickerDialog.#collectEntries();
      this._entriesLoaded = true;
    }

    const filtered = this._entries
      .filter(e => e.exaltType === this._exaltType)
      .filter(e => !this._search || e.name.toLowerCase().includes(this._search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...context,
      exaltType:      this._exaltType,
      search:         this._search,
      entries:        filtered.map(e => ({ ...e, selected: e.uuid === this._selectedUuid })),
      splatTypes:     Object.entries(EX2E.splatTypes).map(([k, v]) => ({ value: k, label: game.i18n.localize(v) })),
      virtueLabels:   Object.fromEntries(Object.entries(EX2E.virtues).map(([k, v]) => [k, game.i18n.localize(v)])),
      hasSelection:   this._selectedUuid !== null
    };
  }

  _onRender(context, options) {
    const el = this.element;
    el.querySelector("[name='exaltType']")?.addEventListener("change", (ev) => {
      this._exaltType    = ev.target.value;
      this._selectedUuid = null;
      this.render();
    });
    el.querySelector("[name='search']")?.addEventListener("input", (ev) => {
      this._search       = ev.target.value;
      this._selectedUuid = null;
      this.render();
    });
  }

  static #onSelectEntry(event, target) {
    this._selectedUuid = target.dataset.uuid ?? null;
    this.render();
  }

  static #onConfirm(event, target) {
    if (!this._selectedUuid) return;
    this._resolved = true;
    this._resolve({ uuid: this._selectedUuid });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new VirtueFlawPickerDialog(options, resolve);
      dialog.render({ force: true });
    });
  }

  /**
   * Gather all VirtueFlaw items from the world directory and every Item
   * compendium, returning a flat list of entry records.
   */
  static async #collectEntries() {
    const entries = [];

    // World items
    for (const item of game.items.filter(i => i.type === "virtueflaw")) {
      entries.push({
        uuid:       item.uuid,
        name:       item.name,
        img:        item.img,
        exaltType:  item.system.exaltType,
        baseVirtue: item.system.baseVirtue,
        source:     game.i18n.localize("EX2E.SourceWorld")
      });
    }

    // Compendium items
    for (const pack of game.packs.filter(p => p.metadata.type === "Item")) {
      const index = await pack.getIndex({ fields: ["type", "img", "system.exaltType", "system.baseVirtue"] });
      for (const entry of index) {
        if (entry.type !== "virtueflaw") continue;
        entries.push({
          uuid:       entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`,
          name:       entry.name,
          img:        entry.img,
          exaltType:  entry.system?.exaltType,
          baseVirtue: entry.system?.baseVirtue,
          source:     pack.metadata.label ?? pack.collection
        });
      }
    }

    return entries;
  }
}
