const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * SocialAttackDialog — Collects social attack configuration.
 * Used by ExaltedRoll.rollSocialAttack().
 */
export class SocialAttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-social-attack-dialog",
    // Intentionally NOT `tag: "dialog"`. ApplicationV2's position code
    // miscomputes `left` when it writes through a native modal <dialog>
    // element that also has `height: "auto"`, leaving the window stuck
    // off-axis. Using the standard Foundry window frame gives us
    // predictable, draggable positioning.
    classes: ["exalted2e", "roll-dialog", "social-attack-dialog"],
    position: { width: 420, height: "auto" },
    window: {
      title:        "EX2E.SocialAttackTitle",
      resizable:    false,
      minimizable:  false
    },
    actions: {
      confirmSocialAttack: SocialAttackDialog.#onConfirm,
      pickTarget:          SocialAttackDialog.#onPickTarget
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/social-attack-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve  = resolve;
    this._resolved = false;
    this._attacker = options.attacker;
    this._data = {
      target:       options.target       ?? game.user.targets.first()?.actor ?? null,
      attribute:    options.attribute    ?? "charisma",
      ability:      options.ability      ?? "presence",
      intent:       options.intent       ?? "build",
      subject:      options.subject      ?? "",
      claims:       options.claims       ?? {
        supportingIntimacy:   false,
        supportingVirtue:     false,
        supportingMotivation: false,
        opposingIntimacy:     false,
        opposingVirtue:       false,
        opposingMotivation:   false,
        immediateThreat:      false,
        unnaturalInfluence:   false
      },
      stuntDice:    String(options.stuntDice ?? 0)
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const a = this._attacker;
    const t = this._data.target;
    const attAppVal = a?.system?.attributes?.appearance?.value ?? 0;
    const defAppVal = t?.system?.attributes?.appearance?.value ?? 0;
    const appearanceDelta = Math.max(-3, Math.min(3, attAppVal - defAppVal));
    return {
      ...context,
      ...this._data,
      appearanceDelta,
      stuntChoices: {
        0: game.i18n.localize("EX2E.NoStunt"),
        1: game.i18n.localize("EX2E.Stunt1"),
        2: game.i18n.localize("EX2E.Stunt2"),
        3: game.i18n.localize("EX2E.Stunt3")
      }
    };
  }

  static async #onPickTarget(event, target) {
    const { pickTargetActor } = await import("../helpers/targeting.mjs");
    const picked = await pickTargetActor();
    if (picked) {
      this._data.target = picked;
      this.render();
    }
  }

  static #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;

    if (!this._data.target) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetSelected"));
      return;
    }

    this._resolved = true;
    this._resolve({
      defender:  this._data.target,
      attribute: data.attribute  || "charisma",
      ability:   data.ability    || "presence",
      intent:    data.intent     || "build",
      subject:   data.subject    || "",
      claims: {
        supportingIntimacy:   !!data.supportingIntimacy,
        supportingVirtue:     !!data.supportingVirtue,
        supportingMotivation: !!data.supportingMotivation,
        opposingIntimacy:     !!data.opposingIntimacy,
        opposingVirtue:       !!data.opposingVirtue,
        opposingMotivation:   !!data.opposingMotivation,
        immediateThreat:      !!data.immediateThreat,
        unnaturalInfluence:   !!data.unnaturalInfluence
      },
      stuntDice: Number(data.stuntDice) || 0
    });
    this.close();
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new SocialAttackDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
