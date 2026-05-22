import { evaluateCharmFormula } from "../../documents/item.mjs";

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

    // Check for hazard immunity from active Charm effects.
    // Multiple Charms can each contribute a scope ("natural" | "supernatural").
    // Take the most permissive scope across all immunity AEs so that e.g.
    // Element-Resisting Prana (natural) + Steadfast Elemental Emperor Stance
    // (supernatural) correctly grants full immunity when both are active.
    const immunityAEs = actor.effects.filter(e => !e.disabled && e.flags?.exalted2e?.hazardImmunity);
    if (immunityAEs.length > 0) {
      // If an immunity AE requires a base Charm to be active (enhancesCharmUid), only count
      // it when that Charm is currently toggled on. No enhancesCharmUid = always active.
      const activeImmunities = immunityAEs.filter(ae => {
        const uid = ae.flags.exalted2e.enhancesCharmUid;
        if (!uid) return true;
        return actor.items.some(i => i.type === "charm" && i.system?.charmUid === uid && i.system?.active);
      });
      const hasSupernaturalImmunity = activeImmunities.some(e => e.flags.exalted2e.hazardImmunity === "supernatural");
      const hasNaturalImmunity      = activeImmunities.some(e => e.flags.exalted2e.hazardImmunity === "natural");
      const isImmune = hasSupernaturalImmunity || (hasNaturalImmunity && !this.system.isSupernatural);
      if (isImmune) {
        const hazardName = this.parent?.parent?.name ?? "Hazard";
        await ChatMessage.create({
          content: `<em>${actor.name} ${game.i18n.localize("EX2E.HazardImmune")} ${hazardName}.</em>`,
          speaker: ChatMessage.getSpeaker({ actor }),
        });
        return;
      }
    }

    if (actor.hasPlayerOwner && this.system.resistDifficulty > 0) {
      await HazardDamageBehaviorType.#postResistanceCard.call(this, actor);
    } else {
      await HazardDamageBehaviorType.#rollAndApply.call(this, actor);
    }
  }

  static async #rollAndApply(actor) {
    const { ExaltedRoll } = await import("../../rolls/exalted-roll.mjs");
    const hazardName = this.parent?.parent?.name ?? "Hazard";
    const rollData   = actor.getRollData?.() ?? {};
    const poolSize   = Math.max(1, evaluateCharmFormula(this.system.damagePool, rollData, 5));
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
