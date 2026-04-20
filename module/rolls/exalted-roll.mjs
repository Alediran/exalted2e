/**
 * ExaltedRoll – Handles the Exalted 2e d10 dice pool mechanic.
 *
 * Rules:
 *   - Roll a pool of d10s
 *   - Each die showing 7, 8, or 9  = 1 success
 *   - Each die showing 10          = 2 successes
 *   - Each die showing 1           = -1 success (only matters for botch check)
 *   - Botch: 0 raw successes AND at least one 1 → catastrophic failure
 *   - Stunt bonus: 1-stunt = +1 die, 2-stunt = +2 dice + 2 motes back,
 *                  3-stunt = +3 dice + 2 motes back + 1 wp back
 *
 * Excellencies:
 *   - First:  1m/die added before rolling (pool already includes them)
 *   - Second: 2m/success added after rolling (prevents botch)
 *   - Third:  4m – rerolls all non-success dice once
 */
export class ExaltedRoll {

  /**
   * @param {object} options
   * @param {number}   options.pool                 Total dice pool size (includes 1st Exc. dice)
   * @param {string}   [options.flavor]             Chat card flavor text
   * @param {string}   [options.actorName]          Name of the rolling actor
   * @param {number}   [options.stunt]              Stunt bonus (0-3)
   * @param {number}   [options.moteCost]           Total motes spent (all sources combined)
   * @param {string}   [options.moteType]           "personal" | "peripheral"
   * @param {number}   [options.firstExcDice]       Dice added by First Excellency (for display)
   * @param {number}   [options.secondExcSuccesses] Successes added by Second Excellency
   * @param {boolean}  [options.useThirdExcellency] Whether Third Excellency reroll is active
   * @param {object}   [options.specialty]          Specialty used ({name,value}, already in pool)
   */
  constructor(options = {}) {
    this.pool               = Math.max(1, options.pool ?? 1);
    this.flavor             = options.flavor             ?? "";
    this.actorName          = options.actorName          ?? "";
    this.stunt              = options.stunt              ?? 0;
    this.moteCost           = options.moteCost           ?? 0;
    this.moteType           = options.moteType           ?? "peripheral";
    this.firstExcDice       = options.firstExcDice       ?? 0;
    this.secondExcSuccesses = options.secondExcSuccesses ?? 0;
    this.useThirdExcellency = options.useThirdExcellency ?? false;
    this.specialty          = options.specialty          ?? null;

    // Stunt adds extra dice (pool already includes 1st Excellency dice)
    this.totalPool = this.pool + this.stunt;
  }

  /**
   * Execute the roll and return evaluated results.
   * @returns {Promise<ExaltedRollResult>}
   */
  async evaluate() {
    const formula = `${this.totalPool}d10`;
    const roll    = new Roll(formula);
    await roll.evaluate();

    let dice = roll.terms[0].results.map(r => r.result);

    // Third Excellency: reroll all non-success dice (< 7) once
    if (this.useThirdExcellency) {
      const failureIndices = dice.reduce((acc, d, i) => (d < 7 ? [...acc, i] : acc), []);
      if (failureIndices.length > 0) {
        const reroll = new Roll(`${failureIndices.length}d10`);
        await reroll.evaluate();
        const rerollDice = reroll.terms[0].results.map(r => r.result);
        failureIndices.forEach((origIdx, rerollIdx) => {
          dice[origIdx] = rerollDice[rerollIdx];
        });
      }
    }

    return new ExaltedRollResult(dice, {
      pool:               this.totalPool,
      flavor:             this.flavor,
      actorName:          this.actorName,
      stunt:              this.stunt,
      moteCost:           this.moteCost,
      moteType:           this.moteType,
      foundryRoll:        roll,
      firstExcDice:        this.firstExcDice,
      secondExcSuccesses:  this.secondExcSuccesses,
      usedThirdExcellency: this.useThirdExcellency,
      specialty:           this.specialty
    });
  }

  /**
   * Evaluate the roll and send results to the chat log.
   * @param {object} [chatOptions]
   * @returns {Promise<ChatMessage>}
   */
  async toMessage(chatOptions = {}) {
    const result = await this.evaluate();
    return result.toMessage(chatOptions);
  }

  // ── Static Factory Methods ──────────────────────────────────────────────

