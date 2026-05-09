import { EX2E } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GmRollPoolDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:       "ex2e-gm-roll-pool-dialog",
    classes:  ["exalted2e", "roll-dialog", "gm-roll-pool-dialog"],
    position: { width: 540, height: "auto" },
    window:   {
      title:       "EX2E.GmRollPool",
      resizable:   false,
      minimizable: false
    },
    actions: {
      confirm: GmRollPoolDialog.#onConfirm,
      cancel:  GmRollPoolDialog.#onCancel
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/gm-roll-pool.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._description = options.description ?? "";
    this._difficulty  = options.difficulty  ?? 1;
    // Populated during _prepareContext so #onConfirm can build trait labels.
    this._traitLabelMap = {};
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const attributeGroups = Object.entries(EX2E.attributes).map(([group, attrs]) => ({
      groupKey: group,
      label:    game.i18n.localize(`EX2E.PenaltyCat${group.charAt(0).toUpperCase() + group.slice(1)}`),
      attrs:    Object.entries(attrs).map(([key, labelKey]) => ({
        key,
        label: game.i18n.localize(labelKey)
      }))
    }));

    const abilityOptions = EX2E.abilities.map(key => ({
      key,
      label: game.i18n.localize(EX2E.abilityLabels[key] ?? key)
    }));

    const miscOptions = [
      { key: "essence",   label: game.i18n.localize("EX2E.Essence") },
      { key: "willpower", label: game.i18n.localize("EX2E.Willpower") },
      ...Object.entries(EX2E.virtues).map(([key, lk]) => ({ key, label: game.i18n.localize(lk) }))
    ];

    // Build label lookup for #onConfirm.
    this._traitLabelMap = Object.fromEntries([
      ...attributeGroups.flatMap(g => g.attrs),
      ...abilityOptions,
      ...miscOptions
    ].map(o => [o.key, o.label]));

    return {
      ...context,
      description:     this._description,
      difficulty:      this._difficulty,
      attributeGroups,
      abilityOptions,
      miscOptions
    };
  }

  static async #onConfirm(event, target) {
    const form = this.element?.querySelector("form");
    if (!form) return;

    const fd          = new foundry.applications.ux.FormDataExtended(form);
    const description = String(fd.object.description ?? "").trim();
    const difficulty  = Math.max(1, Number(fd.object.difficulty ?? 1));

    const traits = Array.from(
      form.querySelectorAll("input[name='traits']:checked")
    ).map(cb => cb.value);

    if (traits.length === 0) {
      ui.notifications.warn(game.i18n.localize("EX2E.GmRollNoTraits"));
      return;
    }

    const traitLabels = traits.map(t => this._traitLabelMap[t] ?? t);
    const traitList   = traitLabels.join(" + ");

    const cardData = { description, traits, traitLabels, traitList, difficulty, rolls: [] };

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/gm-roll-pool-card.hbs",
      cardData
    );

    await ChatMessage.create({
      content,
      flags:   { exalted2e: { gmRollPool: cardData } },
      speaker: ChatMessage.getSpeaker({ user: game.user })
    });

    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  static #onCancel(event, target) {
    this._resolved = true;
    this._resolve(null);
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new GmRollPoolDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}

/**
 * Given an actor and a trait key array, sum the relevant stat values.
 * Attributes and abilities use `.value`; essence uses `.value`; willpower
 * uses `.max` (permanent rating); virtues use `.value`.
 */
export function computeGmRollPool(actor, traits) {
  const sys = actor.system;
  let pool = 0;
  for (const t of traits) {
    if      (sys.attributes?.[t] !== undefined) pool += Number(sys.attributes[t].value)   || 0;
    else if (sys.abilities?.[t]  !== undefined) pool += Number(sys.abilities[t].value)    || 0;
    else if (t === "essence")                   pool += Number(sys.essence?.value ?? sys.essence) || 0;
    else if (t === "willpower")                 pool += Number(sys.willpower?.max)         || 0;
    else if (sys.virtues?.[t]    !== undefined) pool += Number(sys.virtues[t].value)       || 0;
  }
  return pool;
}
