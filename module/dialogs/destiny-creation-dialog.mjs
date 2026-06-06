import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { prayerBonusDice, destinyEffectPool } from "../combat/sidereal-destiny-math.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DestinyCreationDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, options = {}) {
    super(options);
    this.actor         = actor;
    this._destinyType    = "ascending";
    this._college        = "";
    this._prayerDone     = false;
    this._bonusDice      = 0;
    this._effectPoints   = 0;
    this._effectRollDone = false;
  }

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "destiny-creation-dialog"],
    position: { width: 480, height: "auto" },
    window:   { resizable: false, title: "EX2E.DestinyCreateButton" },
    actions:  {
      runPrayerRoll:  DestinyCreationDialog.#onPrayerRoll,
      runEffectRoll:  DestinyCreationDialog.#onEffectRoll,
      createDestiny:  DestinyCreationDialog.#onCreate,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/destiny-creation.hbs" }
  };

  static async open(actor) {
    const dlg = new DestinyCreationDialog(actor);
    dlg.render({ force: true });
    return dlg;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const EX      = game.exalted2e.EX2E;
    const sys     = this.actor.system;
    const ownMaiden = sys.caste;

    const maidens    = Object.keys(EX.siderealMaidens);
    const sorted     = [ownMaiden, ...maidens.filter(m => m !== ownMaiden)];
    const collegeGroups = sorted.map(maiden => ({
      maiden,
      label:      game.i18n.localize(EX.siderealMaidens[maiden]),
      isOwnMaiden: maiden === ownMaiden,
      colleges:   Object.entries(EX.siderealColleges)
        .filter(([, v]) => v.maiden === maiden)
        .map(([key, v]) => ({ key, label: game.i18n.localize(v.labelKey) })),
    }));

    const selectedMaiden = this._college ? EX.siderealColleges[this._college]?.maiden : "";
    const difficulty = (selectedMaiden && selectedMaiden === ownMaiden) ? 5 : 6;

    return {
      ...context,
      actor:        this.actor,
      destinyType:  this._destinyType,
      college:      this._college,
      collegeGroups,
      difficulty,
      prayerDone:   this._prayerDone,
      bonusDice:    this._bonusDice,
      effectPoints: this._effectPoints,
      canCreate:    this._prayerDone && this._effectRollDone && !!this._college,
    };
  }

  static async #onPrayerRoll(_event, _target) {
    const EX          = game.exalted2e.EX2E;
    const actor       = this.actor;
    const sys         = actor.system;
    const ownMaiden   = sys.caste;
    const collegeMaiden = this._college ? EX.siderealColleges[this._college]?.maiden : "";
    const difficulty  = (collegeMaiden && collegeMaiden === ownMaiden) ? 5 : 6;

    const result = await ExaltedRoll.rollAttributeAbility(actor, "charisma", "performance", { difficulty });
    if (!result) return;

    const successes  = result.successes ?? 0;
    this._bonusDice  = prayerBonusDice(successes);
    this._prayerDone = true;
    this.render();
  }

  static async #onEffectRoll(_event, _target) {
    const actor    = this.actor;
    const sys      = actor.system;
    const EX       = game.exalted2e.EX2E;
    const essenceVal = sys.essence?.value ?? 1;
    const maiden     = EX.siderealColleges[this._college]?.maiden ?? "";
    const dots       = sys.splat?.sidereal?.colleges?.[maiden]?.[this._college] ?? 0;
    const pool       = destinyEffectPool(essenceVal, dots, this._bonusDice);

    const roll   = new ExaltedRoll({ pool: Math.max(1, pool), flavor: game.i18n.localize("EX2E.EffectRoll"), actorName: actor.name });
    const result = await roll.evaluate();
    await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
    this._effectPoints   = result.successes;
    this._effectRollDone = true;
    this.render();
  }

  static async #onCreate(_event, _target) {
    const actor  = this.actor;
    const EX     = game.exalted2e.EX2E;
    const maiden = EX.siderealColleges[this._college]?.maiden ?? "";

    const [item] = await actor.createEmbeddedDocuments("Item", [{
      name:   game.i18n.localize(this._destinyType === "ascending" ? "EX2E.DestinyAscending" : "EX2E.DestinyDescending"),
      type:   "destiny",
      system: {
        destinyType:   this._destinyType,
        college:       this._college,
        collegeMaiden: maiden,
        effectPoints:  { total: this._effectPoints },
        finalized:     false,
      }
    }]);
    item?.sheet?.render({ force: true });
    this.close();
  }

  _onRender(context, options) {
    this.element.querySelector("[name='destinyType']")?.addEventListener("change", (e) => {
      this._destinyType = e.target.value;
      this.render();
    });
    this.element.querySelector("[name='college']")?.addEventListener("change", (e) => {
      this._college = e.target.value;
      this.render();
    });
  }
}
