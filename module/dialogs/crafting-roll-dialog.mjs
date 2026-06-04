import { craftingPool, craftingDifficulty, exceedsCraftCap, resolveOutcome, workshopDiceMod, effectiveWorkshopMod, assistantBonusSuccesses, actorHasWordsAsWorkshop } from "../helpers/crafting-helpers.mjs";
import { ExaltedRoll } from "../rolls/exalted-roll.mjs";
import { refreshPips } from "../helpers/pip-track.mjs";

const EXC_ORDER = { first: 0, second: 1, third: 2 };

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
    this._project           = options.project;
    this._actor             = options.actor;
    this._craftExcellencies = options.craftExcellencies ?? [];
    this._craftCharms       = options.craftCharms;
    this._resolve           = resolve;
    this._resolved          = false;
    this._rollResult        = null;
    this._secondExcSucc     = 0;
    this._assistantBonus = 0;
    this.firstExcMax        = options.firstExcMax    ?? 0;
    this.secondExcMax       = options.secondExcMax   ?? 0;
  }

  get title() {
    return game.i18n.localize("EX2E.CraftingRollTitle");
  }

  _onRender(context, _options) {
    if (context.phase !== "preroll") return;
    const el = this.element;

    const firstTrack   = el.querySelector(".exc-pip-track[data-exc='first']");
    const secondTrack  = el.querySelector(".exc-pip-track[data-exc='second']");
    const firstHidden  = firstTrack?.querySelector("[name='firstExcDice']");
    const secondHidden = secondTrack?.querySelector("[name='secondExcSucc']");

    const firstExcMax  = this.firstExcMax  ?? 0;
    const secondExcMax = this.secondExcMax ?? 0;

    const updatePips = () => {
      refreshPips(firstTrack,  firstHidden,  firstExcMax);
      refreshPips(secondTrack, secondHidden, secondExcMax);
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
      const { successes: rawSuccesses, botch } = this._rollResult;
      const assistantBonus = this._assistantBonus ?? 0;
      const successes = rawSuccesses + (this._secondExcSucc ?? 0) + assistantBonus;
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
        assistantBonus,
        tierLabel: game.i18n.localize(`EX2E.CraftingTier${outcome.tier.charAt(0).toUpperCase() + outcome.tier.slice(1)}`),
      };
    }

    // Pre-roll state
    const waiverCharm     = actorHasWordsAsWorkshop(actor);
    const wordsAsWorkshop = !!waiverCharm;
    const wsLevel         = project.workshop ?? "masters";
    const assistants      = project.assistants ?? { mortalAides:0, lesserArtisans:0, greaterArtisans:0, mightyArtisans:0 };
    const assistantBonus  = assistantBonusSuccesses(assistants);
    const workshopOptions = ["rudimentary","basic","masters","flawless","ideal"].map(v => ({
      value: v, selected: v === wsLevel,
      label: `${game.i18n.localize("EX2E.CraftWorkshop_" + v)} (${workshopDiceMod(v) >= 0 ? "+" : ""}${workshopDiceMod(v)})`,
    }));
    const modifiersCtx = { workshopOptions, wordsAsWorkshop, waiverName: waiverCharm?.name ?? "", assistants, assistantBonus };

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

    const firstExcCharm  = this._craftExcellencies.find(c => c.system.excellency === "first");
    const secondExcCharm = this._craftExcellencies.find(c => c.system.excellency === "second");
    const thirdExcCharm  = this._craftExcellencies.find(c => c.system.excellency === "third");

    // Excellency cap: ability-based = full pool; Lunar/Alchemical = first attr option only
    const kv = isLunarAlchemical
      ? (sys.attributes[attrOptions?.[0]?.value]?.value ?? 0)
      : basePool;
    this.firstExcMax  = kv;
    this.secondExcMax = Math.ceil(kv / 2);

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
      excellency: {
        first:  !!firstExcCharm,
        second: !!secondExcCharm,
        third:  !!thirdExcCharm,
      },
      firstExcLabel:  firstExcCharm?.name  ?? game.i18n.localize("EX2E.FirstExcellency"),
      secondExcLabel: secondExcCharm?.name ?? game.i18n.localize("EX2E.SecondExcellency"),
      thirdExcLabel:  thirdExcCharm?.name  ?? game.i18n.localize("EX2E.ThirdExcellency"),
      firstExcMax:    this.firstExcMax,
      secondExcMax:   this.secondExcMax,
      ...modifiersCtx,
    };
  }

  static async #onRoll(_event, _btn) {
    try {
      const el         = this.element;
      const stunt      = parseInt(el.querySelector("[name=stunt]:checked")?.value ?? "0", 10);
      const charmDice  = parseInt(el.querySelector("[name=charmDice]")?.value ?? "0", 10);
      const firstExcDice  = parseInt(el.querySelector("[name='firstExcDice']")?.value  ?? "0", 10);
      const secondExcSucc = parseInt(el.querySelector("[name='secondExcSucc']")?.value ?? "0", 10);
      this._secondExcSucc = secondExcSucc;

      const workshop = el.querySelector("[name=workshop]")?.value ?? "masters";
      const assistants = {
        mortalAides:     parseInt(el.querySelector("[name=assist_mortalAides]")?.value     ?? "0", 10) || 0,
        lesserArtisans:  parseInt(el.querySelector("[name=assist_lesserArtisans]")?.value  ?? "0", 10) || 0,
        greaterArtisans: parseInt(el.querySelector("[name=assist_greaterArtisans]")?.value ?? "0", 10) || 0,
        mightyArtisans:  parseInt(el.querySelector("[name=assist_mightyArtisans]")?.value  ?? "0", 10) || 0,
      };
      const wsMod = effectiveWorkshopMod(workshop, { wordsAsWorkshop: !!actorHasWordsAsWorkshop(this._actor) });
      this._assistantBonus = assistantBonusSuccesses(assistants);

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

      const pool = Math.max(1, basePool + (this._project.bonusDice ?? 0) + charmDice + firstExcDice + wsMod);

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

      // Persist workshop + assistants onto the project record.
      const projects = foundry.utils.deepClone(this._actor.system.craftingProjects ?? []);
      const idx = projects.findIndex(p => p.id === this._project.id);
      if (idx >= 0) {
        projects[idx].workshop   = workshop;
        projects[idx].assistants = assistants;
        await this._actor.update({ "system.craftingProjects": projects });
        this._project = projects[idx];
      }
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
      const dlg = new CraftingRollDialog({ project, actor, craftExcellencies, craftCharms }, resolve);
      dlg.render({ force: true });
    });
  }
}
