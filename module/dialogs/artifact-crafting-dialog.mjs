import { artifactPool, resolveArtifactRoll } from "../helpers/crafting-helpers.mjs";
import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { refreshPips } from "../helpers/pip-track.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const EXC_ORDER = { first: 0, second: 1, third: 2 };

export class ArtifactCraftingDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "ex2e-artifact-crafting-dialog",
    classes: ["exalted2e", "artifact-crafting-dialog"],
    position: { width: 440, height: "auto" },
    window:   { resizable: false },
    actions: {
      roll:    ArtifactCraftingDialog.#onRoll,
      save:    ArtifactCraftingDialog.#onSave,
      abandon: ArtifactCraftingDialog.#onAbandon,
    }
  };

  static PARTS = {
    form: { template: "systems/exalted2e/templates/dialog/artifact-crafting-dialog.hbs" }
  };

  constructor(options = {}, resolve) {
    super(options);
    this._project          = options.project;
    this._actor            = options.actor;
    this._craftExcellencies = options.craftExcellencies ?? [];
    this._craftCharms      = options.craftCharms ?? [];
    this._resolve          = resolve;
    this._resolved         = false;
    this._rollResult       = null;
    this._secondExcSucc    = 0;
    this._firstExcMax      = 0;
    this._secondExcMax     = 0;
    this._attribute        = "dexterity";
  }

  get title() {
    return game.i18n.localize("EX2E.ArtifactCraftingTitle");
  }

  async _prepareContext(_options) {
    const project = this._project;
    const target  = project.targetSuccesses;
    const current = project.currentSuccesses ?? 0;
    const progressPct = Math.min(100, Math.round((current / target) * 100));

    if (this._rollResult) {
      const { successes: rawSuccesses, botch } = this._rollResult;
      const successes = rawSuccesses + (this._secondExcSucc ?? 0);
      const outcome = resolveArtifactRoll(successes, botch, project);
      const newPct  = Math.min(100, Math.round((outcome.newSuccesses / target) * 100));
      return {
        phase: "result",
        project,
        successes,
        botch,
        outcome,
        target,
        progressPct: newPct,
        tierLabel: game.i18n.localize(
          `EX2E.ArtifactTier${outcome.tier.charAt(0).toUpperCase() + outcome.tier.slice(1)}`
        ),
      };
    }

    const sys    = this._actor.system;
    const isLunarAlchemical = ["lunar", "alchemical"].includes(sys.exaltType ?? "");
    const attrVal  = sys.attributes[this._attribute]?.value ?? 0;
    const pool     = artifactPool(this._actor, this._attribute);

    const firstExcCharm  = this._craftExcellencies.find(c => c.system.excellency === "first");
    const secondExcCharm = this._craftExcellencies.find(c => c.system.excellency === "second");
    const thirdExcCharm  = this._craftExcellencies.find(c => c.system.excellency === "third");

    // Ability-based: cap = attr + craft = full roll pool.
    // Lunar/Alchemical: cap = chosen attribute only (no ability added).
    const kv           = isLunarAlchemical ? attrVal : pool;
    this._firstExcMax  = kv;
    this._secondExcMax = Math.ceil(kv / 2);

    return {
      phase:            "preroll",
      project,
      basePool:         pool,
      current,
      target,
      progressPct,
      difficulty:       project.rating,
      craftCharms:      this._craftCharms,
      excellency: {
        first:  !!firstExcCharm,
        second: !!secondExcCharm,
        third:  !!thirdExcCharm,
      },
      rollAttribute:    this._attribute,
      firstExcLabel:    firstExcCharm?.name  ?? game.i18n.localize("EX2E.FirstExcellency"),
      secondExcLabel:   secondExcCharm?.name ?? game.i18n.localize("EX2E.SecondExcellency"),
      thirdExcLabel:    thirdExcCharm?.name  ?? game.i18n.localize("EX2E.ThirdExcellency"),
      firstExcMax:      this._firstExcMax,
      secondExcMax:     this._secondExcMax,
    };
  }

  _onRender(context, _options) {
    if (context.phase !== "preroll") return;
    const el = this.element;

    // Attribute selector — re-render on change to refresh pool + pip maxes
    el.querySelector("[name='rollAttribute']")?.addEventListener("change", (e) => {
      this._attribute = e.target.value;
      this.render();
    });

    const firstTrack   = el.querySelector(".exc-pip-track[data-exc='first']");
    const secondTrack  = el.querySelector(".exc-pip-track[data-exc='second']");
    const firstHidden  = firstTrack?.querySelector("[name='firstExcDice']");
    const secondHidden = secondTrack?.querySelector("[name='secondExcSucc']");

    const updatePips = () => {
      refreshPips(firstTrack,  firstHidden,  this._firstExcMax  ?? 0);
      refreshPips(secondTrack, secondHidden, this._secondExcMax ?? 0);
    };

    firstTrack?.addEventListener("click", (e) => {
      const pip = e.target.closest(".exc-pip");
      if (!pip) return;
      const v = parseInt(pip.dataset.value);
      firstHidden.value = (parseInt(firstHidden.value) || 0) === v ? 0 : v;
      updatePips();
    });

    secondTrack?.addEventListener("click", (e) => {
      const pip = e.target.closest(".exc-pip");
      if (!pip) return;
      const v = parseInt(pip.dataset.value);
      secondHidden.value = (parseInt(secondHidden.value) || 0) === v ? 0 : v;
      updatePips();
    });

    updatePips();
  }

  static async #onRoll(_event, _btn) {
    try {
      const el          = this.element;
      const charmDice   = parseInt(el.querySelector("[name=charmDice]")?.value  ?? "0", 10);
      const stunt       = parseInt(el.querySelector("[name=stunt]")?.value      ?? "0", 10);
      const firstExcDice  = parseInt(el.querySelector("[name=firstExcDice]")?.value  ?? "0", 10);
      const secondExcSucc = parseInt(el.querySelector("[name=secondExcSucc]")?.value ?? "0", 10);
      this._secondExcSucc = secondExcSucc;

      // Activate excellency charms if used
      if (firstExcDice > 0) {
        const c = this._craftExcellencies.find(x => x.system.excellency === "first");
        if (c) await c.activateCharm({});
      }
      if (secondExcSucc > 0) {
        const c = this._craftExcellencies.find(x => x.system.excellency === "second");
        if (c) await c.activateCharm({});
      }
      const thirdChecked = el.querySelector("[name=thirdExcActive]")?.checked ?? false;
      if (thirdChecked) {
        const c = this._craftExcellencies.find(x => x.system.excellency === "third");
        if (c) await c.activateCharm({});
      }

      // Activate all selected regular charms
      const checked = [...el.querySelectorAll("[name=selectedCharms]:checked")];
      for (const cb of checked) {
        const charm = this._actor.items.get(cb.dataset.charmId);
        if (charm) await charm.activateCharm({});
      }

      const pool = Math.max(1, artifactPool(this._actor, this._attribute) + charmDice + firstExcDice);

      const roll = new ExaltedRoll({
        pool,
        stunt,
        flavor:    game.i18n.format("EX2E.ArtifactCraftingFlavor", { name: this._project.name }),
        actorName: this._actor.name,
      });
      this._rollResult = await roll.evaluate();
      await this._rollResult.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this._actor }),
      });

      // Increment seasons elapsed immediately on roll
      const projects = foundry.utils.deepClone(this._actor.system.artifactProjects ?? []);
      const idx = projects.findIndex(p => p.id === this._project.id);
      if (idx >= 0) {
        projects[idx].seasonsElapsed = (projects[idx].seasonsElapsed ?? 0) + 1;
        await this._actor.update({ "system.artifactProjects": projects });
        this._project = projects[idx];
      }
    } catch (err) {
      console.error("ArtifactCraftingDialog | roll failed", err);
      ui.notifications.error(game.i18n.localize("EX2E.ArtifactCraftingError"));
    } finally {
      this.render();
    }
  }

  static async #onSave(_event, _btn) {
    const { successes: rawSuccesses, botch } = this._rollResult;
    const successes = rawSuccesses + (this._secondExcSucc ?? 0);
    const outcome = resolveArtifactRoll(successes, botch, this._project);

    const projects = foundry.utils.deepClone(this._actor.system.artifactProjects ?? []);
    const idx = projects.findIndex(p => p.id === this._project.id);
    if (idx >= 0) {
      projects[idx].currentSuccesses = outcome.newSuccesses;
      if (outcome.completed) {
        projects[idx].status = "completed";
      } else if (outcome.tier === "botched") {
        projects[idx].status = "botched";
      }
      await this._actor.update({ "system.artifactProjects": projects });
    }
    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  static async #onAbandon(_event, _btn) {
    const projects = foundry.utils.deepClone(this._actor.system.artifactProjects ?? []);
    const idx = projects.findIndex(p => p.id === this._project.id);
    if (idx >= 0) {
      projects[idx].status = "botched";
      await this._actor.update({ "system.artifactProjects": projects });
    }
    this._resolved = true;
    this._resolve(true);
    this.close();
  }

  _onClose(_options) {
    if (!this._resolved) this._resolve(false);
  }

  static async open(project, actor) {
    const craftItems = actor.items.filter(
      i => i.type === "charm" && i.system.ability === "craft"
    );

    const craftExcellencies = craftItems
      .filter(i => i.system.excellency && i.system.excellency !== "none")
      .sort((a, b) => (EXC_ORDER[a.system.excellency] ?? 9) - (EXC_ORDER[b.system.excellency] ?? 9));

    const craftCharms = craftItems.filter(
      i => !i.system.excellency || i.system.excellency === "none"
    );

    return new Promise(resolve => {
      const dlg = new ArtifactCraftingDialog(
        { project, actor, craftExcellencies, craftCharms },
        resolve
      );
      dlg.render({ force: true });
    });
  }
}
