import { ExaltedRoll } from "../rolls/exalted-roll.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = (() => {
  const api = foundry.applications.api;
  return { HandlebarsApplicationMixin: api.HandlebarsApplicationMixin, ApplicationV2: api.ApplicationV2 };
})();

/**
 * Entry point called by _createSpellEffectAe when spellSubtype === "ghost-summoning".
 * Shows a setup dialog, then opens an interactive WP+Essence contest.
 */
export async function ghostSummonFlow(actor, spell) {
  if (!actor) return;
  const setup = await _showGhostSetupDialog();
  if (!setup) return;

  const casterPool = (actor.system.attributes?.wits?.value ?? 0)
                   + (actor.system.abilities?.occult?.value  ?? 0);
  const casterWp   = actor.system.willpower?.value ?? 0;

  new GhostContestApp({ actor, spell, casterPool, casterWp,
    ghostName: setup.ghostName,
    ghostPool: setup.ghostWp + setup.ghostEss,
    ghostWp:   setup.ghostWp,
  }).render(true);
}

async function _showGhostSetupDialog() {
  const content = `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.GhostSummonGhostName")}</label>
  <input type="text" name="ghostName" value="" style="flex:1">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.GhostSummonGhostWP")}</label>
  <input type="number" name="ghostWp" value="5" min="1" max="20" style="width:5em">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.GhostSummonGhostEss")}</label>
  <input type="number" name="ghostEss" value="2" min="1" max="10" style="width:5em">
</div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("EX2E.GhostSummonSetupTitle") },
    content,
    ok: {
      label: game.i18n.localize("EX2E.Confirm"),
      callback: (_ev, button) => {
        const form = button.form;
        const ghostName = form.elements.ghostName?.value?.trim();
        if (!ghostName) return null;
        return {
          ghostName,
          ghostWp:  parseInt(form.elements.ghostWp?.value)  || 5,
          ghostEss: parseInt(form.elements.ghostEss?.value) || 2,
        };
      }
    }
  });
}

class GhostContestApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes: ["exalted2e", "ghost-contest"],
    position: { width: 480, height: "auto" },
    window: { resizable: false },
    actions: {
      rollRound: GhostContestApp.#onRollRound,
      conclude:  GhostContestApp.#onConclude,
    }
  };

  static PARTS = {
    body: { template: "systems/exalted2e/templates/ui/ghost-contest.hbs" }
  };

  get title() { return game.i18n.localize("EX2E.GhostContestTitle"); }

  #actor;  #spell;  #casterPool;  #casterWp;
  #ghostName;  #ghostPool;  #ghostWp;
  #rounds = [];  #outcome = null;

  constructor({ actor, spell, casterPool, casterWp, ghostName, ghostPool, ghostWp }) {
    super();
    this.#actor      = actor;
    this.#spell      = spell;
    this.#casterPool = casterPool;
    this.#casterWp   = casterWp;
    this.#ghostName  = ghostName;
    this.#ghostPool  = ghostPool;
    this.#ghostWp    = ghostWp;
  }

  async _prepareContext(_options) {
    return {
      actorName:  this.#actor.name,
      casterPool: this.#casterPool,
      casterWp:   this.#casterWp,
      ghostName:  this.#ghostName,
      ghostPool:  this.#ghostPool,
      ghostWp:    this.#ghostWp,
      rounds:     this.#rounds,
      outcome:    this.#outcome,
      isOver:     this.#outcome !== null,
    };
  }

  static async #onRollRound() {
    if (this.#outcome !== null) return;

    const casterResult = await new ExaltedRoll({ pool: this.#casterPool }).evaluate();
    const ghostResult  = await new ExaltedRoll({ pool: this.#ghostPool  }).evaluate();
    const casterSuccesses = casterResult.successes;
    const ghostSuccesses  = ghostResult.successes;

    // Tie goes to caster
    const loser = ghostSuccesses > casterSuccesses ? "caster" : "ghost";
    if (loser === "caster") this.#casterWp = Math.max(0, this.#casterWp - 1);
    else                    this.#ghostWp  = Math.max(0, this.#ghostWp  - 1);

    this.#rounds.push({ roundNum: this.#rounds.length + 1, casterSuccesses, ghostSuccesses, loser });

    if      (this.#casterWp <= 0) this.#outcome = "ghost";
    else if (this.#ghostWp  <= 0) this.#outcome = "caster";

    this.render();
  }

  static async #onConclude() {
    if (this.#outcome === null) return;

    const essence = this.#actor.system.essence?.value ?? 1;
    let bindingDuration = null;
    if (this.#outcome === "caster") {
      const weeks = Math.max(1, this.#casterWp * essence);
      bindingDuration = `${weeks} week${weeks !== 1 ? "s" : ""}`;
    }

    const outcomeText = this.#outcome === "caster"
      ? game.i18n.format("EX2E.GhostSummonResultBound",  { ghost: this.#ghostName, duration: bindingDuration })
      : game.i18n.format("EX2E.GhostSummonResultFailed", { actor: this.#actor.name });

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/ghost-summon-result.hbs",
      {
        actorName:    this.#actor.name,
        spellName:    this.#spell?.name ?? "",
        ghostName:    this.#ghostName,
        outcomeText,
        outcome:      this.#outcome,
        totalRounds:  this.#rounds.length,
      }
    );
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
      content,
    });
    this.close();
  }
}
