import { EX2E } from "../config.mjs";
import { clampDamage, healInOrder } from "../rolls/health-math.mjs";
import { aggregatePenalties, sumPenalties } from "./penalties-math.mjs";
import { collectPermanentTraitChanges } from "./purchase-mode-math.mjs";
import { getClarityBand } from "../combat/clarity-math.mjs";
import { isCharmPassivelyActive, aggregateMoveBonusFromCharms } from "../rolls/charm-passive-math.mjs";
import { collectMoteRecoveryCharms, collectWillpowerRecoveryCharms } from "../rolls/charm-event-math.mjs";
import { evaluateCharmFormula } from "./item.mjs";

const ANIMA_ORDER = { none: 0, glowing: 1, burning: 2, bonfire: 3, totemic: 4 };
function _animaLevel(key) { return ANIMA_ORDER[key] ?? 0; }

/**
 * Attempt to suppress a virtue channel by spending Willpower equal to
 * `successes`. If the actor's current Willpower is less than the cost,
 * a warning notification is shown and the function returns `false` without
 * spending anything.  When the suppressed virtue is the actor's primary
 * virtue, the actor also gains +1 Limit (capped at 10).
 *
 * @param {ExaltedActor} actor       - The actor attempting suppression.
 * @param {string}       virtueName  - Key in `system.virtues` (e.g. "conviction").
 * @param {number}       successes   - Number of Willpower points required.
 * @returns {Promise<boolean>}  `true` on success, `false` when WP is insufficient.
 */
export async function applyVirtueSuppression(actor, virtueName, successes) {
  const wp = actor.system.willpower.value;
  if (wp < successes) {
    const label = game.i18n.localize(EX2E.virtues[virtueName] ?? virtueName);
    ui.notifications.warn(
      game.i18n.format("EX2E.VirtueSuppressionInsuffWP", { virtue: label, cost: successes })
    );
    return false;
  }
  const updates = { "system.willpower.value": wp - successes };
  if (actor.system.primaryVirtue === virtueName) {
    updates["system.limit"] = Math.min(10, (actor.system.limit ?? 0) + 1);
  }
  await actor.update(updates);
  if (actor.system.primaryVirtue === virtueName) {
    ui.notifications.info(
      game.i18n.format("EX2E.LimitGained", { current: actor.system.limit })
    );
  }
  return true;
}

/**
 * ExaltedActor – extends the base Foundry Actor document with
 * Exalted 2e specific behaviours.
 */
