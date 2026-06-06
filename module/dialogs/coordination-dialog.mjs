const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { coordinationPool, coordinationDifficulty } from "../rolls/coordination-math.mjs";

export class CoordinationDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-coordination-dialog",
    classes: ["exalted2e", "roll-dialog", "coordination-dialog"],
    position: { width: 380, height: "auto" },
    window: {
      title:     "EX2E.CoordinatedAttack",
      resizable: false
    },
    actions: {
      confirmCoordination: CoordinationDialog.#onConfirm,
      pickTarget:          CoordinationDialog.#onPickTarget,
    }
  };

  static PARTS = {
    form: {
      template: "systems/exalted2e/templates/dialog/coordination-dialog.hbs"
    }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._resolve      = resolve;
    this._resolved     = false;
    this._coordinator  = options.coordinator ?? null;
    this._combat       = options.combat       ?? null;
    this._target       = options.target       ?? null;
    this._participants = options.participants ?? 2;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this._coordinator?.system ?? {};
    const pool = coordinationPool(sys);
    const participants = Math.max(2, this._participants);
    const difficulty   = coordinationDifficulty(participants);
    return {
      ...ctx,
      coordinatorName: this._coordinator?.name ?? "—",
      pool,
      participants,
      difficulty,
      target: this._target
        ? { id: this._target.id, name: this._target.name, img: this._target.img }
        : null,
    };
  }

  static async #onPickTarget(event, target) {
    const form = this.element?.querySelector("form");
    const liveParticipants = parseInt(form?.querySelector("[name='participants']")?.value);
    if (Number.isFinite(liveParticipants)) this._participants = Math.max(2, liveParticipants);
    const { pickTargetActor } = await import("../helpers/targeting.mjs");
    const picked = await pickTargetActor();
    if (!picked) return;
    this._target = picked;
    this.render({ parts: ["form"] });
  }

  static async #onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const fd   = new foundry.applications.ux.FormDataExtended(form);
    const data = fd.object;
    const participants = Math.max(2, parseInt(data.participants) || 2);
    this._resolved = true;
    this._resolve({
      target:       this._target,
      participants,
      pool:         parseInt(data.pool) || 0,
      difficulty:   coordinationDifficulty(participants),
    });
    this.close();
  }

  _onRender(context, options) {
    const form = this.element?.querySelector("form");
    const diffSpan = form?.querySelector(".difficulty-display");
    const participantsInput = form?.querySelector("[name='participants']");
    if (!participantsInput || !diffSpan) return;
    participantsInput.addEventListener("input", () => {
      const n = Math.max(2, parseInt(participantsInput.value) || 2);
      diffSpan.textContent = coordinationDifficulty(n);
    });
  }

  _onClose(options) {
    if (!this._resolved) this._resolve(null);
  }

  static async prompt(options = {}) {
    return new Promise(resolve => {
      const dialog = new CoordinationDialog(options, resolve);
      dialog.render({ force: true });
    });
  }
}