  /**
   * Build a dice pool from an actor's attribute + ability and roll it,
   * optionally showing a configuration dialog first.
   *
   * @param {ExaltedActor} actor
   * @param {string} attribute  e.g. "dexterity"
   * @param {string} ability    e.g. "melee"
   * @param {object} [options]
   */
  static async rollAttributeAbility(actor, attribute, ability, options = {}) {
    const { RollDialog } = await import("./roll-dialog.mjs");
    const { EX2E }       = await import("../config.mjs");

    const sys = actor.system;

    // Resolve the starting attribute: argument → ability's defaultAttribute → "dexterity"
    const defaultAttr = attribute || sys.abilities[ability]?.defaultAttribute || "dexterity";
    const abilVal     = sys.abilities[ability]?.value ?? 0;
    const attrVal     = sys.attributes[defaultAttr]?.value ?? 0;
    const essenceVal  = sys.essence ?? 0;
    const basePool    = attrVal + abilVal;

    // Specialties for the ability (filter entries with no name)
    const specialties = (sys.abilities[ability]?.specialties ?? []).filter(s => s?.name?.trim());
    const selectedSpecialtyVal = options.specialtyValue ?? specialties[0]?.value ?? 0;
    // Build flat attribute list and value map for the dialog
    const attributeChoices = Object.entries(EX2E.attributes).flatMap(([, group]) =>
      Object.entries(group).map(([key, i18nKey]) => ({
        value: key,
        label: game.i18n.localize(i18nKey)
      }))
    );
    const attributeValues = Object.fromEntries(
      attributeChoices.map(c => [c.value, sys.attributes[c.value]?.value ?? 0])
    );

    // ── Excellency detection ───────────────────────────────────────────────
    // Lunars and Alchemicals use Attribute-keyed Excellencies; others use Ability keys.
    const exaltType   = sys.exaltType ?? "";
    const isAttrBased = ["lunar", "alchemical"].includes(exaltType);
    const allCharms   = actor.items.filter(i => i.type === "charm");

    const detectExc = (key) => ({
      first:  allCharms.some(c => c.system.excellency === "first"  && c.system.ability === key),
      second: allCharms.some(c => c.system.excellency === "second" && c.system.ability === key),
      third:  allCharms.some(c => c.system.excellency === "third"  && c.system.ability === key)
    });

    // Per-attribute map (used for live dialog updates when attribute changes)
    const excellencyPerAttr = isAttrBased
      ? Object.fromEntries(attributeChoices.map(c => [c.value, detectExc(c.value)]))
      : null;

    const excellency = isAttrBased ? detectExc(defaultAttr) : detectExc(ability);

    // Max caps: 1st = key rating, 2nd = ceil(key/2)
    let keyVal      = 0; //isAttrBased ? attrVal : abilVal;

    switch (exaltType) {
      case "alchemical":
      case "lunar":
        keyVal = attrVal;
        break;
      case "sidereal":
        keyVal = essenceVal; // Sidereals excel based on Essence, not an Attribute or Ability
      case "terrestrial":
        keyVal = abilVal + selectedSpecialtyVal; // Specialties can be excelled for these Exalt types, so include them in the cap calculation
        break;
      case "solar":
      case "abyssal":
      case "infernal":
      default:
        keyVal = attrVal + abilVal;
        break;
    }


    const firstExcMax  = keyVal;
    const secondExcMax = Math.floor(keyVal / 2);

    // Per-attribute max maps for dynamic dialog updates
    const firstExcMaxPerAttr  = isAttrBased
      ? Object.fromEntries(attributeChoices.map(c => [c.value, attributeValues[c.value] ?? 0]))
      : null;
    const secondExcMaxPerAttr = isAttrBased
      ? Object.fromEntries(attributeChoices.map(c => [c.value, Math.ceil((attributeValues[c.value] ?? 0) / 2)]))
      : null;

    const dialogResult = await RollDialog.prompt({
      pool:                basePool,
      attribute:           defaultAttr,
      attributeChoices:    attributeChoices,
      attributeValues:     attributeValues,
      abilityValue:        abilVal,
      specialties:         specialties,
      flavor:              options.flavor ?? `${defaultAttr} + ${ability}`,
      actorName:           actor.name,
      excellency:          excellency,
      excellencyPerAttr:   excellencyPerAttr,
      isAttrBased:         isAttrBased,
      firstExcMax:         firstExcMax,
      secondExcMax:        secondExcMax,
      firstExcMaxPerAttr:  firstExcMaxPerAttr,
      secondExcMaxPerAttr: secondExcMaxPerAttr,
      ...options
    });

    if (!dialogResult) return null;

    // Total mote cost = base + 1st exc (1m/die) + 2nd exc (2m/success) + 3rd exc (4m)
    const firstExcDice       = dialogResult.firstExcDice  ?? 0;
    const secondExcSuccesses = dialogResult.secondExcSucc ?? 0;
    const useThirdExcellency = dialogResult.useThirdExc   ?? false;
    const totalMoteCost      = dialogResult.moteCost
      + firstExcDice
      + (secondExcSuccesses * 2)
      + (useThirdExcellency ? 4 : 0);

    if (totalMoteCost > 0 && actor.type === "character") {
      const spent = await actor.spendMotes(totalMoteCost, dialogResult.moteType);
      if (!spent) return null;
    }

    const exRoll = new ExaltedRoll({
      pool:               dialogResult.pool + firstExcDice,
      flavor:             dialogResult.flavor,
      actorName:          actor.name,
      stunt:              dialogResult.stunt,
      moteCost:           totalMoteCost,
      moteType:           dialogResult.moteType,
      firstExcDice:       firstExcDice,
      secondExcSuccesses: secondExcSuccesses,
      useThirdExcellency: useThirdExcellency,
      specialty:          dialogResult.specialty ?? ""
    });

    return exRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  }