export class ExaltedActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * Roll-data short aliases so formulas in Charm attack stats (and any
   * other author-entered math) can reference attributes / abilities /
   * essence / willpower by three-letter tokens like `@str`, `@ess`,
   * `@melee` without having to spell out `@attributes.strength.value`.
   *
   * Foundry's Roll.replaceFormulaData consumes this map; anything the
   * author types is looked up against it.
   */
  getRollData() {
    const data = super.getRollData();
    const s = this.system ?? {};
    // Attribute shorthands.
    const a = s.attributes ?? {};
    const attr = (key) => a[key]?.value ?? 0;
    data.str = attr("strength");
    data.dex = attr("dexterity");
    data.sta = attr("stamina");
    data.cha = attr("charisma");
    data.man = attr("manipulation");
    data.app = attr("appearance");
    data.per = attr("perception");
    data.int = attr("intelligence");
    data.wit = attr("wits");
    // Every ability value exposed by its key (e.g. `@melee`, `@archery`).
    for (const [key, ab] of Object.entries(s.abilities ?? {})) {
      data[key] = ab?.value ?? 0;
    }
    // NOTE: `@essence` and `@willpower` already exist on roll data as
    // schema objects ({value, max}) — we can't overwrite those root keys
    // with plain numbers because the TypeDataModel setter rejects the
    // coercion silently. Use distinct aliases instead; formulas can also
    // always reference the nested path directly (`@essence.value`).
    data.ess          = s.essence?.value    ?? 0;
    data.wp           = s.willpower?.value  ?? 0;
    data.woundPenalty = s.health?.woundPenalty ?? 0;
    // Splat scalars are exposed only under the matching exaltType, so a
    // Solar never resolves @paradox to 0 silently. Array-shaped splat
    // data (forms, destinies, slots) is handled through the actor's
    // items list, not roll data.
    const splat = s.splat ?? {};
    switch (s.exaltType) {
      case "terrestrial":
        data.breeding = s.breedingBonus?.rating ?? 0;
        break;
      case "sidereal":
        data.paradox = splat.sidereal?.paradox ?? 0;
        break;
      case "abyssal":
        data.whispers = splat.abyssal?.whispers ?? 0;
        break;
      case "infernal":
        break;
      case "alchemical":
        break;
      // Solar, Lunar, and mortal: no numeric splat scalars to expose.
      default:
        break;
    }
    // Universal Limit token — every Exalt's anti-virtue counter, regardless
    // of which splat-variant rules apply (Limit / Resonance / Torment / Clarity).
    data.limit             = s.limit              ?? 0;
    data.commandRating     = s.commandRating      ?? 0;
    data.commandWarDice    = s.commandWarDice      ?? 0;
    data.followersRating   = s.followersRating     ?? 0;
    data.followersMagnitude = s.followersMagnitude ?? 0;
    return data;
  }

  /**
   * When the caste changes for an ability-based exalt, auto-set the caste
   * flag on all abilities that belong to the new caste's group. Also
   * enforces Purchase Mode: when `system.purchaseLocked` is true, any
   * reduction of a permanent trait is rejected, and any increase opens
   * a confirmation dialog that logs an XP expenditure.
   */
  /** @override */
  async _preDelete(options, user) {
    this._isBeingDeleted = true;
    return super._preDelete(options, user);
  }

  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    if (this.type !== "character") return;

    // ── Caste auto-assignment (existing behaviour, unchanged) ─────────
    const newCaste = changed.system?.caste;
    if (newCaste !== undefined) {
      const exaltType = changed.system?.exaltType ?? this.system.exaltType;
      const attrBased = ["lunar", "alchemical"];
      if (!attrBased.includes(exaltType)) {
        // Ability-caste auto-assign for ability-based exalts (existing behavior)
        const groupDefs    = EX2E.abilityGroups[exaltType] ?? [];
        const casteGroup   = groupDefs.find(g => g.key === newCaste);
        const casteAbilSet = new Set(casteGroup?.abilities ?? []);
        const abilUpdates = {};
        for (const key of EX2E.abilities) {
          abilUpdates[`system.abilities.${key}.caste`] = casteAbilSet.has(key);
        }
        foundry.utils.mergeObject(changed, foundry.utils.expandObject(abilUpdates));
      } else {
        // Attribute-caste auto-assign for Lunar / Alchemical
        const groupDefs    = EX2E.attributeGroups[exaltType] ?? [];
        const casteGroup   = groupDefs.find(g => g.key === newCaste);
        const casteAttrSet = new Set(casteGroup?.attributes ?? []);
        const attrUpdates  = {};
        for (const key of EX2E.attributeKeys) {
          attrUpdates[`system.attributes.${key}.caste`] = casteAttrSet.has(key);
        }
        foundry.utils.mergeObject(changed, foundry.utils.expandObject(attrUpdates));
      }

      if (exaltType === "infernal") {
        const patron = EX2E.infernalCastePatron?.[newCaste] ?? "";
        foundry.utils.mergeObject(changed, {
          system: { splat: { infernal: { patron } } }
        });
      }
    }

    // ── Willpower floor: auto-bump willpower.max when virtues raise it ──
    // RAW: permanent Willpower equals max(stored value, sum of two highest
    // virtues). Raising a Virtue raises Willpower automatically with no
    // additional XP — the cost is rolled into the Virtue rise. We persist
    // the bump silently for both unlocked (free) and locked (Purchase Mode)
    // flows; locked mode treats the WP bump as a side effect of the Virtue
    // dialog rather than a separate confirmation.
    const newVirtues = {
      compassion: changed.system?.virtues?.compassion?.value ?? this.system.virtues.compassion.value,
      conviction: changed.system?.virtues?.conviction?.value ?? this.system.virtues.conviction.value,
      temperance: changed.system?.virtues?.temperance?.value ?? this.system.virtues.temperance.value,
      valor:      changed.system?.virtues?.valor?.value      ?? this.system.virtues.valor.value
    };
    const sortedVirtues = Object.values(newVirtues).sort((a, b) => b - a);
    const newWpFloor    = (sortedVirtues[0] ?? 0) + (sortedVirtues[1] ?? 0);
    const currentWpMax  = changed.system?.willpower?.max ?? this.system.willpower.max ?? 0;
    if (newWpFloor > currentWpMax) {
      foundry.utils.mergeObject(changed, {
        system: { willpower: { max: newWpFloor } }
      });
    }

    // ── Purchase Mode enforcement ─────────────────────────────────────
    if (!this.system.purchaseLocked) return;

    // Authorized RAW-driven destructive mutations (e.g., Motivation-break
    // refusal reducing permanent Willpower; the matching Reverse refund)
    // pass `bypassPurchaseLock: true` in the update options to skip the
    // lock check. The handler that initiates the change is responsible
    // for ensuring the mutation is RAW-justified.
    if (options?.bypassPurchaseLock) return;

    const changes = collectPermanentTraitChanges(changed, this);
    if (changes.length === 0) return;

    // Reductions: reject the whole update outright.
    const reductions = changes.filter(c => c.kind === "reduction");
    if (reductions.length > 0) {
      ui.notifications.warn(game.i18n.format("EX2E.PurchaseLockedReduction", {
        trait: reductions[0].label
      }));
      return false;
    }

    // Increases: confirm each via a dialog, then merge the log + XP
    // delta into `changed` so the field update and the ledger landing
    // persist atomically.
    const { PurchaseConfirmDialog } = await import("../dialogs/purchase-confirm-dialog.mjs");
    const { computeXpCost } = await import("../helpers/xp-costs.mjs");

    const newLog = [...(this.system.purchaseLog ?? [])];
    let newXp = Number(this.system.experience?.value ?? 0);

    for (const change of changes) {
      const costResult = computeXpCost(this, {
        kind: "field", path: change.path,
        oldValue: change.oldValue, newValue: change.newValue
      });
      const result = await PurchaseConfirmDialog.prompt({
        actor:        this,
        change:       {
          traitLabel: change.label,
          oldValue:   String(change.oldValue),
          newValue:   String(change.newValue)
        },
        initialXp:    costResult.xp,
        initialNote:  "",
        showStubHint: !costResult.confident,
        description:  costResult.description
      });
      if (result === null) return false;   // cancelled → abort whole update

      newLog.push({
        timestamp:  Date.now(),
        userId:     game.user.id,
        userName:   game.user.name,
        traitPath:  change.path,
        traitLabel: change.label,
        oldValue:   String(change.oldValue),
        newValue:   String(change.newValue),
        xpCost:     result.xpCost,
        note:       result.note
      });
      newXp -= result.xpCost;
    }

    foundry.utils.mergeObject(changed, {
      system: {
        purchaseLog:      newLog,
        experience:       { value: newXp }
      }
    });
  }

  /**
   * Post-persist hook. Watches for `splat.lunar.activeFormId` changes and
   * syncs the actor's prototype token + linked scene tokens to show the
   * active Heart's Blood form's image (or the actor portrait when
   * reverting to human guise).
   */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (userId !== game.user.id) return;
    if (this.type !== "character") return;

    if (this.system.exaltType === "lunar" && changed.system?.splat?.lunar?.activeFormId !== undefined) {
      await this._syncTokenToActiveForm(this.system.splat.lunar.activeFormId);
    }

    const casteChanged     = changed.system?.caste     !== undefined;
    const exaltTypeChanged = changed.system?.exaltType !== undefined;
    if (casteChanged || exaltTypeChanged) await this._swapAnimaPower();

    if (changed.system?.scenePeripheral !== undefined) {
      await this._checkAnimaPowerAutoActivation(this.system.anima);
    }
  }

  /**
   * Resolve the image to display for the given active form id (empty =
   * human guise = actor portrait; non-empty = the form item's image), then
   * write it to the actor's prototype token AND every existing linked
   * token across all scenes. Unlinked tokens are left alone — they're
   * intentionally independent copies, not "this Lunar's body".
   */
  async _syncTokenToActiveForm(targetFormId) {
    let newImg;
    if (!targetFormId) {
      newImg = this.img;
    } else {
      const form = this.items.get(targetFormId);
      newImg = form?.img ?? this.img;
    }
    if (!newImg) return;

    // Prototype token (template for future placements).
    await this.update({ "prototypeToken.texture.src": newImg });

    // Existing linked tokens on all scenes.
    for (const scene of game.scenes ?? []) {
      for (const token of scene.tokens ?? []) {
        if (token.actorId === this.id && token.actorLink) {
          await token.update({ "texture.src": newImg });
        }
      }
    }
  }

  async _swapAnimaPower() {
    if (!game.user.isGM) return;

    const exaltType = this.system.exaltType;
    const caste     = this.system.caste;

    if (exaltType === "mortal" || (exaltType === "lunar" && caste === "casteless") || !caste) {
      if (this._isBeingDeleted) return;
      const existing = this.items.filter(i => i.flags?.exalted2e?.animaPower === true);
      if (existing.length > 0) {
        await this.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
      }
      return;
    }

    const pack = game.packs.get("exalted2e.animapowers");
    if (!pack) {
      console.warn("Exalted 2e | animapowers compendium not found");
      return;
    }

    // getIndex does not reliably populate system.* fields for custom types;
    // load all documents and filter directly.
    const docs = await pack.getDocuments();
    const doc  = docs.find(d =>
      d.system.exaltType === exaltType && d.system.caste === caste && !d.system.isGreaterSign
    );
    if (!doc) {
      console.warn(`Exalted 2e | No anima power found for ${exaltType}/${caste}`);
      return;
    }

    const itemData = doc.toObject();
    itemData.system.active = false;

    // _preDelete sets _isBeingDeleted synchronously before the server
    // round-trip, so this check is reliable even mid-async.
    if (this._isBeingDeleted) return;

    const existing = this.items.filter(i => i.flags?.exalted2e?.animaPower === true);
    if (existing.length > 0) {
      await this.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    }
    if (this._isBeingDeleted) return;

    const toCreate = [itemData];
    if (exaltType === "sidereal") {
      const greaterSign = docs.find(d => d.system.exaltType === "sidereal" && d.system.caste === caste && d.system.isGreaterSign)        
      const gsData = greaterSign.toObject();
      gsData.system.active = false;
      toCreate.push(gsData);
    }
    await this.createEmbeddedDocuments("Item", toCreate);
  }

  async _checkAnimaPowerAutoActivation(animaKey) {
    const item = this.items.find(i => i.flags?.exalted2e?.animaPower === true);
    if (!item) return;

    const threshold = item.system.autoThreshold;
    if (!threshold) return;

    if (_animaLevel(animaKey) >= _animaLevel(threshold) && !item.system.active) {
      await item.update({ "system.active": true });
      const msg = game.i18n.format("EX2E.AnimaPowerAutoActivated", { power: item.name });
      ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: this }) });
    } else if (animaKey === "none" && item.system.active) {
      await item.update({ "system.active": false });
    }
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();

    const systemData = this.system;

    // ── Aggregate armor soak from equipped armor ──────────────────────────
    if (this.type === "character") {
      this._applyArmorSoak(systemData);
      this._applyCharmSoak(systemData);
      this._applyCharmMoveBonus(systemData);
      this._applyWeaponStats(systemData);
      this._applyArtifactCommitment(systemData);
    }

    // ── Aggregate DV penalties carried by ActiveEffects ───────────────────
    this._aggregateDVPenalties(systemData);
    this._aggregateMDVPenalties(systemData);
    this._aggregateDVBonuses(systemData);
    this._prepareAlchemicalDerived(systemData);
  }

  /**
   * Collect every DV penalty currently attached to this actor and expose it
   * as a typed array on `system.dvPenalties`.
   *
   * Each penalty lives as a flag on an ActiveEffect:
   *   flags.exalted2e.dvPenalty      = { type: string, value: number }
   *   flags.exalted2e.dvRefreshable  = true   // cleared at turn start
   *
   * Keeping the data on the effect (rather than summed onto a stored base
   * field) lets us preserve the type — future charms that grant immunity to
   * a particular penalty category can filter the list before it's applied.
   */
  _aggregateDVPenalties(systemData) {
    systemData.dvPenalties = aggregatePenalties(this.effects, "dvPenalty");
  }

  /**
   * Mirror of `_aggregateDVPenalties` for mental/social defense. MDV-
   * reducing AEs persist for their own duration (there is no tick-
   * based refresh like physical DVs have), so this aggregator does not
   * pair with any equivalent of `dvRefreshable`.
   */
  _aggregateMDVPenalties(systemData) {
    systemData.mdvPenalties = aggregatePenalties(this.effects, "mdvPenalty");
  }

  _aggregateDVBonuses(systemData) {
    let ignoreAll = false;
    const ignoreTypes = new Set();
    let aeDodge = 0, aeParry = 0;
    for (const ae of this.effects) {
      if (ae.disabled) continue;
      const flags = ae.flags?.exalted2e;
      if (!flags) continue;
      const ignore = flags.dvBonusIgnore;
      if (ignore) {
        if (ignore.all) ignoreAll = true;
        for (const t of (ignore.types ?? [])) ignoreTypes.add(t);
      }
      const legacyDv = flags.dvBonus;
      if (legacyDv) {
        aeDodge += legacyDv.dodge ?? 0;
        aeParry += legacyDv.parry ?? 0;
      }
    }
    systemData.dvBonusIgnore = { all: ignoreAll, types: [...ignoreTypes] };
    systemData.statusDVBonus = { dodgeBonus: aeDodge, parryBonus: aeParry };
  }

  /**
   * Compute Alchemical-specific derived data: clarity band modifiers,
   * installed slot counts, and derived submodule state (`requirementsMet`,
   * `parentInstalled`, `effectivelyActive`) for each submodule charm.
   * No-ops for non-Alchemical actors.
   */
  _prepareAlchemicalDerived(systemData) {
    if (systemData.exaltType !== "alchemical") return;
    const total = systemData.splat?.alchemical?.clarity?.total ?? 0;
    const band  = getClarityBand(total);
    systemData.clarityModifiers = {
      socialPenalty:      band.socialPenalty,
      compassionPenalty:  band.compassionPenalty,
      compassionAutoFail: band.compassionAutoFail,
      mentalBonus:        band.mentalBonus,
      autochthonBonus:    band.autochthonBonus,
    };
    const installed = this.items.filter(i => i.type === "charm" && i.system.installed);
    systemData.dedicatedSlotsUsed = installed.filter(i => i.system.installedSlotType === "dedicated").length;
    systemData.generalSlotsUsed   = installed.filter(i => i.system.installedSlotType === "general").length;

    for (const item of this.items) {
      if (item.type !== "charm" || !item.system.isSubmodule) continue;
      const essOk  = systemData.essence.value >= item.system.essence;
      const attrKey = item.system.ability;
      const attrOk  = !item.system.minAbility
        || !(attrKey in systemData.attributes)
        || systemData.attributes[attrKey].value >= item.system.minAbility;
      const parent = this.items.get(item.system.parentCharmId);
      item.system.requirementsMet   = essOk && attrOk;
      item.system.parentInstalled   = !!parent?.system?.installed;
      item.system.effectivelyActive = item.system.requirementsMet && item.system.parentInstalled
        && (item.system.charmType === "permanent" || item.system.active);
    }
  }

  /**
   * Sum every external penalty on this actor that applies to the given
   * action category. Each penalty lives on an ActiveEffect's flags as:
   *   flags.exalted2e.externalPenalty = { value: number, type: string }
   *
   * `type` is one of "physical" / "social" / "mental" / "all"; callers
   * pass the category they're rolling for, and a penalty matches iff its
   * type equals the category or is "all". Only non-reflexive rolls
   * (attacks, attribute+ability rolls) should subtract this — passive DV
   * calculations bypass it by not calling this helper.
   *
   * Foundry's built-in Prone status is patched in the init hook to carry
   * `{ value: 1, type: "physical" }`, which is where the penalty enters
   * the system — toggling Prone on the token HUD applies and removes it.
   */
  externalPenaltyFor(type = "physical") {
    return sumPenalties(this.effects, "externalPenalty", type);
  }

  /**
   * Same shape as `externalPenaltyFor` but for internal penalties. Both
   * subtract from dice pools today; tracking them separately matters
   * later for charm interactions (some charms reduce external penalties
   * but never internal ones).
   *
   * Internal penalty AEs are flagged:
   *   flags.exalted2e.internalPenalty = { value: number, type: string }
   * The current consumer is the "aborted Aim" -2 applied when a
   * character walks away from their designated target.
   */
  internalPenaltyFor(type = "physical") {
    let total = sumPenalties(this.effects, "internalPenalty", type);
    // Armor mobility penalty is a structural internal penalty on
    // physical actions — stored as a negative integer on the actor by
    // `_applyArmorSoak`, so flip the sign to get the deduction magnitude.
    // Fatigue AEs use type:"all" so sumPenalties picks them up above.
    if (type === "physical") {
      const mob = Number(this.system?.mobilityPenalty) || 0;
      if (mob < 0) total += -mob;
      for (const inj of (this.system?.cripplingInjuries ?? [])) {
        total += inj.penalty ?? 0;
      }
      const shieldMob = Number(this.system?.shieldMobilityPenalty) || 0;
      total += shieldMob;
    }
    return total;
  }

  /**
   * Convenience: stamp an internal penalty as a refreshable AE that
   * clears at the next DV refresh. Mirrors `applyDVPenalty` for the
   * external-penalty / DV story.
   */
  async applyInternalPenalty(value, { type = "all", label, icon } = {}) {
    if (!Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/regen.svg",
      flags: {
        exalted2e: {
          internalPenalty: { type, value },
          dvRefreshable:   true
        }
      },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  async applyCharmTargetEffect(te) {
    if (!te?.enabled) return null;
    const changes = (te.changes ?? [])
      .filter(c => c.key)
      .map(c => ({ key: c.key, type: c.type ?? "add", value: c.value }));
    const flags = { exalted2e: { charmTargetEffect: true, targetEffectDuration: te.duration ?? "oneScene" } };
    if (te.internalPenalty?.enabled) {
      const penaltyValue = Math.abs(te.internalPenalty.amount);
      if (penaltyValue > 0) {
        flags.exalted2e.internalPenalty = { type: te.internalPenalty.type, value: penaltyValue };
      }
    }
    const aeData = {
      name:     te.label || "Charm Effect",
      img:      te.icon  || "icons/svg/aura.svg",
      disabled: false,
      transfer: false,
      flags,
      changes,
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [aeData]);
    return created?.[0] ?? null;
  }

  _dvPenaltyIgnoring(ignoreTypes) {
    const penalties  = this.system?.dvPenalties ?? [];
    const immunities = new Set(this.getFlag("exalted2e", "dvImmunities") ?? []);
    let total = 0;
    for (const p of penalties) {
      if (immunities.has(p.type)) continue;
      if (ignoreTypes.has(p.type)) continue;
      total += p.value;
    }
    return total;
  }

  /** Sum of every non-immune DV penalty. */
  get dvPenaltyTotal() {
    return this._dvPenaltyIgnoring(new Set());
  }

  /** Sum of every non-immune MDV penalty. */
  get mdvPenaltyTotal() {
    const penalties = this.system?.mdvPenalties ?? [];
    const immunities = new Set(this.getFlag("exalted2e", "mdvImmunities") ?? []);
    let total = 0;
    for (const p of penalties) {
      if (immunities.has(p.type)) continue;
      total += p.value;
    }
    return total;
  }

  /** DV after current penalties, never below 0. */
  get currentDodgeDV() {
    const s = this.system;
    let base = (this.type === "character" ? (s.dodgeDV ?? 0)
              : this.type === "npc"       ? (s.combat?.dodgeDV ?? 0)
              : 0) + (s.bonuses?.dodgeBonus ?? 0) + (s.statusDVBonus?.dodgeBonus ?? 0);

    // Ride cap when mounted: Dodge DV = (Dex + min(Dodge, Ride)) / 2 + bonuses.
    if (this.type === "character") {
      const combatant = game.combat?.combatants?.find(c => c.actorId === this.id);
      if (combatant?.flags?.exalted2e?.mountedOn) {
        const dexVal   = s.attributes?.dexterity?.value ?? 0;
        const dodgeVal = s.abilities?.dodge?.value      ?? 0;
        const rideVal  = s.abilities?.ride?.value       ?? 0;
        const rideCap  = Math.floor((dexVal + Math.min(dodgeVal, rideVal)) / 2);
        base = Math.min(
          base,
          rideCap + (s.bonuses?.dodgeBonus ?? 0) + (s.statusDVBonus?.dodgeBonus ?? 0)
        );
      }
    }

    const ignore  = s.dvBonusIgnore ?? { all: false, types: [] };
    const penalty = ignore.all ? 0 : this._dvPenaltyIgnoring(new Set(ignore.types));
    return Math.max(0, base - penalty);
  }

  get currentParryDV() {
    const s = this.system;
    let base = (this.type === "character" ? (s.parryDV ?? s.parryDVBase ?? 0)
              : this.type === "npc"       ? (s.combat?.parryDV ?? 0)
              : 0) + (s.bonuses?.parryBonus ?? 0) + (s.statusDVBonus?.parryBonus ?? 0);

    // Ride cap when mounted: Parry DV = (Dex + min(Melee+spec, Ride) + weaponDef) / 2 + bonuses.
    if (this.type === "character") {
      const combatant = game.combat?.combatants?.find(c => c.actorId === this.id);
      if (combatant?.flags?.exalted2e?.mountedOn) {
        const dexVal   = s.attributes?.dexterity?.value ?? 0;
        const meleeVal = s.abilities?.melee?.value      ?? 0;
        const rideVal  = s.abilities?.ride?.value       ?? 0;
        const bestSpec = Math.max(
          0,
          ...(s.abilities?.melee?.specialties ?? []).map(sp => sp.value ?? 0)
        );
        const equippedWeapon = [...(this.items ?? [])]
          .filter(i => i.type === "weapon" && i.system.equipped)
          .reduce((best, w) => {
            const def = w.system.modes?.[0]?.effectiveDefense ?? w.system.modes?.[0]?.defense ?? 0;
            return def > (best?.def ?? -1) ? { w, def } : best;
          }, null);
        const weaponDef = equippedWeapon?.def ?? 0;
        const rideCap   = Math.floor(
          (dexVal + Math.min(meleeVal + bestSpec, rideVal) + weaponDef) / 2
        );
        base = Math.min(
          base,
          rideCap + (s.bonuses?.parryBonus ?? 0) + (s.statusDVBonus?.parryBonus ?? 0)
        );
      }
    }

    const ignore  = s.dvBonusIgnore ?? { all: false, types: [] };
    const penalty = ignore.all ? 0 : this._dvPenaltyIgnoring(new Set(ignore.types));
    return Math.max(0, base - penalty);
  }

  /** MDV after current penalties, never below 0. */
  get currentDodgeMDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.dodgeMDV ?? 0)
               : this.type === "npc"       ? (s.combat?.dodgeMDV ?? 0)
               : 0;
    return Math.max(0, base - this.mdvPenaltyTotal);
  }

  get currentParryMDV() {
    const s = this.system;
    const base = this.type === "character" ? (s.parryMDV?.best ?? 0)
               : this.type === "npc"       ? (s.combat?.parryMDV ?? 0)
               : 0;
    return Math.max(0, base - this.mdvPenaltyTotal);
  }

  /**
   * Create an ActiveEffect that records a DV penalty of the given type and
   * magnitude on this actor. The effect is flagged refreshable so the combat
   * document clears it at the start of this actor's next turn.
   *
   * @param {string} type    Penalty category, e.g. "flurry", "onslaught".
   * @param {number} value   Positive magnitude (penalty to DV).
   * @param {object} [opts]
   * @param {string} [opts.label]  Human-readable effect name (defaults to the type).
   * @param {string} [opts.icon]   Status icon path.
   */
  async applyDVPenalty(type, value, { label, icon, sticky = false, dvRefreshable = true } = {}) {
    if (!type || !Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/shield.svg",
      flags: {
        exalted2e: {
          dvPenalty:     { type, value },
          dvRefreshable,
          // Sticky DV penalties survive the usual "refresh on your next
          // action's tick" clear-out — abortable actions (Aim, Guard)
          // need their DV penalty to persist until the next DIFFERENT
          // action's speed elapses. Flipped to false at the next commit.
          dvSticky:      !!sticky
        }
      },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  async applyDVBonus(value, { label, icon, dvRefreshable = true } = {}) {
    if (!Number.isFinite(value) || value <= 0) return null;
    const created = await this.createEmbeddedDocuments("ActiveEffect", [{
      name:     label ?? "DV Bonus",
      img:      icon  ?? "icons/svg/shield.svg",
      flags: {
        exalted2e: {
          dvBonus:      { parry: value, dodge: value },
          dvRefreshable,
        }
      },
      disabled: false,
      transfer: false,
    }]);
    return created?.[0] ?? null;
  }

  /**
   * Mirror of `applyDVPenalty` for MDVs. No refreshable mechanism —
   * MDV-reducing AEs stand on their own duration. No `sticky` option
   * for the same reason.
   *
   * @param {string} type   Penalty category (e.g., "emotion", "illusion").
   * @param {number} value  Positive magnitude.
   * @param {object} [opts]
   * @param {string} [opts.label]
   * @param {string} [opts.icon]
   */
  async applyMDVPenalty(type, value, { label, icon } = {}) {
    if (!type || !Number.isFinite(value) || value <= 0) return null;
    const effectData = {
      name: label ?? type,
      img:  icon  ?? "icons/svg/aura.svg",
      flags: { exalted2e: { mdvPenalty: { type, value } } },
      disabled: false,
      transfer: false
    };
    const created = await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created?.[0] ?? null;
  }

  /**
   * Stamp (or bump) the onslaught penalty on this actor. RAW: any time a
   * character is attacked, they accrue +1 DV penalty until their next
   * action. Multiple attacks in the same tick cycle stack onto a single
   * AE so the effects list stays readable; `_aggregateDVPenalties` reads
   * the `value` field directly. Auto-cleared by `advanceWheel` when the
   * defender's initiative comes up (the standard DV refresh).
   */
  async addOnslaught() {
    const existing = this.effects.find(e =>
      !e.disabled && e.flags?.exalted2e?.dvPenalty?.type === "onslaught"
    );
    if (existing) {
      const next = (existing.flags.exalted2e.dvPenalty.value ?? 0) + 1;
      await existing.update({
        name: game.i18n.format("EX2E.OnslaughtEffect", { n: next }),
        "flags.exalted2e.dvPenalty.value": next
      });
      return existing;
    }
    return this.applyDVPenalty("onslaught", 1, {
      label: game.i18n.format("EX2E.OnslaughtEffect", { n: 1 }),
      icon:  "icons/svg/hazard.svg"
    });
  }

  /**
   * Sum attunement costs of every attuned artifact (weapons + armor) and
   * expose them as derived commitment totals. Artifacts always commit to the
   * peripheral pool — the two pools are interchangeable for this purpose.
   *
   * Stored fields (manual / charm commitments):
   *   motes.personal.committed, motes.peripheral.committed
   * Derived:
   *   motes.personal.artifactCommitted, motes.peripheral.artifactCommitted
   *   motes.personal.totalCommitted,    motes.peripheral.totalCommitted
   */
  _applyArtifactCommitment(systemData) {
    let artifactPeripheral = 0;
    for (const item of this.items) {
      if ((item.type === "weapon" || item.type === "armor")
          && item.system.artifact && item.system.attuned) {
        const cover = item.system.attunementMotesCover ?? 0;
        artifactPeripheral += Math.max(0, (item.system.attunementCost ?? 0) - cover);
      }
      if (item.type === "charm" && item.system.installed) {
        artifactPeripheral += item.system.essenceCommitment ?? 0;
      }
    }

    systemData.motes.personal.artifactCommitted   = 0;
    systemData.motes.peripheral.artifactCommitted = artifactPeripheral;

    systemData.motes.personal.totalCommitted   = (systemData.motes.personal.committed   ?? 0);
    systemData.motes.peripheral.totalCommitted = (systemData.motes.peripheral.committed ?? 0) + artifactPeripheral;

    // Effective maximum = total max reduced by what's locked in commitments.
    // Displayed in the UI and enforced by spendMotes.
    systemData.motes.personal.effectiveMax   = Math.max(0, (systemData.motes.personal.max   ?? 0) - systemData.motes.personal.totalCommitted);
    systemData.motes.peripheral.effectiveMax = Math.max(0, (systemData.motes.peripheral.max ?? 0) - systemData.motes.peripheral.totalCommitted);
  }

  /**
   * Add soak from the first equipped armor to the character's natural soak.
   * Also store the armor soak separately in systemData.armorSoak for later use.
   */
  _applyArmorSoak(systemData) {
    const equippedArmor = this.items.find(i => i.type === "armor" && i.system.equipped);
    if (equippedArmor) {
      const a = equippedArmor.system.effectiveSoak;
      systemData.armorSoak = {
        bashing:    a.bashing,
        lethal:     a.lethal,
        aggravated: a.aggravated
      };
      systemData.totalSoak = {
        bashing:    (systemData.naturalSoak?.bashing    ?? 0) + a.bashing,
        lethal:     (systemData.naturalSoak?.lethal     ?? 0) + a.lethal,
        aggravated: (systemData.naturalSoak?.aggravated ?? 0) + a.aggravated
      };
      systemData.hardness          = equippedArmor.system.effectiveHardness;
      systemData.mobilityPenalty   = equippedArmor.system.effectiveMobilityPenalty;
      systemData.armorName         = equippedArmor.name;
    } else {
      systemData.armorSoak = {
        bashing:    0,
        lethal:     0,
        aggravated: 0
      };
      systemData.totalSoak = { ...systemData.naturalSoak } ?? { bashing: 0, lethal: 0, aggravated: 0 };
      systemData.hardness        = 0;
      systemData.mobilityPenalty = 0;
      systemData.armorName       = null;
    }
  }

  _applyCharmSoak(systemData) {
    if (!systemData.totalSoak) return;

    // Read AE-backed soak bonuses from the bonuses accumulator populated
    // by charmSource AEs during charm activation.
    const b = systemData.bonuses ?? {};
    systemData.totalSoak.bashing    += b.soakBashing    ?? 0;
    systemData.totalSoak.lethal     += b.soakLethal     ?? 0;
    systemData.totalSoak.aggravated += b.soakAggravated ?? 0;

    // hardnessSetTo is non-additive (Math.max) — still scanned directly.
    const charms = this.items.filter(i => i.type === "charm" && isCharmPassivelyActive(i));
    let maxHardnessSetTo = 0;
    for (const c of charms) {
      if (c.system.soakBonus?.enabled) {
        const hst = c.system.soakBonus.hardnessSetTo ?? 0;
        if (hst > maxHardnessSetTo) maxHardnessSetTo = hst;
      }
    }
    systemData.hardness = Math.max(systemData.hardness ?? 0, maxHardnessSetTo)
                        + (b.hardnessAdd ?? 0);
  }

  _applyCharmMoveBonus(systemData) {
    const { dashBonus, hasFlight, hasWaterWalking } = aggregateMoveBonusFromCharms(this);
    systemData.dash             = (systemData.dash ?? 0) + dashBonus;
    systemData.derivedDashBonus = dashBonus;
    systemData.hasFlight        = hasFlight;
    systemData.hasWaterWalking  = hasWaterWalking;
  }

  /**
   * Build one row per (equipped weapon, mode of use) for the combat tab.
   */
  _applyWeaponStats(systemData) {
    const equipped = this.items.filter(i => i.type === "weapon" && i.system.equipped);
    const rows = [];
    for (const w of equipped) {
      const modes = w.system.modes ?? [];
      modes.forEach((mode, modeIndex) => {
        rows.push({
          id:         w.id,
          modeIndex,
          name:       modes.length > 1 ? `${w.name} — ${mode.name}` : w.name,
          speed:      mode.effectiveSpeed,
          accuracy:   mode.accuracyLabel,
          damage:     mode.damageLabel,
          defense:    mode.defenseLabel,
          rate:       mode.effectiveRate,
          range:      mode.effectiveRange
        });
      });
    }
    systemData.equippedWeapons = rows;
  }

  // ── Convenience Helpers ────────────────────────────────────────────────

  /**
   * Apply damage to the character.
   * @param {number} amount - Post-soak damage; soak is resolved upstream by the caller.
   * @param {"bashing"|"lethal"|"aggravated"} type - Damage type.
   * @param {object} [options={}]
   * @param {boolean} [options.unsoakable=false] - Accepted for API consistency; not applied in
   *   the body because `amount` is already net of soak. Soak bypass is the caller's responsibility.
   */
  async applyDamage(amount, type, { unsoakable = false } = {}) {
    if (this.type !== "character" && this.type !== "npc") return;

    // totalBoxes is computed by _prepareHealthData and includes Ox-Body charm grants.
    const totalBoxes = this.system.health.totalBoxes;

    const h = clampDamage(this.system.health, type, amount, totalBoxes);
    await this.update({ "system.health": h });

    // Both events fire on a killing blow: onDamageReceived first, then onKill.
    await this._fireRecoveryEvent("onDamageReceived");
    if (h.incapacitated) await this._fireRecoveryEvent("onKill");

    // Notify allies: any other character combatant whose charm watches onAllyAttacked.
    if (amount > 0 && game.combat?.combatants?.size) {
      const allies = game.combat.combatants
        .filter(c => c.actor && c.actor !== this && c.actor.type === "character")
        .map(c => c.actor);
      await Promise.all(allies.map(a => a._fireRecoveryEvent("onAllyAttacked", null, amount)));
    }
  }

  async _fireRecoveryEvent(event, target = null, damageLevels = 0) {
    if (this.type !== "character") return;
    const charms   = this.items.filter(i => i.type === "charm" && isCharmPassivelyActive(i));
    const rollData = this.getRollData() ?? {};

    const moteCharms = collectMoteRecoveryCharms(charms, event);
    for (const c of moteCharms) {
      const mr   = c.system.moteRecovery;
      const base = evaluateCharmFormula(mr.formula, rollData, 0);
      const amount = (mr.perDamageLevel && damageLevels > 0) ? base * damageLevels : base;
      if (amount <= 0) continue;
      if (mr.action === "gainOverdrive") {
        await this.addOverdriveMotes(amount);
      } else if (mr.source === "fromTarget" && target) {
        const pool = mr.action === "recoverPersonal" ? "personal" : "peripheral";
        await target.spendMotes(amount, pool);
      } else {
        const pool = mr.action === "recoverPersonal" ? "personal" : "peripheral";
        await this.recoverMotes(amount, pool);
      }
    }

    const wpCharms = collectWillpowerRecoveryCharms(charms, event);
    for (const c of wpCharms) {
      const wr     = c.system.willpowerRecovery;
      const amount = evaluateCharmFormula(wr.formula, rollData, 0);
      if (amount <= 0) continue;
      await this.recoverWillpower(amount);
    }
  }

  /**
   * Heal damage from the character, clearing from least severe first.
   * @param {number} amount
   */
  async healDamage(amount) {
    const h = healInOrder(this.system.health, amount);
    return this.update({ "system.health": h });
  }

  /**
   * Spend motes from the given pool. If the pool doesn't have enough,
   * the remainder spills over to the other pool.
   *
   * @param {number} amount
   * @param {"personal"|"peripheral"} pool
   * @returns {Promise<null | {fromPrimary:number, fromSecondary:number, primaryPool:string, secondaryPool:string}>}
   *     Per-pool breakdown on success (truthy), null on insufficient funds
   *     (with a user warning emitted). Callers that only care about
   *     success/failure still work — null is falsy, the object is truthy.
   */
  async spendMotes(amount, pool = "peripheral", { allowOverdrive = true } = {}) {
    if (this.type === "npc") {
      const m = this.system.motes;
      if ((m.value ?? 0) < amount) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughMotes"));
        return null;
      }
      await this.update({ "system.motes.value": (m.value ?? 0) - amount });
      return { fromPrimary: amount, fromSecondary: 0, primaryPool: "motes", secondaryPool: "motes" };
    }
    if (this.type !== "character") return null;

    // Overdrive is a buffer in front of Peripheral — drain it first, but only for offensive charms
    const overdrive = (pool === "peripheral" && allowOverdrive) ? (this.system.motes.peripheral.overdrive ?? 0) : 0;
    const primary   = this.system.motes[pool];
    const otherKey  = pool === "peripheral" ? "personal" : "peripheral";
    const secondary = this.system.motes[otherKey];

    if (overdrive + primary.value + secondary.value < amount) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotEnoughMotes"));
      return null;
    }

    // Drain order: overdrive → primary pool → secondary pool
    let remaining       = amount;
    const fromOverdrive = Math.min(overdrive, remaining);
    remaining          -= fromOverdrive;
    const fromPrimary   = Math.min(primary.value, remaining);
    remaining          -= fromPrimary;
    const fromSecondary = Math.min(secondary.value, remaining);

    const peripheralSpent    = pool === "peripheral" ? (fromOverdrive + fromPrimary) : fromSecondary;
    const oldScenePeripheral = this.system.scenePeripheral ?? 0;
    const newScenePeripheral = oldScenePeripheral + peripheralSpent;

    const updateData = {
      [`system.motes.${pool}.value`]:     primary.value   - fromPrimary,
      [`system.motes.${otherKey}.value`]: secondary.value - fromSecondary,
      "system.scenePeripheral":           newScenePeripheral
    };
    if (fromOverdrive > 0) {
      updateData["system.motes.peripheral.overdrive"] = overdrive - fromOverdrive;
    }

    await this.update(updateData, { scenePeripheralBefore: oldScenePeripheral });
    return {
      fromPrimary: fromOverdrive + fromPrimary,
      fromSecondary,
      primaryPool:   pool,
      secondaryPool: otherKey
    };
  }

  /**
   * Recover motes for the given pool.
   * @param {number} amount
   * @param {"personal"|"peripheral"} pool
   */
  async recoverMotes(amount, pool = "peripheral") {
    if (this.type !== "character") return;
    const moteData = this.system.motes[pool];
    const newVal   = Math.min(moteData.max, moteData.value + amount);
    return this.update({ [`system.motes.${pool}.value`]: newVal });
  }

  async addOverdriveMotes(amount) {
    if (this.type !== "character") return;

    // Surging Essence Reactor: when active, offer to convert to Attunement motes instead
    const hasSER = this.items.some(
      i => i.type === "charm" && isCharmPassivelyActive(i) && i.system.convertsOverdriveToAttunement
    );
    if (hasSER && amount > 0) {
      const toAttunement = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("EX2E.OverdriveOrAttunementTitle") },
        content: `<p>${game.i18n.format("EX2E.OverdriveOrAttunementBody", { amount })}</p>`,
        yes: { label: game.i18n.localize("EX2E.GainAttunementMotes"), icon: "fa-solid fa-gem"  },
        no:  { label: game.i18n.localize("EX2E.GainOverdriveMotes"),  icon: "fa-solid fa-bolt" }
      });
      if (toAttunement) {
        const cur = this.system.attunementMotes ?? 0;
        return this.update({ "system.attunementMotes": Math.min(100, cur + amount) });
      }
      // false or null → fall through to overdrive
    }

    const current = this.system.motes.peripheral.overdrive ?? 0;
    const newVal  = Math.min(25, current + amount);
    if (newVal === current) return;
    return this.update({ "system.motes.peripheral.overdrive": newVal });
  }

  /**
   * Allocate attunement motes to cover an artifact's attunement cost.
   * Reduces artifactPeripheral commitment for the actor, freeing real motes.
   * @param {string} itemId — weapon or armor item ID on this actor
   * @returns {Promise<boolean|null>} true on success, null on failure
   */
  async applyAttunementMotes(itemId) {
    if (this.type !== "character") return null;
    const item = this.items.get(itemId);
    if (!item || (item.type !== "weapon" && item.type !== "armor")) return null;
    if (!item.system.artifact) return null;

    const cost      = item.system.attunementCost ?? 0;
    const alreadyCovered = item.system.attunementMotesCover ?? 0;
    const remaining = cost - alreadyCovered;
    if (remaining <= 0) {
      ui.notifications.info(game.i18n.localize("EX2E.AttunementAlreadyCovered"));
      return null;
    }

    const available = this.system.attunementMotes ?? 0;
    if (available < remaining) {
      ui.notifications.warn(game.i18n.format("EX2E.NotEnoughAttunementMotes",
        { needed: remaining, have: available }));
      return null;
    }

    const isNewAttunement = !item.system.attuned;
    await item.update({
      "system.attuned":              true,
      "system.attunementMotesCover": cost,
      "system.attunedViaAttunement": isNewAttunement
    });
    await this.update({ "system.attunementMotes": available - remaining });
    return true;
  }

  async recoverWillpower(amount) {
    if (this.type !== "character") return;
    const wp = this.system.willpower;
    const newVal = Math.min(wp.max, (wp.value ?? 0) + amount);
    return this.update({ "system.willpower.value": newVal });
  }

  async rollMorningRest() {
    if (this.type !== "character") return;
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    const pool   = this.system.virtues.conviction.value;
    const flavor = game.i18n.localize("EX2E.MorningRest");
    const result = await ExaltedRoll.rollPool(this, { pool, flavor, category: "mental" });
    if (result.successes > 0) await this.recoverWillpower(result.successes);
  }

  async rollVirtueCheck(virtueName) {
    if (this.type !== "character") return;
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    const pool  = this.system.virtues[virtueName]?.value ?? 0;
    const label = game.i18n.localize(EX2E.virtues[virtueName] ?? virtueName);
    const result = await ExaltedRoll.rollPool(this, {
      pool,
      flavor:   game.i18n.format("EX2E.RollVirtue", { virtue: label }),
      category: "mental"
    });
    if (!result.successes) return;
    if (this.system.willpower.value < result.successes) {
      ui.notifications.warn(
        game.i18n.format("EX2E.VirtueSuppressionInsuffWP", { virtue: label, cost: result.successes })
      );
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: label },
      content: `<p>${game.i18n.format("EX2E.SuppressVirtue", { cost: result.successes, virtue: label })}</p>`
    });
    if (!confirmed) return;
    await applyVirtueSuppression(this, virtueName, result.successes);
  }

  /**
   * True when the charm's linked attribute is a Caste or Favored attribute on this actor.
   * Used to determine slot assignment during module installation.
   * @param {ExaltedItem} charm
   * @returns {boolean}
   */
  _isCharmCasteFavored(charm) {
    const attrKey = charm.system.ability;
    if (!attrKey) return false;
    return !!(this.system.attributes?.[attrKey]?.caste || this.system.attributes?.[attrKey]?.favored);
  }

  /**
   * Install a Charm as an Alchemical module. Auto-assigns to a dedicated slot
   * when the Charm is Caste/Favored and dedicated slots are free; otherwise
   * uses a general slot. Essence commitment is derived (like artifact attunement)
   * — it reduces peripheral effectiveMax while the module is installed.
   * @param {string} charmId
   */
  async installCharm(charmId) {
    if (this.system.exaltType !== "alchemical") return;
    const charm = this.items.get(charmId);
    if (!charm || charm.system.installed) return;

    const sys          = this.system.splat.alchemical;
    const dedicatedFree = sys.dedicatedSlots - (this.system.dedicatedSlotsUsed ?? 0);
    const generalFree   = sys.generalSlots   - (this.system.generalSlotsUsed   ?? 0);

    let slotType;
    if (this._isCharmCasteFavored(charm) && dedicatedFree > 0) slotType = "dedicated";
    else if (generalFree > 0)                                  slotType = "general";
    else {
      ui.notifications.warn(game.i18n.localize("EX2E.NoSlotsAvailable"));
      return;
    }

    const commitment = charm.system.essenceCommitment ?? 0;
    if (commitment > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize("EX2E.InstallCharm") },
        content: game.i18n.format("EX2E.InstallCharmConfirm", { name: charm.name, cost: commitment }),
      });
      if (!confirmed) return;
    }
    await charm.update({ "system.installed": true, "system.installedSlotType": slotType });
  }

  /**
   * Uninstall a Charm module. Releases the peripheral Essence commitment
   * (derived — effectiveMax recovers on next prepareDerivedData).
   * @param {string} charmId
   */
  async uninstallCharm(charmId) {
    if (this.system.exaltType !== "alchemical") return;
    const charm = this.items.get(charmId);
    if (!charm || !charm.system.installed) return;
    await charm.update({ "system.installed": false, "system.installedSlotType": "" });
  }
}
