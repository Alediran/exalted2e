import { craftingPool, craftingDifficulty, exceedsCraftCap, resolveOutcome } from "../helpers/crafting-helpers.mjs";
import { ExaltedRoll } from "../rolls/exalted-roll.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CraftingRollDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-crafting-roll-dialog",
    classes: ["exalted2e", "crafting-roll-dialog"],
    position: { width: 420, height: "auto" },
    window: { resizable: false },
    actions: {
      roll:     CraftingRollDialog.#onRoll,
      retry:    CraftingRollDialog.#onRetry,
      complete: CraftingRollDialog.#onComplete,
      abandon:  CraftingRollDialog.#onAbandon,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/crafting-roll-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._project     = options.project;
    this._actor       = options.actor;
    this._craftCharms = options.craftCharms;
    this._resolve     = resolve;
    this._resolved    = false;
    this._rollResult  = null; // null = pre-roll; ExaltedRollResult = post-roll
  }

  get title() {
    return game.i18n.localize("EX2E.CraftingRollTitle");
  }

  async _prepareContext(_options) {
    const project = this._project;
    const actor   = this._actor;
    const sys     = actor.system;

    const isLunarAlchemical = ["lunar", "alchemical"].includes(sys.exaltType ?? "");
    const difficulty        = craftingDifficulty(project);
    const materialsResources = project.isPerfect
      ? Math.min(5, project.targetResources + 2)
      : Math.max(0, project.targetResources - 1);
    const capExceeded = exceedsCraftCap(actor, project.targetResources);

    if (this._rollResult) {
      const { successes, botch } = this._rollResult;
      const outcome   = resolveOutcome(successes, botch, project);
      const threshold = Math.max(0, successes - difficulty);
      return {
        phase: "result",
        project,
        difficulty,
        successes,
        botch,
        threshold,
        outcome,
        tierLabel: game.i18n.localize(`EX2E.CraftingTier${outcome.tier.charAt(0).toUpperCase() + outcome.tier.slice(1)}`),
      };
    }

    // Pre-roll state
    const basePool = craftingPool(actor, project.size);

    // Attribute options for Lunar/Alchemical
    let attrOptions = null;
    if (isLunarAlchemical) {
      attrOptions = [
        ...(project.size === "small" ? [{ value: "dexterity",    label: game.i18n.localize("EX2E.AttrDexterity") }]    : []),
        { value: "perception",   label: game.i18n.localize("EX2E.AttrPerception") },
        { value: "intelligence", label: game.i18n.localize("EX2E.AttrIntelligence") },
      ];
    }

    return {
      phase: "preroll",
      project,
      difficulty,
      basePool,
      materialsResources,
      capExceeded,
      isLunarAlchemical,
      attrOptions,
      craftCharms: this._craftCharms,
    };
  }

  static async #onRoll(_event, _btn) {
    try {
      const el    = this.element;
      const stunt = parseInt(el.querySelector("[name=stunt]:checked")?.value ?? "0", 10);
      const charmDice = parseInt(el.querySelector("[name=charmDice]")?.value ?? "0", 10);

      // Activate selected charms (mote spend + chat cards)
      const checked = [...el.querySelectorAll("[name=selectedCharms]:checked")];
      for (const cb of checked) {
        const charm = this._actor.items.get(cb.dataset.charmId);
        if (charm) await charm.activateCharm({});
      }

      // Compute pool — for Lunar/Alchemical use chosen attribute
      const sys       = this._actor.system;
      const craftVal  = sys.abilities.craft.value;
      let basePool;
      const chosenAttr = el.querySelector("[name=chosenAttr]")?.value;
      if (chosenAttr) {
        basePool = (sys.attributes[chosenAttr]?.value ?? 0) + craftVal;
      } else {
        basePool = craftingPool(this._actor, this._project.size);
      }

      const pool = Math.max(1, basePool + (this._project.bonusDice ?? 0) + charmDice);

      const roll = new ExaltedRoll({
        pool,
        stunt,
        flavor:    game.i18n.format("EX2E.CraftingRollFlavor", { name: this._project.name }),
        actorName: this._actor.name,
      });
      this._rollResult = await roll.evaluate();
      await this._rollResult.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this._actor }),
      });
    } catch (err) {
      console.error("CraftingRollDialog | roll failed", err);
      ui.notifications.error(game.i18n.localize("EX2E.CraftingRollError"));
    } finally {
      this.render();
    }
  }

  static async #onRetry(_event, _btn) {
    const projects = foundry.utils.deepClone(this._actor.system.craftingProjects ?? []);
    const idx = projects.findIndex(p => p.id === this._project.id);
    if (idx >= 0) {
      projects[idx].bonusDice = this._rollResult.successes;
      projects[idx].status    = "active";
      await this._actor.update({ "system.craftingProjects": projects });
    }
    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  static async #onComplete(_event, _btn) {
    const projects = foundry.utils.deepClone(this._actor.system.craftingProjects ?? []);
    const idx = projects.findIndex(p => p.id === this._project.id);
    if (idx >= 0) {
      projects[idx].status = "completed";
      await this._actor.update({ "system.craftingProjects": projects });
    }
    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  static async #onAbandon(_event, _btn) {
    const projects = foundry.utils.deepClone(this._actor.system.craftingProjects ?? []);
    const idx = projects.findIndex(p => p.id === this._project.id);
    if (idx >= 0) {
      projects[idx].status = "botched";
      await this._actor.update({ "system.craftingProjects": projects });
    }
    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  _onClose(_options) {
    if (!this._resolved) this._resolve(false);
  }

  static async open(project, actor) {
    const craftCharms = actor.items.filter(
      i => i.type === "charm"
        && i.system.ability === "craft"
        && i.system.excellency !== "first"
        && i.system.excellency !== "second"
        && i.system.excellency !== "third"
    );
    return new Promise(resolve => {
      const dlg = new CraftingRollDialog({ project, actor, craftCharms }, resolve);
      dlg.render({ force: true });
    });
  }
}