  // ── Attack Roll ─────────────────────────────────────────────────────────

  /**
   * Perform a weapon attack roll: attack pool vs target DV, then show
   * the resulting threshold and damage pool in chat.
   *
   * @param {ExaltedActor} actor
   * @param {string}       weaponId         The equipped weapon's item ID
   * @param {object}       [options]
   * @param {number}       [options.modeIndex=0]  Which mode of the weapon to use
   */
  static async rollAttack(actor, weaponId, options = {}) {
    const { AttackDialog } = await import("./attack-dialog.mjs");

    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;

    const sys  = actor.system;
    const wSys = weapon.system;

    // Resolve the selected mode of use
    const modeIndex = Math.max(0, Math.min(options.modeIndex ?? 0, (wSys.modes?.length ?? 1) - 1));
    const mode      = wSys.modes?.[modeIndex];
    if (!mode) return null;

    // Determine ability: ranged uses archery, thrown uses thrown, else melee
    const isMelee = mode.effectiveRange === 0;
    const baseAbility = isMelee ? "melee" : (mode.tags?.includes("Thrown") ? "thrown" : "archery");
    const baseAbilVal = sys.abilities[baseAbility]?.value ?? 0;
    // Tag-driven Martial Arts handling:
    //   - Natural: weapon MUST be wielded with Martial Arts (forced).
    //   - Martial Arts: use the higher of the base weapon ability or Martial Arts.
    const hasNaturalTag = mode.tags?.includes("Natural");
    const hasMATag      = mode.tags?.includes("Martial Arts");
    const maVal         = sys.abilities.martialArts?.value ?? 0;
    const useMA         = hasNaturalTag || (hasMATag && maVal > baseAbilVal);
    const ability       = useMA ? "martialArts" : baseAbility;
    const abilVal       = useMA ? maVal         : baseAbilVal;
    const attrVal   = sys.attributes.dexterity.value;
    const strVal    = sys.attributes.strength.value;

    // Attack pool = Dexterity + Ability + Weapon Accuracy
    const basePool = attrVal + abilVal + mode.effectiveAccuracy;

    // Wound penalty reduces pool
    const woundPenalty = sys.health?.woundPenalty ?? 0;
    const pool = Math.max(0, basePool + woundPenalty);

    // Excellency detection (same pattern as rollAttributeAbility)
    const exaltType   = sys.exaltType ?? "";
    const isAttrBased = ["lunar", "alchemical"].includes(exaltType);
    const allCharms   = actor.items.filter(i => i.type === "charm");
    // Third Excellency is not available at the attack roll (Step 3); it's
    // used in Steps 4 and 6 — wired up separately on the attack result card.
    const excKey = isAttrBased ? "dexterity" : ability;
    const detectExc = (key) => ({
      first:  allCharms.find(c => c.system.excellency === "first"  && c.system.ability === key) ?? null,
      second: allCharms.find(c => c.system.excellency === "second" && c.system.ability === key) ?? null
    });
    const excCharms  = detectExc(excKey);
    const excellency = { first: !!excCharms.first, second: !!excCharms.second };
    const firstExcLabel  = excCharms.first
      ? `${excCharms.first.name} (${game.i18n.localize("EX2E.FirstExcellency")})`
      : game.i18n.localize("EX2E.FirstExcellency");
    const secondExcLabel = excCharms.second
      ? `${excCharms.second.name} (${game.i18n.localize("EX2E.SecondExcellency")})`
      : game.i18n.localize("EX2E.SecondExcellency");

    // Third Excellency availability (checked at Step 4 reroll time, but the
    // charm has to exist up-front so the button can appear on the card).
    const attackerHasThirdExc = allCharms.some(c =>
      c.system.excellency === "third" && c.system.ability === excKey
    );

    let keyVal = 0;
    switch (exaltType) {
      case "lunar": 
      case "alchemical":
        keyVal = attrVal; 
        break;
      case "solar": 
      case "abyssal": 
      case "infernal": 
      default:
        keyVal = attrVal + abilVal; 
        break;
    }
    const firstExcMax  = keyVal;
    const secondExcMax = Math.ceil(keyVal / 2);

    // Capture a snapshot of the targeted token's defensive stats (both DVs
    // and the soak matching the weapon's damage type). This snapshot travels
    // in the chat message flags so the defender has everything they need
    // to resolve the attack even if the target selection changes later.
    let targetDodgeDV  = null;
    let targetParryDV  = null;
    let targetName     = null;
    let targetId       = null;
    let targetSoak     = 0;
    let targetHardness = 0;
    // Soak has a value per damage type (bashing/lethal/aggravated). Hardness
    // is a single stat but only applies against bashing or lethal attacks —
    // aggravated damage bypasses Hardness entirely.
    const ignoresHardness = mode.damageType === "aggravated";
    // Counterattacks pass the target actor directly (the original attacker);
    // normal attacks take the currently targeted token.
    const targetActor = options.explicitTargetActor
                     ?? game.user.targets.first()?.actor
                     ?? null;
    if (targetActor) {
      targetId   = targetActor.id;
      targetName = targetActor.name;
      const tSys = targetActor.system;
      if (targetActor.type === "character") {
        targetDodgeDV  = tSys.dodgeDV ?? 0;
        targetParryDV  = tSys.parryDV ?? tSys.parryDVBase ?? 0;
        targetSoak     = tSys.totalSoak?.[mode.damageType] ?? 0;
        targetHardness = ignoresHardness ? 0 : (tSys.hardness ?? 0);
      } else if (targetActor.type === "npc") {
        targetDodgeDV  = tSys.combat?.dodgeDV ?? 0;
        targetParryDV  = tSys.combat?.parryDV ?? 0;
        targetSoak     = tSys.combat?.soak?.[mode.damageType] ?? 0;
        targetHardness = ignoresHardness ? 0 : (tSys.combat?.hardness ?? 0);
      }
    }

    const dialogResult = await AttackDialog.prompt({
      pool, excellency, firstExcMax, secondExcMax,
      firstExcLabel, secondExcLabel
    });
    if (!dialogResult) return null;

    // Mote costs (First/Second Excellency only — Third is not used at Step 3)
    const firstExcDice       = dialogResult.firstExcDice  ?? 0;
    const secondExcSuccesses = dialogResult.secondExcSucc ?? 0;
    const totalMoteCost      = firstExcDice + (secondExcSuccesses * 2);

    if (totalMoteCost > 0 && actor.type === "character") {
      const spent = await actor.spendMotes(totalMoteCost, dialogResult.moteType);
      if (!spent) return null;
    }

    // Build and evaluate the attack roll
    const displayName = (wSys.modes?.length ?? 1) > 1 ? `${weapon.name} — ${mode.name}` : weapon.name;
    const attackRoll = new ExaltedRoll({
      pool:               pool + firstExcDice,
      flavor:             `${displayName} — ${game.i18n.localize("EX2E.AttackRoll")}`,
      actorName:          actor.name,
      stunt:              dialogResult.stunt,
      moteCost:           totalMoteCost,
      moteType:           dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses
    });
    const result = await attackRoll.evaluate();

    // Attack data snapshot — stored on the chat message as flags. The card
    // starts in "defense pending" state; the defender picks Dodge or Parry
    // (or the GM enters a manual DV when no target is selected), at which
    // point the card is re-rendered with hit/miss and damage.
    const typeSuffix          = mode.damageType === "lethal" ? "L" : mode.damageType === "aggravated" ? "A" : "B";
    const overwhelmingSuffix  = mode.tags?.includes("Overwhelming") ? `/${mode.overwhelming ?? 1}` : "";
    const attack = {
      actorId:             actor.id,
      actorName:           actor.name,
      weaponName:          displayName,
      dice:                result.diceDetails,
      pool:                result.pool,
      successes:           result.successes,
      botch:               result.botch,
      stunt:               dialogResult.stunt,
      moteCost:            totalMoteCost,
      moteType:            dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses,
      attackerHasThirdExc,
      attackerExcKey:      excKey,
      weaponDamage:        mode.effectiveDamage,
      damageType:          mode.damageType,
      damageTypeLabel:     `${typeSuffix}${overwhelmingSuffix}`,
      addStrength:         isMelee,
      strengthValue:       strVal,
      overwhelming:        mode.overwhelming ?? 1,
      targetId,
      targetName,
      targetDodgeDV,
      targetParryDV,
      targetSoak,
      targetHardness,
      isCounterattack:         !!options.isCounterattack,
      originalAttackMessageId: options.originalAttackMessageId ?? null,
      defense:             null
    };

    const content = await renderAttackCardContent(attack);

    return ChatMessage.create({
      content,
      rolls:   [result.foundryRoll],
      sound:   CONFIG.sounds.dice,
      speaker: ChatMessage.getSpeaker({ actor }),
      flags:   { exalted2e: { attack } }
    });
  }
}

