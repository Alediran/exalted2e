import {
  verifyClaims,
  computeStackingMod,
  computeMdvShiftFromApp,
  computeBaseMDV,
  checkNaturalCap,
  computeWpToResist,
  aggregateAttackerCharms       // 3c-1
} from "./social-attack-math.mjs";
import { findCampaign } from "./motivation-break-math.mjs";
import { countSuccesses } from "./dice-math.mjs";
import {
  computeAttackPool,
  computeAimBonus,
  computeHolyUpgrade,
  computeAttackOutcome
} from "./attack-math.mjs";
import { computeAttackExcellencyCaps } from "./excellency-math.mjs";
import { bankStuntReward } from "../combat/stunt-payment.mjs";
import { computeAttackCharmBonus, computeSocialCharmBonus } from "./charm-combat-math.mjs";
import { aggregateExtraActionsMaxFromAEs, aggregateSpeedModifierFromAEs, getMasteryDiscount } from "./charm-passive-math.mjs";
import { evaluateCharmFormula, sendCombinedActivationCard } from "../documents/item.mjs";
import { getTerrainBonuses } from "../helpers/terrain.mjs";

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
    // External penalty subtracts from successes after the roll (does NOT
    // touch the pool, and does NOT affect botch detection).
    this.externalPenalty    = options.externalPenalty    ?? 0;

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
      specialty:           this.specialty,
      externalPenalty:     this.externalPenalty
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
   * Roll an arbitrary dice pool for an actor, honouring the standard
   * penalty stack: wound penalty (universal), internal penalty for the
   * given category (subtracts dice), external penalty for the given
   * category (subtracts successes post-roll). Used by every non-dialog
   * entry point — attribute-only rolls, custom pool buttons on the
   * sheets, Join Battle — so they all go through the same penalty-aware
   * pipeline.
   *
   * Category values: "physical" | "social" | "mental" | "all". "all"
   * matches only penalties whose own type is "all" (wound + aborted-Aim
   * etc.); it doesn't match physical-specific penalties like Prone.
   *
   * @param {ExaltedActor} actor
   * @param {object} [opts]
   * @param {number} [opts.pool=0]       Base pool before penalties.
   * @param {string} [opts.flavor=""]    Chat flavor text.
   * @param {string} [opts.category="all"]
   * @returns {Promise<ExaltedRollResult>}
   */
  static async rollPool(actor, { pool = 0, flavor = "", category = "all" } = {}) {
    const internal = actor.internalPenaltyFor?.(category) ?? 0;
    const external = actor.externalPenaltyFor?.(category) ?? 0;
    const wound    = Number(actor.system?.health?.woundPenalty) || 0;

    const finalPool = Math.max(0, (pool ?? 0) + wound - internal);

    const roll = new ExaltedRoll({
      pool:            finalPool,
      flavor,
      actorName:       actor.name,
      externalPenalty: external
    });
    const result = await roll.evaluate();
    await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
    return result;
  }

  /**
   * Roll a bare attribute (no ability, no dialog) with automatic
   * category detection from the attribute's group in EX2E.attributes.
   * Delegates to `rollPool` for the penalty handling.
   */
  static async rollAttribute(actor, attributeKey, { flavor } = {}) {
    const { EX2E } = await import("../config.mjs");
    const val = actor.system?.attributes?.[attributeKey]?.value ?? 0;
    let category = "all";
    for (const [group, attrs] of Object.entries(EX2E.attributes ?? {})) {
      if (attrs[attributeKey]) { category = group; break; }
    }
    const defaultFlavor = game.i18n.localize(
      `EX2E.Attr${attributeKey.charAt(0).toUpperCase() + attributeKey.slice(1)}`
    );
    return this.rollPool(actor, {
      pool:   val,
      flavor: flavor ?? defaultFlavor,
      category
    });
  }

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
    // Base pool — raw attribute + ability, before any penalties.
    const rawPool = attrVal + abilVal;

    // Penalties from active effects split by category:
    //   • Internal (aborted-Aim -2, etc.) reduces the DICE POOL — fed to
    //     the dialog so the pool display tracks the selected attribute.
    //   • External (Prone -1, etc.) reduces SUCCESSES after the roll
    //     resolves — applied on the ExaltedRoll via `externalPenalty`.
    //   Both only apply when the selected attribute is physical today;
    //   Social / Mental categories plug into the same machinery later.
    const physicalKeys = new Set(Object.keys(EX2E.attributes.physical));
    const externalPhysicalPenalty = actor.externalPenaltyFor?.("physical") ?? 0;
    const internalPhysicalPenalty = actor.internalPenaltyFor?.("physical") ?? 0;
    // Wound penalty is universal — applies to every action regardless of
    // attribute category. `system.health.woundPenalty` is stored as a
    // negative integer (e.g., -1, -2, -4), so adding it reduces the pool.
    const woundPenalty = Number(sys.health?.woundPenalty) || 0;
    // Per-attribute pool modifier: internal physical penalty on physical
    // attributes only; wound penalty on everything. Flipping mid-dialog
    // to a mental attribute correctly drops the physical penalty.
    const poolPenaltyByAttr = Object.fromEntries(
      Object.entries(
        Object.assign({}, ...Object.values(EX2E.attributes))
      ).map(([k]) => [k, (physicalKeys.has(k) ? -internalPhysicalPenalty : 0) + woundPenalty])
    );
    // Clarity penalties for Alchemical actors
    const _clarityMods = sys.clarityModifiers ?? {};
    const _SOCIAL_ABILITIES = new Set(["presence", "performance", "bureaucracy", "investigation"]);
    const _MENTAL_ATTR_KEYS = new Set(Object.keys(EX2E.attributes.mental ?? {}));
    if (sys.exaltType === "alchemical") {
      if (_SOCIAL_ABILITIES.has(ability) && _clarityMods.socialPenalty > 0) {
        for (const k of Object.keys(poolPenaltyByAttr)) {
          poolPenaltyByAttr[k] = (poolPenaltyByAttr[k] ?? 0) - _clarityMods.socialPenalty;
        }
      }
      if (_clarityMods.mentalBonus > 0) {
        for (const k of _MENTAL_ATTR_KEYS) {
          if (k in poolPenaltyByAttr) poolPenaltyByAttr[k] = (poolPenaltyByAttr[k] ?? 0) + _clarityMods.mentalBonus;
        }
      }
    }
    // Recompute base pool after clarity mutations so the dialog receives the
    // correct starting pool for the default attribute.
    const basePoolAfterClarity = Math.max(0, rawPool + (poolPenaltyByAttr[defaultAttr] ?? 0));

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

    if (exaltType === "mortal") {
      excellency.first  = false;
      excellency.second = false;
      excellency.third  = false;
    }

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
        keyVal = attrVal + abilVal;
        break;
      case "mortal":
        keyVal = 0;
        break;
      default:
        keyVal = attrVal + abilVal;
        break;
    }


    const firstExcMax  = keyVal;
    const secondExcMax = Math.floor(keyVal / 2);

    const masteryDiscount = isAttrBased ? 0 : getMasteryDiscount(actor, ability);

    // Per-attribute max maps for dynamic dialog updates
    const firstExcMaxPerAttr  = isAttrBased
      ? Object.fromEntries(attributeChoices.map(c => [c.value, attributeValues[c.value] ?? 0]))
      : null;
    const secondExcMaxPerAttr = isAttrBased
      ? Object.fromEntries(attributeChoices.map(c => [c.value, Math.ceil((attributeValues[c.value] ?? 0) / 2)]))
      : null;

    // Mental influence effects — read actor AEs into dialog
    const { buildMentalInfluenceEffects } = await import("../ui/social-influence-effects.mjs");
    const mentalInfluenceEffects = buildMentalInfluenceEffects(actor);

    const dialogResult = await RollDialog.prompt({
      pool:                basePoolAfterClarity,
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
      poolPenaltyByAttr:   poolPenaltyByAttr,
      clarityInfo: (sys.exaltType === "alchemical" && (_clarityMods.autochthonBonus ?? 0) > 0)
        ? { autochthonBonus: _clarityMods.autochthonBonus }
        : null,
      virtues: actor.type === "character" ? sys.virtues : null,
      mentalInfluenceEffects,
      ...options
    });


    if (!dialogResult) return null;

    // ── Mental influence resistance ──────────────────────────────────────
    const miPenalty     = dialogResult.mentalInfluencePenalty ?? 0;
    const miWpToResist  = dialogResult.wpToResist             ?? 0;
    const miResistedIds = dialogResult.resistedEffectIds       ?? [];

    // NPC actors don't track WP meaningfully — skip deduction silently.
    // The update must complete before virtue-channel code below re-reads willpower.
    if (miWpToResist > 0 && actor.type === "character") {
      const curWP = actor.system.willpower?.value ?? 0;
      await actor.update({ "system.willpower.value": Math.max(0, curWP - miWpToResist) });
      if (miResistedIds.length > 0) {
        const resistedNames = miResistedIds
          .map(id => actor.effects.get(id)?.name ?? "?")
          .join(", ");
        await ChatMessage.create({
          content: game.i18n.format("EX2E.ResistanceSpentWP", {
            name:  actor.name,
            wp:    miWpToResist,
            charm: resistedNames,
          }),
          whisper: ChatMessage.getWhisperRecipients("GM"),
          speaker: ChatMessage.getSpeaker({ actor }),
        });
      }
      // Delete resisted Compel AEs; Servitude carries gmOnlyRemoval and must be lifted by the GM.
      const compelIds = miResistedIds.filter(id => {
        const ae = actor.effects.get(id);
        return ae?.flags?.exalted2e?.keyword === "Compel";
      });
      if (compelIds.length > 0) {
        const { clearSocialInfluenceEffects } = await import("../ui/social-influence-effects.mjs");
        await clearSocialInfluenceEffects(actor, compelIds);
      }
    }

    // Total mote cost = base + excellency (flat mastery discount applied across all tiers)
    const firstExcDice       = dialogResult.firstExcDice  ?? 0;
    const secondExcSuccesses = dialogResult.secondExcSucc ?? 0;
    const useThirdExcellency = dialogResult.useThirdExc   ?? false;
    const rawExcCost         = firstExcDice + secondExcSuccesses * 2 + (useThirdExcellency ? 4 : 0);
    const totalMoteCost      = dialogResult.moteCost + Math.max(0, rawExcCost - masteryDiscount);

    if (totalMoteCost > 0 && actor.type === "character") {
      const spent = await actor.spendMotes(totalMoteCost, dialogResult.moteType);
      if (!spent) return null;
    }

    // Handle virtue channeling — spend WP (and optionally 1 virtue channel point)
    let virtueChannelDice      = 0;
    let virtueChannelSuccesses = 0;
    const vMode = dialogResult.virtueChannelMode ?? "none";
    if (vMode !== "none" && actor.type === "character") {
      const curWP = actor.system.willpower?.value ?? 0;
      if (curWP < 1) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughWillpower"));
      } else if (vMode === "success") {
        await actor.update({ "system.willpower.value": curWP - 1 });
        virtueChannelSuccesses = 1;
      } else if (vMode === "dice" && dialogResult.virtueChannel) {
        const vKey   = dialogResult.virtueChannel;
        const virtue = actor.system.virtues?.[vKey];
        const curBox = virtue?.current ?? 0;
        if (curBox < 1) {
          ui.notifications.warn(game.i18n.format("EX2E.VirtueChannelNoPoints", {
            virtue: game.i18n.localize(`EX2E.Virtue${vKey.charAt(0).toUpperCase() + vKey.slice(1)}`)
          }));
        } else {
          await actor.update({
            "system.willpower.value":             curWP - 1,
            [`system.virtues.${vKey}.current`]:   Math.max(0, curBox - 1),
            [`system.virtues.${vKey}.channeled`]: true
          });
          virtueChannelDice = virtue?.value ?? 0;
        }
      }
    }

    // External penalty that applies to this roll's successes — only when
    // the attribute finally picked in the dialog is physical.
    const finalAttr = dialogResult.attribute ?? defaultAttr;
    const externalSuccessPenalty = physicalKeys.has(finalAttr) ? externalPhysicalPenalty : 0;

    const exRoll = new ExaltedRoll({
      pool:               Math.max(0, dialogResult.pool + firstExcDice + virtueChannelDice - miPenalty),
      flavor:             dialogResult.flavor,
      actorName:          actor.name,
      stunt:              dialogResult.stunt,
      moteCost:           totalMoteCost,
      moteType:           dialogResult.moteType,
      firstExcDice:       firstExcDice,
      secondExcSuccesses: secondExcSuccesses + virtueChannelSuccesses,
      useThirdExcellency: useThirdExcellency,
      specialty:          dialogResult.specialty ?? "",
      externalPenalty:    externalSuccessPenalty
    });

    // Evaluate once, post the chat card with the evaluated result, and
    // hand that result back so callers can inspect `successes` / `botch`
    // (e.g., Rise-from-Prone checks against Difficulty 2). `ExaltedRoll`
    // itself never carries the successes — the tally lives on the
    // ExaltedRollResult returned by evaluate().
    const result = await exRoll.evaluate();
    const message = await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
    await bankStuntReward(actor, {
      stunt:              dialogResult.stunt,
      advancesMotivation: dialogResult.advancesMotivation ?? false,
      rewardKind:         dialogResult.rewardKind ?? "motes",
      sourceMessageId:    message?.id ?? null
    }).catch(err =>
      console.error("exalted2e | stunt banking failed", err)
    );
    return result;
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
    if (actor.type !== "character") return null;
    const { AttackDialog } = await import("./attack-dialog.mjs");

    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return null;

    const sys  = actor.system;
    const wSys = weapon.system;

    // Resolve the selected mode of use
    const modeIndex = Math.max(0, Math.min(options.modeIndex ?? 0, (wSys.modes?.length ?? 1) - 1));
    const mode      = wSys.modes?.[modeIndex];
    if (!mode) return null;

    // ── Area Attack detection ────────────────────────────────────────────
    const charm = options.charmSourceId ? actor.items.get(options.charmSourceId) : null;
    const isAreaAttack = mode.tags.includes("Area") || !!charm?.system?.attack?.areaAttack;
    const areaConfig = isAreaAttack ? {
      shape:  charm?.system?.attack?.areaShape    ?? mode.areaShape    ?? "circle",
      size:   charm?.system?.attack?.areaSize     ?? mode.areaSize     ?? "3",
      resist: {
        pool:       charm?.system?.attack?.areaResistPool       ?? mode.areaResistPool       ?? "stamina+resistance",
        difficulty: charm?.system?.attack?.areaResistDifficulty ?? mode.areaResistDifficulty ?? "1",
        effect:     charm?.system?.attack?.areaResistEffect     ?? mode.areaResistEffect     ?? "avoid",
      }
    } : null;

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

    // Attack pool.
    //   • Regular weapon: pool = Dexterity + Ability + weapon Accuracy bonus.
    //   • Instant-duration charm attack: the charm's accuracy formula IS
    //     the full dice pool (canon charm descriptions quote the whole
    //     pool, not a modifier). Adding Dex + Ability on top would
    //     double-count, and the damage formula is likewise the full
    //     pre-threshold damage (no auto-Strength bonus).
    //   • Longer-duration charm attack: spawns a real weapon, so the
    //     normal flow applies — charm authors write stats the same way
    //     they would for any weapon.
    const isInstantCharmAttack = weapon.getFlag("exalted2e", "charmDuration") === "instant";

    // Wound penalty reduces pool.
    const woundPenalty = sys.health?.woundPenalty ?? 0;

    // Flurry dice penalty: if this actor has declared a flurry this turn,
    // every attack in the flurry suffers -(N − 1) dice (internal penalty).
    // The declaration lives on the combatant, not the actor, so we look up
    // the active combat's entry for this actor.
    const attackerCombatant = game.combat?.combatants?.find(c => c.actorId === actor.id) ?? null;
    const flurryFlag        = attackerCombatant?.getFlag("exalted2e", "flurry") ?? null;
    const flurryPenalty     = flurryFlag?.dicePenalty ?? 0;

    // Counterattacks pass the target actor directly (the original attacker);
    // normal attacks take the currently targeted token, and if nothing is
    // targeted yet we hand the attacker's user a canvas picker to click a
    // victim. Right-click / Esc cancels the attack.
    let targetActor = options.explicitTargetActor
      ?? game.user.targets.first()?.actor
      ?? null;

    // Aim bonus: if the attacker is aiming at THIS target, add 1 die per
    // elapsed tick since aim started (cap +3). Stale when the canvas picker
    // runs below and chooses a different target — that's pre-existing
    // behavior and out of this sprint's scope.
    const multiTickAction = attackerCombatant?.getFlag("exalted2e", "multiTickAction") ?? null;
    const aimBonus = computeAimBonus({
      multiTickAction,
      targetActorId: targetActor?.id ?? null,
      currentTick:   game.combat?.currentTick ?? 0
    });

    // Internal + external penalties from active effects. Attacks are
    // always physical, so the category is fixed here.
    //   • Internal (e.g., aborted-Aim -2) reduces the dice pool.
    //   • External (e.g., Prone -1) reduces the success tally after
    //     the roll resolves — applied below, post-threshold.
    const internalPenalty = actor.internalPenaltyFor?.("physical") ?? 0;
    let externalPenalty   = actor.externalPenaltyFor?.("physical") ?? 0;

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
      ? excCharms.first.name
      : game.i18n.localize("EX2E.FirstExcellency");
    const secondExcLabel = excCharms.second
      ? excCharms.second.name
      : game.i18n.localize("EX2E.SecondExcellency");

    // Third Excellency availability (checked at Step 4 reroll time, but the
    // charm has to exist up-front so the button can appear on the card).
    const attackerHasThirdExc = allCharms.some(c =>
      c.system.excellency === "third" && c.system.ability === excKey
    );

    // Physical attacks always key on Dexterity (see attribute lookup
    // higher in this function). The helper is parameterised on attribute
    // for the social-attack pipeline, which uses Cha/Man/App.
    const { firstExcMax, secondExcMax } = computeAttackExcellencyCaps(actor, "dexterity", ability);
    const attackMasteryDiscount = isAttrBased ? 0 : getMasteryDiscount(actor, ability);

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
    let targetArmorSoak = 0;

    if (!targetActor && !options.isCounterattack && !isAreaAttack) {
      const { pickTargetActor } = await import("../helpers/targeting.mjs");
      targetActor = await pickTargetActor();
      if (!targetActor) return null; // cancelled
    }

    // Emotion −3: computed after target resolution so the canvas picker path
    // always yields the correct target id.
    const { computeEmotionMajorPenalty } = await import("../ui/social-influence-effects.mjs");
    const emotionMajorPenalty = computeEmotionMajorPenalty(
      actor.effects,
      targetActor?.id ?? ""
    );

    // Range check — abort if out of range; otherwise capture band + penalty.
    // Counterattacks skip this (always in range by definition).
    // `checkAttackRange` returns null when tokens aren't on a scene; pass through.
    let rangePenalty = 0;
    let rangeBand    = null;
    if (targetActor && !options.isCounterattack && !isAreaAttack) {
      const { checkAttackRange } = await import("../helpers/targeting.mjs");
      const rangeInfo = checkAttackRange(mode, actor, targetActor);
      if (rangeInfo && !rangeInfo.inRange) {
        ui.notifications.warn(game.i18n.format("EX2E.TargetOutOfRange", {
          distance: Math.round(rangeInfo.distance),
          max:      rangeInfo.maxRange
        }));
        return null;
      }
      if (rangeInfo) {
        rangePenalty = rangeInfo.rangePenalty ?? 0;
        rangeBand    = rangeInfo.band ?? null;
      }
    }
    if (targetActor) {
      targetId   = targetActor.id;
      targetName = targetActor.name;
      const tSys = targetActor.system;
      // DVs go through the actor's current getters so any active effect
      // penalties (flurry, onslaught, etc.) are reflected in the snapshot.
      targetDodgeDV = targetActor.currentDodgeDV ?? 0;
      targetParryDV = targetActor.currentParryDV ?? 0;
      if (targetActor.type === "character") {
        targetSoak      = tSys.totalSoak?.[mode.damageType] ?? 0;
        targetArmorSoak = tSys.armorSoak?.[mode.damageType] ?? 0;
        targetHardness  = ignoresHardness ? 0 : (tSys.hardness ?? 0);
      } else if (targetActor.type === "npc") {
        targetSoak      = tSys.combat?.soak?.[mode.damageType] ?? 0;
        targetArmorSoak = 0;
        targetHardness  = ignoresHardness ? 0 : (tSys.combat?.hardness ?? 0);
      }
      if (!isAreaAttack) {
        // Onslaught: RAW, a defender accrues +1 DV penalty every time they
        // are attacked (hit, miss, perfect-defended — it all triggers).
        // Applied AFTER the DV snapshot above so this attack's resolution
        // uses the pre-bump DVs; the next attack will see the bumped total.
        // Cleared by advanceWheel when the defender becomes free again.
        await targetActor.addOnslaught();

        // Starmetal artifact armor worn by the defender imposes an external
        // penalty on the attacker's success tally (reduces effective hits).
        const starmetalArmor = targetActor.items.find(i =>
          i.type === "armor" && i.system.equipped && i.system.artifact &&
          i.system.magicalMaterial === "starmetal" && i.system.attuned
        );
        if (starmetalArmor) {
          const mmBonuses = game.exalted2e.EX2E.getActiveArmorMaterialBonuses?.();
          externalPenalty += mmBonuses?.starmetal?.attackPenalty ?? 0;
        }
      }
    }

    // Terrain: scan scene regions containing attacker/defender tokens.
    // Returns zeros when tokens aren't on a scene (null-safe).
    const terrainBonus = getTerrainBonuses(actor, targetActor ?? null);

    const pool = computeAttackPool({
      attrVal, abilVal,
      accuracy:       mode.effectiveAccuracy,
      isInstantCharm: isInstantCharmAttack,
      woundPenalty, flurryPenalty, internalPenalty: internalPenalty + emotionMajorPenalty, aimBonus, rangePenalty
    }) + (options.extraDice ?? 0);

    // Non-Excellency attack charms: every Supplemental keyed to the rolled
    // ability, plus Reflexive charms flagged as triggering in Step 1
    // (attack declaration). Simple and Extra Action charms are standalone
    // actions and can't supplement an attack; Permanent charms are always
    // active; Reflexive charms without Step 1 fire elsewhere in the pipeline.
    const attackCharms = allCharms.filter(c => {
      if (c.system.ability !== ability) return false;
      if (c.system.excellency === "first"
       || c.system.excellency === "second"
       || c.system.excellency === "third") return false;
      const t                = c.system.charmType;
      const inactiveSubmodule = c.system.isSubmodule && !c.system.effectivelyActive;
      if (t === "supplemental" && !inactiveSubmodule) return true;
      if (t === "reflexive" && (c.system.steps ?? []).includes(1) && !inactiveSubmodule) return true;
      return false;
    });

    const lunarFuryActive = actor.items.some(
      i => i.type === "charm" && i.system?.active
        && (i.system?.keywords ?? []).includes("Relentless-Lunar-Fury")
    );
    const filteredAttackCharms = lunarFuryActive
      ? attackCharms.filter(c => (c.system?.keywords ?? []).includes("Fury-OK"))
      : attackCharms;

    // ── Area attack: place template and collect targets before dialog ─────
    let areaPlacement = null;
    if (isAreaAttack) {
      const { placeAreaTemplate } = await import("../helpers/targeting.mjs");
      areaPlacement = await placeAreaTemplate(actor, { shape: areaConfig.shape, size: areaConfig.size });
      if (!areaPlacement) return null;
    }

    // Martial / Martial-ready weapon validity check
    const charmKeywords = charm?.system?.keywords ?? [];
    const hasMartialKw = charmKeywords.includes("Martial") || charmKeywords.includes("Martial-ready");
    if (hasMartialKw && charm?.system?.martialArtsStyleName) {
      const { isWeaponValidForStyle } = await import("../helpers/ma-validation.mjs");
      if (!isWeaponValidForStyle(weapon, charm.system.martialArtsStyleName, actor)) {
        ui.notifications.warn(game.i18n.localize("EX2E.WeaponNotValidForStyle"));
        return null;
      }
    }

    // Martial / Martial-ready minimum ability check
    if (hasMartialKw && charm) {
      const minAbil = charm.system?.minAbility ?? 0;
      const abilKey = charm.system?.ability ?? "martialArts";
      const abilVal = sys?.abilities?.[abilKey]?.value ?? 0;
      if (abilVal < minAbil) {
        const { canBypassMinAbility } = await import("../helpers/ma-validation.mjs");
        if (!canBypassMinAbility(actor, charm)) {
          ui.notifications.warn(game.i18n.format("EX2E.BelowMinAbilityRequirement", {
            ability: game.i18n.localize(`EX2E.Ability${abilKey.charAt(0).toUpperCase()}${abilKey.slice(1)}`),
            min: minAbil,
            current: abilVal,
          }));
          return null;
        }
      }
    }

    const dialogResult = await AttackDialog.prompt({
      pool, excellency, firstExcMax, secondExcMax,
      firstExcLabel, secondExcLabel,
      flurryPenalty,
      charms:   filteredAttackCharms,
      virtues:  actor.type === "character" ? sys.virtues : null,
      actor,
      isAreaAttack: isAreaAttack ?? false,
    });
    if (!dialogResult) return null;

    // ── Area attack path: no accuracy roll, no DV comparison ─────────────
    if (isAreaAttack) {
      // Activate selected supplemental charms.
      const activatedCharms = [];
      const activationBucket = [];
      for (const { id, motesOverride } of (dialogResult.charmActivations ?? [])) {
        const c = actor.items.get(id);
        if (!c) continue;
        const ok = await c.activateCharm({
          explicitMotesOverride: motesOverride !== undefined ? motesOverride : null,
          ledgerBucket: activationBucket
        });
        if (!ok) continue;
        activatedCharms.push({ id: c.id, name: c.name });
      }

      // Stunt reward.
      await bankStuntReward(actor, {
        stunt:              dialogResult.stunt,
        advancesMotivation: dialogResult.advancesMotivation ?? false,
        rewardKind:         dialogResult.rewardKind ?? "motes",
        sourceMessageId:    null
      });

      // Post charm activation ledger.
      if (activationBucket.length === 1) {
        const soleCharm = actor.items.get(activationBucket[0].charmId);
        if (soleCharm) await soleCharm.sendToChat({ activation: activationBucket[0].ledger });
      } else if (activationBucket.length > 1) {
        await sendCombinedActivationCard(actor, activationBucket, {
          title: game.i18n.localize("EX2E.SupplementalCharmsActivated")
        });
      }

      // Roll damage once (base damage + strength if melee; no threshold).
      const baseDamagePool = mode.effectiveDamage + (isMelee ? strVal : 0);
      const damageRoll = new ExaltedRoll({
        pool:      Math.max(1, baseDamagePool),
        flavor:    game.i18n.localize("EX2E.AreaDamageRoll"),
        actorName: actor.name,
        stunt:     dialogResult.stunt,
      });
      const damageResult = await damageRoll.evaluate();

      const resistDifficultyVal = parseFloat(
        Roll.replaceFormulaData(areaConfig.resist.difficulty, actor.getRollData())
      ) || 1;

      const areaAttack = {
        actorId:     actor.id,
        actorName:   actor.name,
        weaponName:  (wSys.modes?.length ?? 1) > 1 ? `${weapon.name} — ${mode.name}` : weapon.name,
        dice:        damageResult.diceDetails,
        pool:        damageResult.pool,
        rawDamage:   damageResult.successes ?? 0,
        damageType:  mode.damageType,
        stunt:       dialogResult.stunt,
        moteCost:    0,
        isAreaAttack: true,
        regionId:    areaPlacement.regionId,
        areaShape:   areaConfig.shape,
        areaTargets: areaPlacement.targets.map(t => ({ id: t.id, name: t.name })),
        areaResist:  {
          pool:       areaConfig.resist.pool,
          difficulty: resistDifficultyVal,
          effect:     areaConfig.resist.effect,
        },
        attackCharms: activatedCharms.map(c => c.name),
      };

      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/exalted2e/templates/chat/attack-result.hbs",
        areaAttack
      );
      await ChatMessage.create({
        content,
        rolls:   [damageResult.foundryRoll],
        sound:   CONFIG.sounds.dice,
        speaker: ChatMessage.getSpeaker({ actor }),
        flags:   { exalted2e: { attack: areaAttack } }
      });
      return null;
    }

    // Activate each selected Supplemental/Simple charm. `activateCharm`
    // handles mote/willpower spending and sustained-toggle bookkeeping;
    // a truthy return means the cost was paid.
    // Ledgers are collected and posted as one consolidated card (or a single
    // card when only one charm fires) rather than N separate cards.
    const activatedCharms = [];
    const activatedKeywords = new Set();
    const activations = dialogResult.charmActivations?.length
      ? dialogResult.charmActivations
      : (dialogResult.charmIds ?? []).map(id => ({ id, motesOverride: undefined }));
    const activationBucket = [];
    for (const { id, motesOverride } of activations) {
      const c = actor.items.get(id);
      if (!c) continue;
      const ok = await c.activateCharm({
        explicitMotesOverride: motesOverride !== undefined ? motesOverride : null,
        ledgerBucket: activationBucket
      });
      if (!ok) continue;
      activatedCharms.push({ id: c.id, name: c.name });
      for (const kw of (c.system.keywords ?? [])) activatedKeywords.add(kw);
    }
    if (activationBucket.length === 1) {
      const soleCharm = actor.items.get(activationBucket[0].charmId);
      if (soleCharm) await soleCharm.sendToChat({ activation: activationBucket[0].ledger });
    } else if (activationBucket.length > 1) {
      await sendCombinedActivationCard(actor, activationBucket, {
        title: game.i18n.localize("EX2E.SupplementalCharmsActivated")
      });
    }
    // Charm-spawned weapons (instant or longer-duration) inherit keywords
    // from the charm that created them — the weapon IS that charm, so its
    // keywords apply to every attack it makes. This is how Holy lands in
    // `activatedKeywords` when the attack came from the charm's own
    // Activate button rather than a supplemental tick in the dialog.
    const sourceCharmId = weapon.getFlag("exalted2e", "charmSource");
    const sourceCharm   = sourceCharmId ? actor.items.get(sourceCharmId) : null;
    if (sourceCharm) {
      for (const kw of (sourceCharm.system.keywords ?? [])) {
        activatedKeywords.add(kw);
      }
    }
    // Collect combat bonuses from activated and equipped charms.
    // attackBonus uses activatedCharmItems (per-attack supplemental cost paid now).
    // speedModifier and extraActions aggregate from actor AEs (synthesized at charm activation).
    const rollData = actor.getRollData?.() ?? {};
    const activatedCharmItems = activatedCharms
      .map(ac => actor.items.get(ac.id))
      .filter(Boolean);

    // Pre-evaluate formula fields (e.g. "@ess") to plain integers before
    // passing to computeAttackCharmBonus, which only handles resolved numbers.
    const resolvedAttackBonusCharms = activatedCharmItems
      .filter(c => c.system.attackBonus?.enabled)
      .map(c => {
        const ab    = c.system.attackBonus;
        const units = c.system.resolvedUnits ?? 0;
        const dmgBase      = _evalInt(ab.damageDice,         rollData);
        const postSoakBase = _evalInt(ab.postSoakDamageDice, rollData);
        return { system: { attackBonus: {
          enabled:                 true,
          accuracyDice:            String(_evalInt(ab.accuracyDice,      rollData)),
          accuracySuccesses:       String(_evalInt(ab.accuracySuccesses,  rollData)),
          damageDice:              String(ab.damageDicePerMote    ? dmgBase * units      : dmgBase),
          postSoakDamageDice:      String(ab.postSoakDicePerMote ? postSoakBase * units  : postSoakBase),
          ignoreAccuracyPenalties: ab.ignoreAccuracyPenalties,
        }}};
      });

    const charmAttackBonus = computeAttackCharmBonus(resolvedAttackBonusCharms, rollData);
    const baseSpeed        = mode.effectiveSpeed ?? 5;
    const charmSpeed       = aggregateSpeedModifierFromAEs(actor, baseSpeed);
    const charmExtraMax    = aggregateExtraActionsMaxFromAEs(actor);

    const unblockable = activatedKeywords.has("Unblockable");
    const undodgeable = activatedKeywords.has("Undodgeable");

    // Mote costs (First/Second Excellency only — Third is not used at Step 3)
    const firstExcDice       = dialogResult.firstExcDice  ?? 0;
    const secondExcSuccesses = dialogResult.secondExcSucc ?? 0;
    const rawAttackExcCost   = firstExcDice + secondExcSuccesses * 2;
    const totalMoteCost      = Math.max(0, rawAttackExcCost - attackMasteryDiscount);

    if (totalMoteCost > 0 && actor.type === "character") {
      const spent = await actor.spendMotes(totalMoteCost, dialogResult.moteType);
      if (!spent) return null;
    }

    // Handle virtue channeling
    let virtueChannelDice      = 0;
    let virtueChannelSuccesses = 0;
    const vModeAtk = dialogResult.virtueChannelMode ?? "none";
    if (vModeAtk !== "none" && actor.type === "character") {
      const curWP = actor.system.willpower?.value ?? 0;
      if (curWP < 1) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughWillpower"));
      } else if (vModeAtk === "success") {
        await actor.update({ "system.willpower.value": curWP - 1 });
        virtueChannelSuccesses = 1;
      } else if (vModeAtk === "dice" && dialogResult.virtueChannel) {
        const vKey   = dialogResult.virtueChannel;
        const virtue = actor.system.virtues?.[vKey];
        const curBox = virtue?.current ?? 0;
        if (curBox < 1) {
          ui.notifications.warn(game.i18n.format("EX2E.VirtueChannelNoPoints", {
            virtue: game.i18n.localize(`EX2E.Virtue${vKey.charAt(0).toUpperCase() + vKey.slice(1)}`)
          }));
        } else {
          await actor.update({
            "system.willpower.value":             curWP - 1,
            [`system.virtues.${vKey}.current`]:   Math.max(0, curBox - 1),
            [`system.virtues.${vKey}.channeled`]: true
          });
          virtueChannelDice = virtue?.value ?? 0;
        }
      }
    }

    // Apply Unblockable / Undodgeable to the target-snapshot DVs. We keep
    // the pre-zero values under `targetBase*DV` so the card can strike
    // them through for transparency, and overwrite the live DV with 0 so
    // downstream hit/miss math works without special-casing.
    // Terrain DV captured in targetBase*DV so transparency lines show it;
    // Unblockable/Undodgeable still zeros afterwards as needed.
    targetDodgeDV += terrainBonus.defenderDVBonus;
    targetParryDV += terrainBonus.defenderDVBonus;

    const targetBaseDodgeDV = targetDodgeDV;
    const targetBaseParryDV = targetParryDV;
    if (undodgeable) targetDodgeDV = 0;
    if (unblockable) targetParryDV = 0;

    // Holy vs Creature of Darkness: a charm activated for this attack
    // carrying the Holy keyword upgrades damage to aggravated against a
    // CoD-flagged target — bashing and lethal alike. (Weapons never carry
    // Holy in 2e; only Charms do, so we don't inspect mode.tags.)
    // Aggravated also bypasses Hardness, and soak looks up a different
    // column — both re-read off the final damage type below.
    const isHolyAttack  = activatedKeywords.has("Holy");

    // CoD is carried as a non-status ActiveEffect flag so the trait stays
    // invisible to observers (no token HUD icon). Check for any enabled
    // effect on the target that advertises it.
    const targetIsCoD   = !!targetActor?.effects?.some(
      e => !e.disabled && e.flags?.exalted2e?.creatureOfDarkness === true
    );
    const upgrade = computeHolyUpgrade({
      isHolyAttack, targetIsCoD, baseDamageType: mode.damageType
    });
    const finalDamageType = upgrade.finalDamageType;
    const holyUpgraded    = upgrade.holyUpgraded;
    if (holyUpgraded && targetActor) {
      // Re-read soak for the upgraded damage column; aggravated ignores Hardness.
      const tSys = targetActor.system;
      if (targetActor.type === "character") {
        targetSoak      = tSys.totalSoak?.[finalDamageType] ?? 0;
        targetArmorSoak = tSys.armorSoak?.[finalDamageType] ?? 0;
      } else if (targetActor.type === "npc") {
        targetSoak      = tSys.combat?.soak?.[finalDamageType] ?? 0;
        targetArmorSoak = 0;
      }
      targetHardness = 0;
    }

    targetSoak += terrainBonus.defenderSoakBonus;

    // Build and evaluate the attack roll
    const displayName = (wSys.modes?.length ?? 1) > 1 ? `${weapon.name} — ${mode.name}` : weapon.name;
    const attackRoll = new ExaltedRoll({
      pool:               pool + firstExcDice + charmAttackBonus.extraAccuracyDice + virtueChannelDice
                        + (charmAttackBonus.ignoreRangeBand ? (rangePenalty ?? 0) : 0)
                        + terrainBonus.attackerDiceBonus,
      flavor:             `${displayName} — ${game.i18n.localize("EX2E.AttackRoll")}`,
      actorName:          actor.name,
      stunt:              dialogResult.stunt,
      moteCost:           totalMoteCost,
      moteType:           dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses: secondExcSuccesses + virtueChannelSuccesses
    });
    const result = await attackRoll.evaluate();

    // Attack data snapshot — stored on the chat message as flags. The card
    // starts in "defense pending" state; the defender picks Dodge or Parry
    // (or the GM enters a manual DV when no target is selected), at which
    // point the card is re-rendered with hit/miss and damage.
    const typeSuffix          = finalDamageType === "lethal" ? "L" : finalDamageType === "aggravated" ? "A" : "B";
    const overwhelmingSuffix  = mode.tags?.includes("Overwhelming") ? `/${mode.overwhelming ?? 1}` : "";
    // External penalties (Prone etc.) reduce the SUCCESS tally after the
    // roll — not the pool. Botch detection still reads the unmodified
    // rawSuccesses, so a Prone attacker can still botch even when their
    // display successes would otherwise be non-negative.
    const effectiveExternalPenalty = charmAttackBonus.ignorePenalties ? 0 : externalPenalty;
    const displaySuccesses = Math.max(0,
      (result.successes ?? 0) - effectiveExternalPenalty + charmAttackBonus.extraAccuracySuccesses
    );
    const attack = {
      actorId:             actor.id,
      actorName:           actor.name,
      weaponName:          displayName,
      dice:                result.diceDetails,
      pool:                result.pool,
      successes:           displaySuccesses,
      externalPenalty,
      botch:               result.botch,
      stunt:               dialogResult.stunt,
      moteCost:            totalMoteCost,
      moteType:            dialogResult.moteType,
      firstExcDice,
      secondExcSuccesses,
      attackerHasThirdExc,
      attackerExcKey:      excKey,
      weaponDamage:        mode.effectiveDamage + charmAttackBonus.extraDamageDice,
      postSoakDamageDice:  charmAttackBonus.extraPostSoakDamageDice || 0,
      damageType:          finalDamageType,
      damageTypeLabel:     `${typeSuffix}${overwhelmingSuffix}`,
      // Originating type before the Holy-vs-CoD upgrade, plus a flag the
      // card uses to surface the upgrade. Unset for normal attacks.
      originalDamageType:  holyUpgraded ? mode.damageType : null,
      holyUpgraded,
      // Instant-duration charm attacks publish their full damage value —
      // Strength isn't auto-added, same spirit as the accuracy rule above.
      // Longer-duration charms drop a real weapon and get the default
      // melee-adds-Strength behaviour.
      addStrength:         isMelee && !isInstantCharmAttack,
      strengthValue:       strVal,
      overwhelming:        mode.overwhelming ?? 1,
      targetId,
      targetName,
      targetDodgeDV,
      targetParryDV,
      targetBaseDodgeDV,
      targetBaseParryDV,
      unblockable,
      undodgeable,
      targetSoak,
      targetArmorSoak,
      targetHardness,
      soakPiercing:    charmAttackBonus.soakPiercing   || 0,
      ignoresArmor:    charmAttackBonus.ignoresArmor   || false,
      attackCharms:            activatedCharms.map(c => c.name),
      isCounterattack:         !!options.isCounterattack,
      originalAttackMessageId: options.originalAttackMessageId ?? null,
      defense:             null,
      extraActionsAvailable: charmExtraMax || null,
      effectiveSpeed:        charmSpeed !== baseSpeed ? charmSpeed : null,
      aimBonus:              aimBonus || null,
      rangeBand:             rangeBand || null,
      rangePenalty:          charmAttackBonus.ignoreRangeBand ? null : (rangePenalty || null),
      rangeBandLabel:        rangeBand
        ? game.i18n.localize(game.exalted2e.EX2E.rangeBands.find(b => b.key === rangeBand)?.labelKey ?? "")
        : null,
      terrainAttackerDice:   terrainBonus.attackerDiceBonus  || null,
      terrainDefenderDV:     terrainBonus.defenderDVBonus    || null,
      terrainDefenderSoak:   terrainBonus.defenderSoakBonus  || null,
    };

    const content = await renderAttackCardContent(attack);

    const message = await ChatMessage.create({
      content,
      rolls:   [result.foundryRoll],
      sound:   CONFIG.sounds.dice,
      speaker: ChatMessage.getSpeaker({ actor }),
      flags:   { exalted2e: { attack } }
    });
    await bankStuntReward(actor, {
      stunt:              dialogResult.stunt,
      advancesMotivation: dialogResult.advancesMotivation ?? false,
      rewardKind:         dialogResult.rewardKind ?? "motes",
      sourceMessageId:    message?.id ?? null
    }).catch(err =>
      console.error("exalted2e | stunt banking failed", err)
    );

    // ── Clinch post-hit hook ─────────────────────────────────────────────
    const isClinchMode = Array.isArray(mode?.tags) && mode.tags.includes("Clinch");
    if (isClinchMode && targetDodgeDV !== null && displaySuccesses >= targetDodgeDV) {
      try {
        const { rollClinchControl, stampClinchState } = await import("./clinch.mjs");
        const controlResult = await rollClinchControl(actor, targetActor);
        if (controlResult.attackerWins) {
          const attackerCombatant = game.combat?.combatants.find(c => c.actorId === actor.id);
          const targetCombatant   = game.combat?.combatants.find(c => c.actorId === targetActor.id);
          if (attackerCombatant && targetCombatant) {
            await stampClinchState(
              game.combat,
              attackerCombatant,
              targetCombatant,
              controlResult.controlMargin
            );
          }
        }
      } catch (err) {
        ui.notifications.error(game.i18n.localize("EX2E.ClinchControlRollError") ?? "Clinch control roll failed.");
        console.error("Clinch control roll error:", err);
      }
    }

    return message;
  }

  /**
   * Roll a pre-computed NPC attack entry against a targeted actor.
   * Uses attack.pool directly instead of deriving from attributes.
   */
  static async rollNpcAttack(actor, attackIndex, options = {}) {
    const attack = actor.system.attacks?.[attackIndex];
    if (!attack) return null;

    // ── Resolve target ────────────────────────────────────────────────────
    let target = options.explicitTargetActor ?? game.user.targets.first()?.actor ?? null;
    if (!target) {
      const { pickTargetActor } = await import("../helpers/targeting.mjs");
      target = await pickTargetActor();
      if (!target) return null;
    }

    // ── Roll pool (minus wound penalty) ───────────────────────────────────
    const woundPenalty = actor.system.health?.woundPenalty ?? 0;
    const pool         = Math.max(1, attack.pool - woundPenalty);
    const roll         = new ExaltedRoll(`${pool}d10`, actor.getRollData());
    await roll.evaluate();
    const successes = roll.total;

    // ── Onslaught: snapshot DVs BEFORE incrementing so this attack sees
    //    pre-bump values, then apply onslaught to target. ─────────────────
    const dodgeDV  = target.currentDodgeDV ?? 0;
    const parryDV  = target.currentParryDV ?? 0;
    const targetDV = Math.min(dodgeDV, parryDV);
    const rawExcess = successes - targetDV;
    const hit       = rawExcess >= 0;

    await target.addOnslaught?.();

    // ── Parse base damage ─────────────────────────────────────────────────
    const dmgMatch = (attack.damage ?? "").match(/(\d+)\s*([BLAble]*)/i);
    const baseDmg  = dmgMatch ? parseInt(dmgMatch[1]) : 0;
    const dmgType  = dmgMatch ? (dmgMatch[2].trim().toUpperCase()[0] ?? "L") : "L";
    const soakKey  = { B: "bashing", L: "lethal", A: "aggravated" }[dmgType] ?? "lethal";

    // ── Read target soak / hardness (same branch logic as rollAttack) ─────
    const tSys = target.system;
    let targetSoak     = 0;
    let targetHardness = 0;
    if (target.type === "character") {
      targetSoak     = tSys.totalSoak?.[soakKey] ?? 0;
      targetHardness = tSys.hardness ?? 0;
    } else if (target.type === "npc") {
      targetSoak     = tSys.combat?.soak?.[soakKey] ?? 0;
      targetHardness = tSys.combat?.hardness ?? 0;
    }

    // ── Apply hardness then soak ───────────────────────────────────────────
    const rawPool      = rawExcess + baseDmg;
    const hardnessStops = hit && rawPool <= targetHardness;
    // TODO (follow-up): rollNpcAttack uses raw targetSoak here and does not
    // account for soakPiercing / ignoresArmor from the charm snapshot.
    // Needs updating once NPC attacks carry those fields.
    const finalDamage   = (hit && !hardnessStops)
      ? Math.max(0, rawPool - targetSoak)
      : 0;

    // ── Build chat content ────────────────────────────────────────────────
    const hitLabel = hit
      ? `<strong style="color:green">${game.i18n.localize("EX2E.Hit")}</strong>`
      : `<strong style="color:crimson">${game.i18n.localize("EX2E.Miss")}</strong>`;
    let content = `<div class="attack-result">
      <h3>${actor.name} — ${attack.name}</h3>
      <p>Pool ${pool}${woundPenalty ? ` (−${woundPenalty} wound penalty)` : ""} → <strong>${successes}</strong> successes</p>
      <p>vs ${target.name} DV ${targetDV} — ${hitLabel}</p>`;

    if (hit) {
      if (hardnessStops) {
        content += `<p>Raw ${rawPool}${dmgType} — stopped by hardness ${targetHardness}</p>`;
      } else {
        content += `<p>Raw ${rawPool}${dmgType} − soak ${targetSoak} = <strong>${finalDamage}${dmgType}</strong></p>`;
      }
    }
    content += `</div>`;

    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls:   [roll],
      content,
      type:    CONST.CHAT_MESSAGE_STYLES?.ROLL ?? 5,
      flags:   { exalted2e: { npcAttack: { actorId: actor.id, attackIndex, hit, targetId: target.id } } }
    });

    return message;
  }

  /**
   * Resolve a social attack against a defender.
   *
   * Computes verified modifier claims against the defender's data
   * (Intimacies, Virtues ≥ 3, Motivation), applies net-sum stacking
   * across supporting/opposing, subtracts Appearance delta, compares
   * rolled successes to the effective MDV, and posts a chat card.
   *
   * No effects are applied here — the defender's owner (or GM) accepts
   * or resists via buttons on the posted chat card.
   */
  static async rollSocialAttack(attacker, {
    defender,
    attribute,
    ability,
    intent,
    subject = "",
    claims = {},
    stuntDice = 0,
    advancesMotivation = false,
    rewardKind = "motes",
    // 3c-1
    charmIds = [],
    charmActivations = [],
    firstExcDice = 0,
    secondExcSucc = 0,
    moteType = "peripheral",
    // 3c-2
    targetMotivation = "",
    // combo selector
    selectedComboId = null
  } = {}) {
    if (!attacker || !defender) {
      ui.notifications.warn(game.i18n.localize("EX2E.NoTargetSelected"));
      return null;
    }

    // 1. Verify each claim against defender data.
    const verified = verifyClaims(claims, defender);

    // 2. Net-sum stacking.
    const stackingMod = computeStackingMod(verified);

    // 3. Appearance shift. Higher attacker App lowers defender MDV.
    //    NPC actors currently have no Appearance — treat as 0.
    const mdvShiftFromApp = computeMdvShiftFromApp(attacker, defender);

    // 4. Base MDV. preStep2EffectiveMDV is the MDV before defender
    //    Step-2 charms / Excellencies bump it. The orchestrator
    //    recomputes the post-Step-2 effectiveMDV via resolveStep2().
    const baseMDV = computeBaseMDV(intent, defender);
    const preStep2EffectiveMDV = Math.max(0, baseMDV + stackingMod + mdvShiftFromApp);

    // 3c-1: Activate picked charms inline. Each charm's activateCharm posts
    // its own chat card. Failures (insufficient resources, user cancels XP
    // confirm) are dropped; their keywords don't propagate.
    const socialActivations = charmActivations.length
      ? charmActivations
      : (charmIds ?? []).map(id => ({ id, motesOverride: undefined }));
    const actuallyActivated = [];
    if (selectedComboId) {
      // Combo path: activate the entire combo and use its social-eligible charms
      // for keyword aggregation.
      const combo = attacker.items.get(selectedComboId);
      if (!combo || combo.type !== "combo") {
        ui.notifications.warn(game.i18n.localize("EX2E.NoComboFound"));
        return null;
      }
      const comboResult = await combo.activateCombo({ isSocialContext: true });
      if (!comboResult?.success) return null;
      // Filter to social-eligible charms for keyword aggregation.
      const SOCIAL_ABILITIES_SOCIAL = ["presence", "performance", "investigation", "bureaucracy"];
      const socialCharms = (comboResult.activatedCharms ?? []).filter(c => {
        const ct = c.system?.charmType;
        return (ct === "supplemental" ||
                (ct === "reflexive" && (c.system?.steps ?? []).includes(1))) &&
               SOCIAL_ABILITIES_SOCIAL.includes(c.system?.ability);
      });
      actuallyActivated.push(...socialCharms);
    } else {
      for (const { id, motesOverride } of socialActivations) {
        const charm = attacker.items.get(id);
        if (!charm || charm.type !== "charm") continue;
        try {
          const result = await charm.activateCharm({
            skipXpConfirm: false,
            via: "social-attack",
            explicitMotesOverride: motesOverride !== undefined ? motesOverride : null
          });
          if (result !== null && result !== false) actuallyActivated.push(charm);
        } catch (err) {
          console.error(`Charm activation failed: ${charm.name}`, err);
        }
      }
    }

    // 3c-1: Spend Excellency motes. Aborts the whole attack if the attacker
    // can't afford it; spendMotes emits its own toast.
    const excMoteCost = (firstExcDice ?? 0) + (secondExcSucc ?? 0) * 2;
    if (excMoteCost > 0) {
      const spent = await attacker.spendMotes(excMoteCost, moteType);
      if (!spent) return null;
    }

    // 3c-1: Aggregate attacker-charm keywords and UMI cost.
    const {
      keywords:        attackerCharmKeywords,
      umiCostSum,
      charmIds:        attackerCharmIds,
      sourceByKeyword: attackerSourceByKeyword
    } = aggregateAttackerCharms(actuallyActivated);

    const rollData = attacker.getRollData?.() ?? {};
    const charmSocialBonus = computeSocialCharmBonus(
      actuallyActivated.filter(c => c.system?.socialBonus?.enabled),
      rollData
    );

    // UMI is forced on if any UMI charm was picked, regardless of manual
    // checkbox. Falls back to manual claim otherwise.
    const unnaturalInfluenceFinal = (umiCostSum > 0) || !!claims.unnaturalInfluence;

    // 3c-2: Motivation-break campaign create or attach. Bumps attemptCount.
    // SECURITY: when an active campaign exists for (attacker, defender), use
    // its stored targetMotivation, NOT the dialog's submitted value — the
    // dialog's input is readonly when in-progress, but DOM-modification could
    // bypass that. The campaign tracker is the source of truth.
    let campaignAttemptCount = 0;
    let effectiveTargetMotivation = targetMotivation;
    if (intent === "break-motivation") {
      const existing = findCampaign(defender, attacker.id);
      const nowIso = new Date().toISOString();
      // Active campaign → bump. Otherwise (no record OR stale broken/abandoned)
      // → create fresh, overwriting the stale record. validateNewCampaign
      // already rejects "broken target still in place"; reaching here with a
      // broken/abandoned record means the prior break is no longer in effect.
      if (!existing || existing.status !== "active") {
        const newCampaign = {
          targetMotivation,
          originalMotivation:  defender.system?.motivation ?? "",
          attemptCount:        1,
          successfulHits:      0,
          defenderPermWpSpent: 0,
          startedAt:           nowIso,
          lastAttemptAt:       nowIso,
          status:              "active",
          attackerName:        attacker.name
        };
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attacker.id}`]: newCampaign
        });
        campaignAttemptCount = 1;
      } else {
        // Active campaign exists — use the stored target (ignore the dialog's
        // value for follow-up attempts; readonly attribute can be DOM-bypassed).
        effectiveTargetMotivation = existing.targetMotivation;
        campaignAttemptCount = (existing.attemptCount ?? 0) + 1;
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attacker.id}.attemptCount`]: campaignAttemptCount,
          [`flags.exalted2e.motivationBreaks.${attacker.id}.lastAttemptAt`]: nowIso
        });
      }
    }

    // 5. Roll the attacker's pool.
    const attributeValue = attacker.system?.attributes?.[attribute]?.value ?? 0;
    const abilityValue   = attacker.system?.abilities?.[ability]?.value     ?? 0;
    const pool = attributeValue + abilityValue + (Number(stuntDice) || 0) + (firstExcDice ?? 0)
               + charmSocialBonus.poolDice;

    const intentLabel = game.i18n.localize({
      build:  "EX2E.IntentBuild",
      erode:  "EX2E.IntentErode",
      compel: "EX2E.IntentCompel"
    }[intent] ?? "EX2E.SocialAttack");

    // Compute penalty-adjusted pool the same way rollPool does —
    // but skip its toMessage call so we post only the social card.
    const social_internal = attacker.internalPenaltyFor?.("social") ?? 0;
    const social_external = attacker.externalPenaltyFor?.("social") ?? 0;
    // woundPenalty is stored as a non-positive integer (0, -1, -2, -4) so it is
    // added, not subtracted — a negative value already reduces the pool.
    const social_wound    = Number(attacker.system?.health?.woundPenalty) || 0;
    const social_clarity  = (attacker.system?.exaltType === "alchemical")
      ? (attacker.system?.clarityModifiers?.socialPenalty ?? 0)
      : 0;
    const finalPool = Math.max(0,
      (pool ?? 0)
      + (charmSocialBonus.ignorePenalties ? 0 : social_wound)
      - (charmSocialBonus.ignorePenalties ? 0 : social_internal)
      - (charmSocialBonus.ignorePenalties ? 0 : social_clarity)
    );

    // Natural-influence drain cap: if this is a non-UMI attack and the
    // defender's per-attacker scene-drain counter is already ≥ 2, the
    // attack auto-fails. The dice still roll for display transparency,
    // but `hit` is forced false below.
    const autoFailedByNaturalCap = checkNaturalCap(defender, attacker.id, unnaturalInfluenceFinal);

    const roll = new ExaltedRoll({
      pool:               finalPool,
      flavor:             intentLabel,
      actorName:          attacker.name,
      // social_external is intentionally NOT gated by ignorePenalties; per spec
      // socialBonus only bypasses wound/internal/clarity (actor internal states),
      // not external situational penalties applied by the roll environment.
      externalPenalty:    social_external,
      moteCost:           excMoteCost,
      moteType:           moteType,
      firstExcDice,
      secondExcSuccesses: secondExcSucc
    });
    const rollResult = await roll.evaluate();

    // 6. Threshold display only — hit / wpToResist are deferred to
    //    defender Step-2 (orchestrator in exalted2e.mjs computes them
    //    after charm activations + Excellency mote spend resolve).
    const rollSuccesses = (rollResult?.successes ?? 0) + charmSocialBonus.poolSuccesses;
    const netSuccesses = Math.max(0, rollSuccesses - preStep2EffectiveMDV);

    // 7. Build chat card content.
    const attributeLabel = game.i18n.localize(
      `EX2E.Attr${attribute.charAt(0).toUpperCase()}${attribute.slice(1)}`
    );
    const abilityLabel = game.i18n.localize(
      `EX2E.Ability${ability.charAt(0).toUpperCase()}${ability.slice(1)}`
    );

    // Recompute the best-supporting / best-opposing components for the
    // chat card display. The aggregate stackingMod is produced by the
    // helper, but the card breaks out each side individually.
    const _supportingValues = [];
    if (verified.supportingIntimacy)   _supportingValues.push(-1);
    if (verified.supportingVirtue)     _supportingValues.push(-2);
    if (verified.supportingMotivation) _supportingValues.push(-3);
    const bestSupporting = _supportingValues.length
      ? Math.min(..._supportingValues)
      : 0;

    const _opposingValues = [];
    if (verified.opposingIntimacy)   _opposingValues.push(1);
    if (verified.opposingVirtue)     _opposingValues.push(2);
    if (verified.opposingMotivation) _opposingValues.push(3);
    if (verified.immediateThreat)    _opposingValues.push(3);
    const bestOpposing = _opposingValues.length
      ? Math.max(..._opposingValues)
      : 0;

    const ledger = {
      attackerId:                  attacker.id,
      defenderId:                  defender.id,
      intent,
      targetedIntimacyId:          intent === "erode"
        ? (claims.opposingIntimacyId ?? null)
        : null,
      subject,
      claimsVerified:              verified,
      stackingMod,
      mdvShiftFromApp,
      baseMDV,
      preStep2EffectiveMDV,        // displayed in step2-pending phase
      rollSuccesses,
      netSuccesses,                // recomputed post-Step-2 too; this is a display-only seed
      unnaturalInfluence:          unnaturalInfluenceFinal,    // 3c-1: charm-or-manual source-of-truth
      autoFailedByNaturalCap,
      // 3c-1: attacker-side fields
      attackerCharmIds,
      attackerCharmKeywords,
      attackerSourceByKeyword,
      attackerFirstExcDice:        firstExcDice ?? 0,
      attackerSecondExcSucc:       secondExcSucc ?? 0,
      attackerExcMoteCost:         excMoteCost,
      attackerMoteType:            moteType,
      umiCostSum,
      appliedInfluenceEffectIds:   [],
      // 3c-2: Motivation-break fields
      isMotivationBreak:           intent === "break-motivation",
      targetMotivation:            intent === "break-motivation" ? effectiveTargetMotivation : "",
      campaignAttemptCount,
      defenderPermWpDelta:         null,
      brokenInThisAttack:          false,
      brokenFromMotivation:        null,
      // Step-2 phase state (filled in by orchestrator)
      step2Resolved:               false,
      step2Result:                 null,
      defenderCharmIds:            [],
      defenderMoteSpend:           null,
      // Computed POST-Step-2 (null until step2Resolved)
      effectiveMDV:                null,
      hit:                         null,
      wpToResist:                  null,
      perfectDefense:              false,
      motesResistApplied:          false,
      // Resolution (existing 3a)
      resolution:                  null,
      reversed:                    false,
      attributeLabel,
      attributeValue,
      abilityLabel,
      abilityValue,
      stuntDice,
      pool: finalPool,
      bestSupporting,
      bestOpposing,
      charmPoolDice:      charmSocialBonus.poolDice,
      charmPoolSuccesses: charmSocialBonus.poolSuccesses,
    };

    const cardContext = {
      ...ledger,
      intentLabel,
      attackerName:     attacker.name,
      attackerImg:      attacker.img,
      defenderName:     defender.name,
      defenderImg:      defender.img,
      canDefend:        game.user.isGM || defender.testUserPermission(game.user, "OWNER"),
      canRespond:       game.user.isGM || defender.testUserPermission(game.user, "OWNER"),
      canAffordResist:  false,                  // Step-2 not yet resolved
      canReverse:       game.user.isGM || attacker.testUserPermission(game.user, "OWNER"),
      isGM:             game.user.isGM,
      hasIllusion:      (attackerCharmKeywords ?? []).includes("Illusion"),
      isUMI:            (ledger.umiCostSum ?? 0) > 0,
      defenderIntimacies: [],
      showErodePicker:  false
    };

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/social-attack-card.hbs",
      cardContext
    );

    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content,
      flags: { exalted2e: { socialAttack: ledger } }
    });

    await bankStuntReward(attacker, {
      stunt:              Number(stuntDice) || 0,
      advancesMotivation: !!advancesMotivation,
      rewardKind:         rewardKind === "willpower" ? "willpower" : "motes",
      sourceMessageId:    message?.id ?? null
    }).catch(err =>
      console.error("exalted2e | stunt banking failed", err)
    );

    return message;
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
  const data = computeAttackOutcome(attack);
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
    // External penalty — subtracted from the displayed success tally
    // post-roll. Botch detection is unaffected (reads rawSuccesses).
    this.externalPenalty     = options.externalPenalty      ?? 0;

    // ── Count successes from dice ────────────────────────────────────────
    const _tally = countSuccesses(this.dice);
    this.rawSuccesses = _tally.rawSuccesses;
    this.ones         = _tally.ones;
    this.diceDetails  = _tally.details;

    // Second Excellency successes are added after dice (and can prevent botch)
    this.rawSuccesses += this.secondExcSuccesses;

    // External penalty reduces the displayed success tally, not raw.
    // Botch / failure / success still read rawSuccesses so a Prone
    // roller can't turn a botch into a mere failure by "hiding" 1s
    // behind the penalty.
    this.successes = Math.max(0, this.rawSuccesses - (this.externalPenalty ?? 0));
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

function _evalInt(formula, rollData) {
  if (!formula && formula !== 0) return 0;
  return evaluateCharmFormula(String(formula), rollData, 0);
}
