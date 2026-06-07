import { evaluateCharmFormula } from "../../documents/item.mjs";
import { checkHazardImmunity } from "../../helpers/hazard-immunity.mjs";
import { hazardAction, hazardPoolSize } from "./hazard-math.mjs";

export class HazardDamageBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      damagePool:       new fields.StringField({ initial: "5", blank: false }),
      traumaType:       new fields.StringField({ initial: "bashing",
                          choices: ["bashing", "lethal", "aggravated"] }),
      resistDifficulty: new fields.NumberField({ initial: 3, integer: true, min: 0 }),
      damageOnEntry:    new fields.BooleanField({ initial: false }),
      isSupernatural:   new fields.BooleanField({ initial: false }),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]:      this.#onTokenEnter,
    [CONST.REGION_EVENTS.TOKEN_TURN_START]: this.#onTurnStart,
  };

  static async #onTokenEnter(event) {
    if (!this.system.damageOnEntry) return;
    await HazardDamageBehaviorType.#applyOrPrompt.call(this, event.data.token);
  }

  static async #onTurnStart(event) {
    await HazardDamageBehaviorType.#applyOrPrompt.call(this, event.data.token);
  }

  // Only the active GM executes this; the posted ChatMessage appears for everyone.
  static async #applyOrPrompt(tokenDoc) {
    if (!game.user.isActiveGM) return;
    const actor = tokenDoc?.actor;
    if (!actor) return;

    const action = hazardAction({
      immune:           checkHazardImmunity(actor, this.system.isSupernatural),
      hasPlayerOwner:   actor.hasPlayerOwner,
      resistDifficulty: this.system.resistDifficulty,
    });

    if (action === "immune") {
      const hazardName = this.parent?.parent?.name ?? "Hazard";
      await ChatMessage.create({
        content: `<em>${actor.name} ${game.i18n.localize("EX2E.HazardImmune")} ${hazardName}.</em>`,
        speaker: ChatMessage.getSpeaker({ actor }),
      });
      return;
    }

    if (action === "resist") {
      await HazardDamageBehaviorType.#postResistanceCard.call(this, actor);
    } else {
      await HazardDamageBehaviorType.#rollAndApply.call(this, actor);
    }
  }

  static async #rollAndApply(actor) {
    const { ExaltedRoll } = await import("../../rolls/exalted-roll.mjs");
    const hazardName = this.parent?.parent?.name ?? "Hazard";
    const rollData   = actor.getRollData?.() ?? {};
    const poolSize   = hazardPoolSize(this.system.damagePool, rollData, evaluateCharmFormula);
    const roll       = new ExaltedRoll({
      pool:      poolSize,
      flavor:    hazardName,
      actorName: actor.name,
    });
    const result = await roll.evaluate();
    await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
    if (result.successes > 0) {
      await actor.applyDamage(result.successes, this.system.traumaType);
    }
    const msg = game.i18n.format("EX2E.HazardDamageMsg", {
      hits: result.successes,
      type: this.system.traumaType,
    });
    await ChatMessage.create({
      content: `<em>${actor.name} ${msg} ${hazardName}.</em>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }

  static async #postResistanceCard(actor) {
    const hazardName = this.parent?.parent?.name ?? "Hazard";
    const regionId   = this.parent?.parent?.id   ?? "";
    const behaviorId = this.parent?.id            ?? "";
    const content    = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/hazard-resistance.hbs",
      {
        hazardName,
        actorId:     actor.id,
        regionId,
        behaviorId,
        damagePool:  this.system.damagePool,
        traumaType:  this.system.traumaType,
        difficulty:  this.system.resistDifficulty,
      }
    );
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }
}