/**
 * Render the attack-result chat card from a stored attack snapshot.
 *
 * Computes defense-dependent fields (threshold, hit, raw damage pool) when
 * the defender has chosen a defense, and returns HTML ready to post or
 * update into a ChatMessage. Shared between the initial post (pre-defense)
 * and the re-render triggered when the defender picks Dodge or Parry.
 *
 * @param {object} attack  Snapshot stored in flags.exalted2e.attack
 * @returns {Promise<string>} Rendered HTML
 */
export async function renderAttackCardContent(attack) {
  const data = { ...attack, defenseChosen: !!attack.defense };
  if (attack.defense) {
    const threshold = Math.max(0, attack.successes - attack.defense.dv);
    const hit       = threshold > 0;
    data.threshold     = threshold;
    data.hit           = hit;
    data.targetDV      = attack.defense.dv;
    data.rawDamagePool = hit
      ? threshold + attack.weaponDamage + (attack.addStrength ? attack.strengthValue : 0)
      : 0;

    // Step 8: Hardness check. If the target's Hardness exceeds the raw
    // damage pool the attack is stopped — no damage roll, no soak applied.
    data.hardnessStops = hit && (attack.targetHardness ?? 0) > data.rawDamagePool;
    data.defenseLabelKey = {
      dodge:  "EX2E.DodgeDV",
      parry:  "EX2E.ParryDV",
      manual: "EX2E.TargetDV"
    }[attack.defense.type] ?? "EX2E.TargetDV";

    // Step 4 / Step 5 gating. Each side is eligible if it has a Third-Exc
    // charm for the relevant ability AND spent nothing on First/Second Exc.
    // A step is complete when it's either not eligible, the charm was used,
    // or the side explicitly skipped. Step 5 only opens once Step 4 closes;
    // the hit/miss/damage section is gated until both steps are complete.
    const attackerEligible = !!attack.attackerHasThirdExc
      && (attack.firstExcDice       ?? 0) === 0
      && (attack.secondExcSuccesses ?? 0) === 0;
    const defenderEligible = !!attack.defenderHasThirdExc
      && (attack.defenderFirstExcDice ?? 0) === 0
      && (attack.defenderSecondExcSucc ?? 0) === 0;

    const step4Complete = !attackerEligible
                       || !!attack.thirdExcUsedByAttacker
                       || !!attack.step4Passed;
    const step5Complete = step4Complete && (
                          !defenderEligible
                       || !!attack.thirdExcUsedByDefender
                       || !!attack.step5Passed
                       );

    data.showAttackerReroll = !step4Complete;
    data.showDefenderReroll = step4Complete && !step5Complete;
    data.showResolution     = step4Complete && step5Complete;

    // Step 9: Counterattack. Offered when Step 8 passes (hit, not stopped by
    // hardness), the card isn't itself a counterattack, and the defender has
    // at least one charm with the Counterattack keyword. Step 9 is complete
    // once the counterattack has been triggered or the defender skipped.
    const step9Applicable = step5Complete
                         && (data.hit ?? false)
                         && !data.hardnessStops
                         && !attack.isCounterattack
                         && !!attack.defenderHasCounterattack;
    const step9Complete = !step9Applicable
                       || !!attack.counterattackTriggered
                       || !!attack.step9Passed;
    data.showCounterattack = step9Applicable && !step9Complete;
    data.showRollDamage    = (data.hit ?? false) && !data.hardnessStops && step9Complete;
  }
  return foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/attack-result.hbs",
    data
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The evaluated result of an ExaltedRoll.
 */
export class ExaltedRollResult {

  constructor(dice, options = {}) {
    this.dice             = dice;               // array of die face values
    this.pool             = options.pool;
    this.flavor           = options.flavor             ?? "";
    this.actorName        = options.actorName          ?? "";
    this.stunt            = options.stunt              ?? 0;
    this.moteCost         = options.moteCost           ?? 0;
    this.moteType         = options.moteType           ?? "peripheral";
    this.foundryRoll      = options.foundryRoll;
    this.firstExcDice        = options.firstExcDice        ?? 0;
    this.secondExcSuccesses  = options.secondExcSuccesses  ?? 0;
    this.usedThirdExcellency = options.usedThirdExcellency ?? false;
    this.specialty           = options.specialty            ?? null;

    // ── Count successes from dice ────────────────────────────────────────
    this.rawSuccesses = 0;
    this.ones         = 0;
    this.diceDetails  = [];

    for (const face of this.dice) {
      let succs = 0;
      let cls   = "";
      if (face === 10) {
        succs = 2;
        cls   = "double-success";
        this.rawSuccesses += 2;
      } else if (face >= 7) {
        succs = 1;
        cls   = "success";
        this.rawSuccesses += 1;
      } else if (face === 1) {
        this.ones += 1;
        cls = "one";
      } else {
        cls = "miss";
      }
      this.diceDetails.push({ face, succs, cls });
    }

    // Second Excellency successes are added after dice (and can prevent botch)
    this.rawSuccesses += this.secondExcSuccesses;

    this.successes = Math.max(0, this.rawSuccesses);
    this.botch     = this.rawSuccesses <= 0 && this.ones > 0;
    this.failure   = this.rawSuccesses <= 0 && !this.botch;
    this.success   = this.rawSuccesses > 0;

    if (this.botch)        { this.resultLabel = "Botch";   this.resultClass = "botch"; }
    else if (this.failure) { this.resultLabel = "Failure"; this.resultClass = "failure"; }
    else                   { this.resultLabel = `${this.successes} Success${this.successes !== 1 ? "es" : ""}`; this.resultClass = "success"; }
  }

  /**
   * Send this result to the chat log.
   */
  async toMessage(chatOptions = {}) {
    const templateData = {
      dice:                this.diceDetails,
      pool:                this.pool,
      successes:           this.successes,
      resultLabel:         this.resultLabel,
      resultClass:         this.resultClass,
      botch:               this.botch,
      flavor:              this.flavor,
      actorName:           this.actorName,
      stunt:               this.stunt,
      moteCost:            this.moteCost,
      moteType:            this.moteType,
      ones:                this.ones,
      firstExcDice:        this.firstExcDice,
      secondExcSuccesses:  this.secondExcSuccesses,
      usedThirdExcellency: this.usedThirdExcellency,
      specialty:           this.specialty
    };

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/roll-result.hbs",
      templateData
    );

    return ChatMessage.create({
      content,
      rolls:  [this.foundryRoll],
      sound:  CONFIG.sounds.dice,
      ...chatOptions
    });
  }
}
