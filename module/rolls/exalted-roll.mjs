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
   * @param {string}       weaponId  The equipped weapon's item ID
   * @param {object}       [options]
   */
  static async rollAttack(actor, weaponId, options = {}) {
    const { AttackDialog } = await import("./attack-dialog.mjs");
    const { EX2E }         = await import("../config.mjs");

    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;

    const sys  = actor.system;
    const wSys = weapon.system;

    // Determine ability: ranged uses archery, thrown uses thrown, else melee
    const isMelee = wSys.effectiveRange === 0;
    const baseAbility = isMelee ? "melee" : (wSys.tags?.includes("Thrown") ? "thrown" : "archery");
    const baseAbilVal = sys.abilities[baseAbility]?.value ?? 0;
    // Tag-driven Martial Arts handling:
    //   - Natural: weapon MUST be wielded with Martial Arts (forced).
    //   - Martial Arts: use the higher of the base weapon ability or Martial Arts.
    const hasNaturalTag = wSys.tags?.includes("Natural");
    const hasMATag      = wSys.tags?.includes("Martial Arts");
    const maVal         = sys.abilities.martialArts?.value ?? 0;
    const useMA         = hasNaturalTag || (hasMATag && maVal > baseAbilVal);
    const ability       = useMA ? "martialArts" : baseAbility;
    const abilVal       = useMA ? maVal         : baseAbilVal;
    const attrVal   = sys.attributes.dexterity.value;
    const strVal    = sys.attributes.strength.value;

    // Attack pool = Dexterity + Ability + Weapon Accuracy
    const basePool = attrVal + abilVal + wSys.effectiveAccuracy;

    // Wound penalty reduces pool
    const woundPenalty = sys.health?.woundPenalty ?? 0;
    const pool = Math.max(0, basePool + woundPenalty);

    // Excellency detection (same pattern as rollAttributeAbility)
    const exaltType   = sys.exaltType ?? "";
    const isAttrBased = ["lunar", "alchemical"].includes(exaltType);
    const allCharms   = actor.items.filter(i => i.type === "charm");
    const detectExc = (key) => ({
      first:  allCharms.some(c => c.system.excellency === "first"  && c.system.ability === key),
      second: allCharms.some(c => c.system.excellency === "second" && c.system.ability === key),
      third:  allCharms.some(c => c.system.excellency === "third"  && c.system.ability === key)
    });
    const excellency = isAttrBased ? detectExc("dexterity") : detectExc(ability);

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

    // Check for a targeted token and resolve both DVs
    let targetDodgeDV = null;
    let targetParryDV = null;
    let targetName    = null;
    const targets = game.user.targets;
    if (targets.size > 0) {
      const targetToken = targets.first();
      const targetActor = targetToken?.actor;
      if (targetActor) {
        targetName = targetActor.name;
        const tSys = targetActor.system;
        if (targetActor.type === "character") {
          targetDodgeDV = tSys.dodgeDV ?? 0;
          targetParryDV = tSys.parryDVBase ?? 0;
        } else if (targetActor.type === "npc") {
          targetDodgeDV = tSys.combat?.dodgeDV ?? 0;
          targetParryDV = tSys.combat?.parryDV ?? 0;
        }
      }
    }

    const dialogResult = await AttackDialog.prompt({
      pool, excellency, firstExcMax, secondExcMax,
      targetDodgeDV, targetParryDV, targetName
    });
    if (!dialogResult) return null;

    // Mote costs
    const firstExcDice       = dialogResult.firstExcDice  ?? 0;
    const secondExcSuccesses = dialogResult.secondExcSucc ?? 0;
    const useThirdExcellency = dialogResult.useThirdExc   ?? false;
    const totalMoteCost      = firstExcDice + (secondExcSuccesses * 2) + (useThirdExcellency ? 4 : 0);

    if (totalMoteCost > 0 && actor.type === "character") {
      const spent = await actor.spendMotes(totalMoteCost, dialogResult.moteType);
      if (!spent) return null;
    }

    // Build and evaluate the attack roll
    const attackRoll = new ExaltedRoll({
      pool:               pool + firstExcDice,
      flavor:             `${weapon.name} — ${game.i18n.localize("EX2E.AttackRoll")}`,
      actorName:          actor.name,
      stunt:              dialogResult.stunt,
      moteCost:           totalMoteCost,
      moteType:           dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses,
      useThirdExcellency
    });
    const result = await attackRoll.evaluate();

    // Attack resolution
    const targetDV  = dialogResult.targetDV;
    const threshold = result.successes - targetDV;
    const hit       = threshold > 0;

    // Damage pool = threshold + weapon damage + Strength (melee only)
    const addStrength   = isMelee;
    const rawDamagePool = hit ? threshold + wSys.effectiveDamage + (addStrength ? strVal : 0) : 0;
    const typeSuffix = wSys.damageType === "lethal" ? "L" : wSys.damageType === "aggravated" ? "A" : "B";
    const overwhelmingSuffix = wSys.tags?.includes("Overwhelming") ? `/${wSys.overwhelming ?? 1}` : "";
    const damageTypeLabel = `${typeSuffix}${overwhelmingSuffix}`;

    // Resolve target soak for the damage type (auto-fill if target exists)
    let targetSoak = 0;
    let targetId   = null;
    if (targetName && targets.size > 0) {
      const targetActor = targets.first()?.actor;
      if (targetActor) {
        targetId = targetActor.id;
        const tSys = targetActor.system;
        if (targetActor.type === "character") {
          targetSoak = tSys.totalSoak?.[wSys.damageType] ?? 0;
        } else if (targetActor.type === "npc") {
          targetSoak = tSys.combat?.soak?.[wSys.damageType] ?? 0;
        }
      }
    }

    // Render attack result chat card
    const templateData = {
      dice:                result.diceDetails,
      pool:                result.pool,
      successes:           result.successes,
      botch:               result.botch,
      actorId:             actor.id,
      actorName:           actor.name,
      weaponName:          weapon.name,
      stunt:               dialogResult.stunt,
      moteCost:            totalMoteCost,
      moteType:            dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses:  secondExcSuccesses,
      usedThirdExcellency: useThirdExcellency,
      targetDV,
      targetName,
      targetId,
      targetSoak,
      threshold:           Math.max(0, threshold),
      hit,
      weaponDamage:        wSys.effectiveDamage,
      damageType:          wSys.damageType,
      damageTypeLabel,
      addStrength:         addStrength && hit,
      strengthValue:       strVal,
      rawDamagePool,
      overwhelming:        wSys.overwhelming ?? 1
    };

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/attack-result.hbs",
      templateData
    );

    return ChatMessage.create({
      content,
      rolls:  [result.foundryRoll],
      sound:  CONFIG.sounds.dice,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
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
