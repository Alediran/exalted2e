import { normalizeCost, parseCostFormula, moteCostString } from "../rolls/activation-ledger.mjs";
import { buildCharmWeaponData } from "./charm-weapon-data.mjs";
import { getOutOfAspectSurcharge, getForeignCharmSurcharge, getCelestialMASurcharge } from "../helpers/aspect-surcharge.mjs";
import { computeFoiSurcharge } from "../helpers/foi-helpers.mjs";
import { SCOPE_TO_TYPE } from "../rolls/charm-event-math.mjs";
import { initialRemainingActions } from "../helpers/charm-deactivation.mjs";

/**
 * ExaltedItem – extends the base Foundry Item document.
 */
export class ExaltedItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  /** @override — auto-activate permanent charms when added to an actor. */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (game.userId !== userId) return;
    if (this.type !== "charm" || this.system.duration !== "permanent" || !this.actor) return;
    await this.activateCharm({ skipXpConfirm: true, skipChatCard: true });
  }

  /** @override — re-sync synth AEs for permanent charms when their system data changes. */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.userId !== userId) return;
    if (this.type !== "charm" || this.system.duration !== "permanent" || !this.actor) return;
    if (!foundry.utils.hasProperty(changed, "system")) return;
    const { applyCharmAEs } = await import("../combat/form-charms.mjs");
    const stale = this.actor.effects.filter(
      e => e.flags?.exalted2e?.synthAE && e.flags.exalted2e.charmSource === this.id
    );
    for (const ae of stale) await ae.delete();
    // Enhancing charms only have AEs while the base charm is active.
    const sys = this.system;
    if (!sys.enhancesCharmUid || this.actor.items.some(
      i => i.type === "charm" && i.system?.charmUid === sys.enhancesCharmUid && i.system?.active
    )) {
      await applyCharmAEs(this.actor, this, this.getRollData?.() ?? {});
    }
  }

  /**
   * Apply attunement-commitment deltas to the parent character's peripheral
   * pool when the `attuned` flag or `attunementCost` changes on an artifact.
   * Attuning moves motes out of `value` (they become committed); un-attuning
   * returns them (capped at max).
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    const actor = this.actor;
    if (!actor || actor.type !== "character") return;
    if (this.type !== "weapon" && this.type !== "armor") return;
    if (!this.system.artifact) return;

    const oldAttuned = this.system.attuned ?? false;
    const newAttuned = changed.system?.attuned ?? oldAttuned;
    const oldCost    = this.system.attunementCost ?? 0;
    const newCost    = changed.system?.attunementCost ?? oldCost;

    const oldCommit  = oldAttuned ? oldCost : 0;
    const newCommit  = newAttuned ? newCost : 0;
    const delta      = newCommit - oldCommit;
    if (delta === 0) return;

    const pool     = actor.system.motes.peripheral;
    const newValue = Math.min(pool.max ?? 0, Math.max(0, (pool.value ?? 0) - delta));
    await actor.update({ "system.motes.peripheral.value": newValue });
  }

  /**
   * Block deletion of the system-managed Unarmed Attacks weapon, and return
   * committed motes to the pool if an attuned artifact is deleted.
   */
  async _preDelete(options, user) {
    // The Unarmed Attacks weapon is part of every character by design —
    // refuse to delete it regardless of who triggered the delete.
    if (this.type === "weapon" && this.getFlag("exalted2e", "unarmed")) {
      ui.notifications.warn(game.i18n.localize("EX2E.CannotRemoveUnarmed"));
      return false;
    }
    this._isBeingDeleted = true;
    await super._preDelete(options, user);
    // Deleting an active charm: remove all charmSource AEs and spawned weapons.
    if (this.type === "charm" && this.actor
        && (this.system?.active || this.system?.attack?.enabled)) {
      await this._removeCharmWeaponArtifacts();
    }
    // Form item deletion: if this form is the actor's active form or
    // designated spirit shape, null the dangling reference so the sheet
    // doesn't show a broken link.
    if (this.type === "form" && this.actor?.type === "character") {
      const sys = this.actor.system.splat?.lunar;
      const updates = {};
      if (sys?.activeFormId === this.id)      updates["system.splat.lunar.activeFormId"]      = "";
      if (sys?.spiritShapeFormId === this.id) updates["system.splat.lunar.spiritShapeFormId"] = "";
      if (Object.keys(updates).length) await this.actor.update(updates);
    }
    const actor = this.actor;
    if (!actor || actor.type !== "character") return;
    if (this.type !== "weapon" && this.type !== "armor") return;
    if (!(this.system.artifact && this.system.attuned)) return;

    const cost = this.system.attunementCost ?? 0;
    if (cost <= 0) return;

    const pool     = actor.system.motes.peripheral;
    const newValue = Math.min(pool.max ?? 0, (pool.value ?? 0) + cost);
    await actor.update({ "system.motes.peripheral.value": newValue });
  }

  // ── Charm Helpers ──────────────────────────────────────────────────────

  /**
   * Activate this charm on the owning actor, spending motes as required.
   *
   * @param {object}  [opts]
   * @param {boolean} [opts.skipXpConfirm=false] Suppress the XP confirmation
   *     dialog — Combo activation funnels the total XP into a single
   *     up-front confirm, so per-charm confirms would be double-prompting.
   * @param {string}  [opts.via=null] Diagnostic tag stamped into the
   *     activation ledger (`ledger.via`). Currently only "combo" is used;
   *     reserved for a possible future consolidated-Reverse path.
   * @returns {Promise<boolean>} true if activation succeeded.
   */
  async activateCharm({ skipXpConfirm = false, skipChatCard = false, ledgerBucket = null, via = null, explicitTargetActor = null, explicitMotesOverride = null } = {}) {
    if (this.type !== "charm") return false;
    const actor = this.actor;
    if (!actor) return false;

    const isToggleable = this.system.duration !== "instant" && this.system.duration !== "permanent";
    const isStackable  = isToggleable && (this.system.keywords ?? []).includes("Stackable");
    // Stackable charms never turn off via the sheet button — each click adds a stack.
    const turningOff   = isToggleable && this.system.active && !isStackable;

    const _costParsed = parseCostFormula(this.system.cost?.formula ?? "");
    const permEss     = _costParsed?.permanentEssence  ?? 0;
    const permWp      = _costParsed?.permanentWillpower ?? 0;

    if (this.system.isSubmodule && !this.system.effectivelyActive && !turningOff) {
      ui.notifications.warn(game.i18n.localize("EX2E.SubmoduleNotActive"));
      return false;
    }

    // ── Action-Only gate ───────────────────────────────────────────────────
    // Action-Only charms cannot be used as reflexive counters or out-of-turn
    // activations. The restriction only applies inside an active combat; in
    // narrative scenes any character may activate freely.
    if (!turningOff && this.system.keywords?.includes("Action-Only") && game.combat?.started) {
      if (game.combat.combatant?.actorId !== actor.id) {
        ui.notifications.warn(
          game.i18n.format("EX2E.ActionOnlyCharmForbidden", { name: this.name })
        );
        return false;
      }
    }

    // ── Axiomatic gate ─────────────────────────────────────────────────────
    // Axiomatic charms cannot be used by creatures of the Void.
    if (!turningOff && (this.system.keywords ?? []).includes("Axiomatic")) {
      const isVoid = !!actor.effects?.some(
        e => !e.disabled && e.flags?.exalted2e?.creatureOfVoid === true
      );
      if (isVoid) {
        ui.notifications.warn(
          game.i18n.format("EX2E.AxiomaticForbiddenForVoid", { name: this.name })
        );
        return false;
      }
    }

    // ── Training gate ──────────────────────────────────────────────────────
    // A charm in the training ledger cannot be activated until training is
    // marked complete by the GM.
    if (!turningOff && this.type === "charm") {
      const inTraining = (actor.system.trainingLedger ?? []).some(
        e => e.charmId === this.id
      );
      if (inTraining) {
        ui.notifications.warn(
          game.i18n.format("EX2E.TrainingNotComplete", { name: this.name })
        );
        return false;
      }
    }

    // ── Form-type charm: one-at-a-time enforcement ────────────────────────
    // For toggle-on: enforce one-Form-at-a-time; deactivate any existing Form
    //   first, then fall through to the normal path (costs, weapon artifacts,
    //   active toggle, DV penalty, chat card, etc.).
    // For toggle-off: fall through directly — the universal sustained-teardown
    //   block below calls _removeCharmWeaponArtifacts() for all isToggleable charms.
    if (this.system.keywords?.includes("Form-type")) {
      if (!turningOff) {
        // TODO: Prismatic Arrangement of Creation Style — skip one-Form limit
        // when actor has that Form's capstone active.
        const oldCharm = actor.items.find(i =>
          i.type === "charm"
            && i.system?.keywords?.includes("Form-type")
            && i.system?.active
            && i.id !== this.id
        );
        if (oldCharm) {
          const { deactivateForm } = await import("../combat/form-charms.mjs");
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            window:  { title: game.i18n.localize("EX2E.FormSwapTitle") },
            content: game.i18n.format("EX2E.FormSwapContent", {
              old: oldCharm.name,
              new: this.name
            })
          });
          if (!confirmed) return false;
          await deactivateForm(oldCharm);
        }
      }
      // toggle-off: fall through — expanded teardown below handles charmSource AEs
    }

    const sys      = this.system;
    const cost     = sys.cost ?? {};
    const motePool = "peripheral";  // default pool; chosen at activation time
    // isToggleable and turningOff are already declared above

    // Soft prerequisite check: warn (non-blocking) if any prereq group has
    // no satisfying owned charm. Homebrew / house-rule builds can always
    // activate regardless, so this is informational, not gating.
    if (!turningOff) {
      const { evaluateCharmPrereqs } = await import("../helpers/charm-prereqs.mjs");
      const report = evaluateCharmPrereqs(this, actor);
      const missing = report.filter(r => !r.satisfied);
      if (missing.length > 0) {
        const missingLabels = missing.map(m => m.label || "?").join("; ");
        ui.notifications.warn(game.i18n.format("EX2E.PrereqMissingToast", {
          charm:   this.name,
          missing: missingLabels
        }));
      }
    }

    // Mastery commitment (Infinite [Ability] Mastery charms).
    // Stored as a flags-only AE tagged charmSource so _removeCharmWeaponArtifacts
    // cleans it up automatically on toggle-off or charm deletion.
    if (!turningOff && sys.excellency === "infiniteMastery") {
      const existingAE = actor.effects.find(
        e => e.flags?.exalted2e?.charmSource === this.id
          && "masteryCommitment" in (e.flags?.exalted2e ?? {})
      );
      const oldCommitment = existingAE ? (existingAE.flags.exalted2e.masteryCommitment ?? 0) : 0;
      if (existingAE) await existingAE.delete();

      const essence   = actor?.system?.essence?.value ?? 1;
      const maxCommit = essence >= 4 ? 9999 : 6;
      const capWarning = maxCommit !== 9999
        ? `<p class="notification warning" style="margin:4px 0">${game.i18n.format("EX2E.MasteryCommitCapWarning", { max: maxCommit })}</p>`
        : "";
      const content = `
<div class="field-group">
  <label>${game.i18n.localize("EX2E.MasteryCommitment")}</label>
  <input type="number" name="commitment" value="${Math.min(oldCommitment, maxCommit)}"
         min="0" max="${maxCommit === 9999 ? "" : maxCommit}" style="width:5em">
</div>
${capWarning}`;
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.format("EX2E.MasteryCommitDialog", { name: this.name }) },
        content,
        ok: { callback: (_ev, button) => Math.min(maxCommit, Math.max(0, parseInt(button.form.elements.commitment.value) || 0)) }
      });
      if (result === null || result === undefined) return false;
      const clampedResult = Math.min(maxCommit === 9999 ? Infinity : maxCommit, Math.max(0, result));

      const _raMastery = initialRemainingActions(sys.duration);
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:     this.name,
        img:      this.img ?? "icons/svg/aura.svg",
        transfer: false,
        flags:    {
          exalted2e: {
            charmSource:       this.id,
            masteryCommitment: clampedResult,
            masteryAbility:    sys.ability,
            baseCostMotes:     _costParsed?.motes ?? 0,
            charmDuration:     sys.duration,
            ...(_raMastery !== null ? { remainingActions: _raMastery } : {})
          }
        }
      }]);

      const delta = clampedResult - oldCommitment;
      if (delta !== 0) {
        const pool = actor.system.motes.peripheral;
        await actor.update({ "system.motes.peripheral.value":
          Math.max(0, Math.min(pool.max ?? 0, (pool.value ?? 0) - delta)) });
      }
    }

    // Spend all resource costs up front. Shared with castSpell() so both
    // paths use the same resolution order + XP confirmation + ledger shape.
    // When turning a sustained charm OFF, we skip spending entirely — the
    // original commit already paid its costs, and toggling back off is
    // a free action.
    let cooperation = null;
    let ledger;
    let _selectedActiveTier = null; // set in Step A (else branch); read in Step B and tiersApplied
    let _passiveTiers = [];         // set in else branch; read in Step B
    let _me = null;                 // mergeEffects fn; set in else branch; read in Step B
    if (turningOff) {
      ledger = {
        moteBreakdown: null, willpower: 0, bashing: 0, lethal: 0,
        aggravated: 0, xp: 0,
        permanentEssence:   0,
        permanentWillpower: 0,
        toggledOn: false, toggledOff: false, stackedOn: false,
        spawnedWeapon: false, rolledInstant: false,
        cooperation: null,
        via
      };
    } else {
      const { _qualifyingTiers: _qt, mergeEffects: _meImport } = await import("../rolls/charm-tier-math.mjs");
      _me = _meImport;
      const { passive: _pt, active: _activeTiers } = _qt(actor, this);
      // Snapshot as plain objects immediately — DataModel re-init after this.update() can
      // reinitialize array-item references back to schema defaults.
      _passiveTiers = _pt.map(t => foundry.utils.deepClone(t));

      // Step A — active tier selection (before costs so tier cost can be appended)
      if (_activeTiers.length > 0) {
        const { TierSelectionDialog } = await import("../apps/tier-selection-dialog.mjs");
        const _dialogResult = await TierSelectionDialog.prompt({ active: _activeTiers });
        if (_dialogResult === null) return false;
        if (!_dialogResult.standard) _selectedActiveTier = foundry.utils.deepClone(_dialogResult.tier);
      }
      // If an active tier was selected, append its cost formula to the base cost
      const _tierCostFormula = _selectedActiveTier?.cost?.formula ?? "";
      const _effectiveCostFormula = _tierCostFormula
        ? [sys.cost?.formula ?? "", _tierCostFormula].filter(Boolean).join(", ")
        : (sys.cost?.formula ?? "");

      const surcharge    = getOutOfAspectSurcharge(actor, this) + getForeignCharmSurcharge(actor, this) + getCelestialMASurcharge(actor, this);
      const costParsed   = _costParsed;   // already computed above

      // Resolve variable mote cost. explicitMotesOverride skips dialogs (for tests/automation).
      let motesOverride;
      let surchargeExtra = null;
      if (explicitMotesOverride !== null) {
        motesOverride = explicitMotesOverride + surcharge;
        // Attack dialog pre-computes total motes and passes them as motesOverride,
        // skipping the variable-cost dialog.  Compute resolvedUnits here so that
        // rollAttack pre-eval can scale per-unit effects (e.g. postSoakDicePerMote).
        if (costParsed?.moteVar?.type === 'perUnit') {
          const { rate, rateN } = costParsed.moteVar;
          const base  = costParsed.motes;
          const units = Math.max(0, Math.round((explicitMotesOverride - base) * rateN / rate));
          await this.update({ 'system.resolvedUnits': units });
        }
      } else if (costParsed?.moteVar || costParsed?.surcharge?.length) {
        const resolved = await this._resolveVariableMoteCost(cost, costParsed);
        if (resolved === null) return false;
        ({ surchargeExtra } = resolved);
        motesOverride = resolved.motes + surcharge;
        if (costParsed.moteVar?.type === 'perUnit') {
          const { rate, rateN } = costParsed.moteVar;
          const base  = costParsed.motes;
          const units = Math.max(0, Math.round((resolved.motes - base) * rateN / rate));
          await this.update({ 'system.resolvedUnits': units });
        }
      } else if (surcharge > 0) {
        motesOverride = (costParsed?.motes ?? 0) + surcharge;
      }

      const isOffensive = this._isCharmOffensive();
      ledger = await this._spendActivationCosts(
        { ...cost, formula: _effectiveCostFormula },
        { motePool, skipXpConfirm, motesOverride, allowOverdrive: isOffensive }
      );
      if (!ledger) return false;

      // Grant Overdrive motes on activation if the charm specifies them
      if (sys.overdriveMotes) {
        const rollData = actor.getRollData?.() ?? {};
        const _odMotes = evaluateCharmFormula(sys.overdriveMotes, rollData, 0);
        if (_odMotes > 0) await actor.addOverdriveMotes(_odMotes);
      }

      // Spend non-mote costs from the selected surcharge option (motes already in motesOverride).
      if (surchargeExtra) {
        if (surchargeExtra.willpower > 0) {
          const wp = Number(actor.system.willpower?.value) || 0;
          await actor.update({ "system.willpower.value": Math.max(0, wp - surchargeExtra.willpower) });
          ledger.willpower += surchargeExtra.willpower;
        }
        if (surchargeExtra.bashingHealth > 0) {
          await actor.applyDamage(surchargeExtra.bashingHealth, "bashing");
          ledger.bashing += surchargeExtra.bashingHealth;
        }
        if (surchargeExtra.lethalHealth > 0) {
          await actor.applyDamage(surchargeExtra.lethalHealth, "lethal");
          ledger.lethal += surchargeExtra.lethalHealth;
        }
        if (surchargeExtra.aggravatedHealth > 0) {
          await actor.applyDamage(surchargeExtra.aggravatedHealth, "aggravated");
          ledger.aggravated += surchargeExtra.aggravatedHealth;
        }
        if (surchargeExtra.xp > 0) {
          const xp = Number(actor.system.experience?.value) || 0;
          await actor.update({ "system.experience.value": Math.max(0, xp - surchargeExtra.xp) });
          ledger.xp += surchargeExtra.xp;
        }
      }
      // Charm-specific ledger flags that _spendActivationCosts doesn't know
      // about live alongside the shared ones.
      ledger.permanentEssence   = permEss;
      ledger.permanentWillpower = permWp;
      ledger.toggledOn     = false;
      ledger.toggledOff    = false;
      ledger.spawnedWeapon = false;
      ledger.rolledInstant = false;
      ledger.via           = via;

      ledger.tiersApplied = [];
      for (const t of _passiveTiers) ledger.tiersApplied.push({ label: t.label, type: "passive" });
      if (_selectedActiveTier !== null) ledger.tiersApplied.push({ label: _selectedActiveTier.label, type: "active" });

      if (permEss > 0 || permWp > 0) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:  this.name,
          flags: { exalted2e: { permanentCost: { essence: permEss, willpower: permWp }, sourceItem: this.id } }
        }]);
      }

      if (sys.keywords?.includes("Cooperative")) {
        const { CooperativeCharmDialog } = await import("../dialogs/cooperative-charm-dialog.mjs");
        const result = await CooperativeCharmDialog.prompt(this, actor);
        if (result?.supporters?.length) {
          cooperation = { supporters: [], bonusDice: 0 };
          for (const supporter of result.supporters) {
            const breakdown = await supporter.spendMotes(_costParsed?.motes ?? 0, "peripheral", { allowOverdrive: isOffensive });
            if (breakdown) {
              cooperation.supporters.push({ actorId: supporter.id, name: supporter.name, motesPaid: _costParsed?.motes ?? 0 });
            } else {
              ui.notifications?.warn(game.i18n.format("EX2E.CooperationSpendFailed", { name: supporter.name }));
            }
          }
          cooperation.bonusDice = cooperation.supporters.length * (sys.cooperationBonusDice ?? 0);
          if (cooperation.supporters.length === 0) cooperation = null;
        }
      }
      ledger.cooperation = cooperation;
    }

    // Restore peripheral motes before the mastery AE is deleted by cleanup.
    if (turningOff && isToggleable && sys.excellency === "infiniteMastery") {
      const ae = actor.effects.find(
        e => e.flags?.exalted2e?.charmSource === this.id
          && "masteryCommitment" in (e.flags?.exalted2e ?? {})
      );
      const f = ae?.flags?.exalted2e ?? {};
      const totalRestore = (f.masteryCommitment ?? 0) + (f.baseCostMotes ?? 0);
      if (totalRestore > 0) {
        const pool = actor.system.motes.peripheral;
        await actor.update({ "system.motes.peripheral.value": Math.min(pool.max ?? 0, (pool.value ?? 0) + totalRestore) });
      }
    }

    // Remove all charmSource AEs + weapons when any sustained charm toggles off.
    if (turningOff && isToggleable) {
      const myUid = sys.charmUid;
      if (myUid) {
        const enhancementAEs = actor.effects.filter(
          e => e.flags?.exalted2e?.enhancesCharmUid === myUid && e.flags?.exalted2e?.synthAE
        );
        for (const ae of enhancementAEs) await ae.delete();
      }
      await this._removeCharmWeaponArtifacts();
    }

    // Weapon-like attack side effects — only when the Attack tab is enabled.
    if (sys.attack?.enabled) {
      if (turningOff) {
        // already handled above
      } else if (sys.duration === "instant") {
        // Fire the attack roll right now using a transient weapon. The
        // attack card snapshots stats, so deleting the temp weapon
        // afterwards doesn't affect downstream resolution.
        await this._rollCharmInstantAttack({ extraDice: cooperation?.bonusDice ?? 0 });
        ledger.rolledInstant = true;
      } else {
        await this._spawnCharmWeaponArtifacts();
        ledger.spawnedWeapon = true;
      }
    }

    // Sustained perfect defense AE — create on toggle-on, delete on toggle-off.
    // Only wired for toggleable (oneScene / indefinite) charms; instant charms
    // are resolved immediately through the Step 2 dialog.
    if (sys.perfectDefenseType && isToggleable) {
      if (turningOff) {
        const pdAE = actor.effects.find(
          e => e.flags?.exalted2e?.sustainedPerfectDefense && e.flags?.exalted2e?.charmSource === this.id
        );
        if (pdAE) await pdAE.delete();
      } else {
        const _raPD = initialRemainingActions(sys.duration);
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:     `${game.i18n.localize("EX2E.PerfectDefense")} — ${this.name}`,
          img:      this.img ?? "icons/magic/defensive/shield-barrier-glowing-blue.webp",
          flags:    { exalted2e: { sustainedPerfectDefense: { type: sys.perfectDefenseType }, charmSource: this.id, charmDuration: sys.duration, ...(_raPD !== null ? { remainingActions: _raPD } : {}) } },
          disabled: false,
          transfer: false
        }]);
      }
    }

    // Toggle active state for sustained Charms
    if (isToggleable) {
      if (isStackable) {
        const newCount = (sys.stackCount ?? 0) + 1;
        const updates  = { "system.stackCount": newCount };
        if (!sys.active) updates["system.active"] = true;
        await this.update(updates);
        ledger.toggledOn  = !sys.active;  // true only on the first stack
        ledger.stackedOn  = !!sys.active; // true when adding to an existing stack
        ledger.toggledOff = false;
      } else {
        await this.update({ "system.active": !sys.active });
        ledger.toggledOn  = !turningOff;
        ledger.toggledOff = turningOff;
        ledger.stackedOn  = false;
      }
    }

    if (!turningOff && (sys.charmType === "simple" || sys.charmType === "shintai") && (sys.dvPenalty ?? 0) < 0) {
      await actor.applyDVPenalty("all", Math.abs(sys.dvPenalty), {
        label: this.name,
        icon:  this.img
      });
    }

    if (!turningOff && sys.targetEffect?.enabled && sys.targetEffect.trigger === "onActivate") {
      const targetActor = explicitTargetActor ?? game.user.targets.first()?.actor;
      if (targetActor) {
        await targetActor.applyCharmTargetEffect(sys.targetEffect);
      }
    }

    if (!turningOff && sys.targetPenalty?.enabled && sys.charmType !== "supplemental") {
      const targetActor = explicitTargetActor ?? game.user.targets.first()?.actor;
      if (targetActor) {
        const rollData = actor.getRollData?.() ?? {};
        const rawAmount = sys.targetPenalty.amountFormula
          ? evaluateCharmFormula(sys.targetPenalty.amountFormula, rollData, sys.targetPenalty.amount ?? 0)
          : (sys.targetPenalty.amount ?? 0);
        const penaltyValue = Math.abs(Math.min(0, rawAmount));
        if (penaltyValue > 0) {
          const type = SCOPE_TO_TYPE[sys.targetPenalty.scope] ?? "all";
          const _penaltyDuration = sys.targetPenalty.duration ?? "oneScene";
          const _raTP = initialRemainingActions(_penaltyDuration);
          await targetActor.createEmbeddedDocuments("ActiveEffect", [{
            name:     this.name,
            img:      this.img ?? "icons/svg/regen.svg",
            disabled: false,
            transfer: false,
            flags:    { exalted2e: { internalPenalty: { type, value: penaltyValue }, charmDuration: _penaltyDuration, ...(_raTP !== null ? { remainingActions: _raTP } : {}) } }
          }]);
        }
      }
    }

    if (!turningOff && sys.healingRoll?.enabled) {
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      const rollData = actor.getRollData?.() ?? {};
      const poolSize = Math.max(0, evaluateCharmFormula(sys.healingRoll.pool, rollData, 0));
      const result = await ExaltedRoll.rollPool(actor, {
        pool:     poolSize,
        flavor:   game.i18n.localize("EX2E.HealingRoll"),
        category: "all",
      });
      const bonus = sys.healingRoll.bonus
        ? evaluateCharmFormula(sys.healingRoll.bonus, rollData, 0)
        : 0;
      const total = Math.max(0, result.successes + bonus);
      const healTarget = sys.healingRoll.target === "target"
        ? (explicitTargetActor ?? game.user.targets.first()?.actor ?? actor)
        : actor;
      if (total > 0) await healTarget.healDamage(total);
    }

    // Step B — effect merging: build proxy charm carrying merged system
    let _proxyCharm = this;
    if (!turningOff) {
      if (_passiveTiers.length > 0 || _selectedActiveTier !== null) {
        const _baseSysData = this.system.toObject?.() ?? foundry.utils.deepClone(this.system);
        const _mergedSystem = _me(_baseSysData, _passiveTiers, _selectedActiveTier, actor.getRollData?.() ?? {});
        _proxyCharm = { id: this.id, name: this.name, img: this.img, effects: this.effects, system: _mergedSystem };
      }
    }

    if (!turningOff && sys.duration === "permanent") {
      const { applyCharmAEs } = await import("../combat/form-charms.mjs");
      // Enhancing charms defer their AEs to when the base charm activates.
      if (!sys.enhancesCharmUid || actor.items.some(
        i => i.type === "charm" && i.system?.charmUid === sys.enhancesCharmUid && i.system?.active
      )) {
        await applyCharmAEs(actor, _proxyCharm, this.getRollData?.() ?? {});
      }
    }

    if (!turningOff && isToggleable) {
      const { applyCharmAEs } = await import("../combat/form-charms.mjs");
      await applyCharmAEs(actor, _proxyCharm, this.getRollData?.() ?? {});
      // Also apply synth AEs for permanent charms that enhance this charm.
      const myUid = sys.charmUid;
      if (myUid) {
        const enhancingCharms = actor.items.filter(
          i => i.type === "charm" && i.system?.enhancesCharmUid === myUid
        );
        for (const enhancer of enhancingCharms) {
          await applyCharmAEs(actor, enhancer, enhancer.getRollData?.() ?? {});
        }
      }
    }

    if (!turningOff) {
      if (ledgerBucket !== null) {
        ledgerBucket.push({ charmId: this.id, charmName: this.name, charmImg: this.img, actorId: actor.id, ledger });
      } else if (!skipChatCard) {
        await this.sendToChat({ activation: ledger });
      }
    }

    // Blasphemy alert: notify GM when an Infernal activates a Blasphemy charm.
    if (!turningOff
        && (this.system.keywords ?? []).includes("Blasphemy")
        && actor.system.exaltType === "infernal") {
      const { postBlasphemyAlert } = await import("../rolls/blasphemy.mjs");
      await postBlasphemyAlert(actor, this);
    }

    return true;
  }

  /**
   * Cast this spell on the owning actor: soft-check initiation against the
   * spell's circle, spend motes / willpower / health / XP via the shared
   * activation ledger, and post the chat card with a Reverse button.
   *
   * Initiation is informational only — a toast fires when the caster's
   * initiation is below the spell's circle, but casting continues
   * (homebrew / rules-of-cool, and matches the prereq soft-warn pattern).
   *
   * @deprecated The system's UI now routes spell casts through the
   * RAW-correct shaping pipeline (`castSpellFlow` in
   * `module/ui/cast-spell-flow.mjs`) — Speed-5 shape × N circles, mote
   * commitment with refund-on-interrupt, Cast Sorcery action,
   * tradition-correct chat card. This legacy immediate-cast method is
   * preserved for user-written macros that may still reference
   * `actor.items.get(id).castSpell()`. Prefer the new flow for
   * everything else.
   *
   * @returns {Promise<boolean>} true if the cast succeeded, false if the
   *                             user aborted an XP confirmation or motes
   *                             couldn't cover the cost.
   */
  async castSpell() {
    if (this.type !== "spell") return false;
    const actor = this.actor;
    if (!actor) return false;

    const sys = this.system;

    const tradKey    = sys.tradition === "necromancy" ? "necromancy" : "sorcery";
    const initiation = Number(actor.system?.[tradKey]?.initiation ?? 0);
    if (initiation < sys.circle) {
      ui.notifications.warn(game.i18n.format("EX2E.SpellInitiationWarning", {
        spell:    this.name,
        required: sys.circle,
        current:  initiation
      }));
    }

    const ledger = await this._spendActivationCosts(sys.cost ?? {});
    if (!ledger) return false;

    await this.sendToChat({ activation: ledger });
    return true;
  }

  /**
   * Shared activation-cost resolver for charms and spells. Spends in a
   * fixed order (XP confirmation → motes → willpower → health → XP) and
   * returns a ledger the chat card's Reverse button can undo field-by-
   * field. Returns null on any hard failure (user cancelled XP confirm,
   * motes couldn't be paid); partial spends are not possible — every
   * mutation here is contingent on the whole chain succeeding.
   *
   * Charm-only ledger flags (toggledOn/Off, spawnedWeapon, rolledInstant)
   * are added by the caller since they're attack-block / sustain
   * bookkeeping; this helper only handles the pure resource side.
   *
   * @param {object} cost  The item's `system.cost` object.
   * @param {object} [opts]
   * @param {string} [opts.motePool="peripheral"]   Which pool motes come from.
   * @param {boolean}[opts.skipXpConfirm=false]     Skip the XP confirmation.
   * @param {number} [opts.motesOverride]           If provided, replaces cost.motes entirely
   *                                                (already includes any surcharge).
   * @returns {Promise<object|null>} Ledger, or null on abort/failure.
   */

  /**
   * True when this charm may draw from the Overdrive pool.
   * Overdrive motes can only fund offensive charms (attack supplements / reflexive attack steps).
   */
  _isCharmOffensive() {
    const sys = this.system;
    if (sys.attackBonus?.enabled) return true;
    if (Array.isArray(sys.steps) && sys.steps.length > 0) return true;
    return false;
  }

  async _spendActivationCosts(cost, { motePool = "peripheral", skipXpConfirm = false, motesOverride, allowOverdrive = true } = {}) {
    const actor = this.actor;
    if (!actor) return null;

    const {
      moteCost, willpowerCost, bashingCost, lethalCost, aggravatedCost, xpCost
    } = normalizeCost(cost, { motesOverride });

    const ledger = {
      moteBreakdown: null,
      willpower:     0,
      bashing:       0,
      lethal:        0,
      aggravated:    0,
      xp:            0
    };

    // XP is irrecoverable in-world — confirm before touching anything.
    if (!skipXpConfirm && xpCost > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("EX2E.CharmXPConfirmTitle") },
        content: `<p>${game.i18n.format("EX2E.CharmXPConfirmBody", {
          name: this.name, xp: xpCost
        })}</p>`,
        yes: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" },
        no:  { label: game.i18n.localize("EX2E.Cancel"),  icon: "fa-solid fa-xmark"  }
      });
      if (!confirmed) return null;
    }

    // Flaw of Invulnerability selection: fires when hasFoi=true and cost includes XP.
    if (this.system?.hasFoi && xpCost > 0) {
      const allOptions = game.exalted2e.EX2E.foiTypes[actor.system.exaltType] ?? [];
      const owned      = new Set((this.system.flawsOfInvulnerability ?? []).map(f => f.type));
      const available  = allOptions.filter(o => !owned.has(o.key));

      let newEntry = null;
      if (allOptions.length === 0) {
        const customLabel = await foundry.applications.api.DialogV2.prompt({
          window:  { title: game.i18n.localize("EX2E.FoiCustomLabel") },
          content: `<div class="field-group"><label>${game.i18n.localize("EX2E.FoiCustomLabel")}</label>
                    <input type="text" name="result" value="" style="width:100%" autofocus></div>`,
          ok: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" }
        });
        if (!customLabel) return null;
        newEntry = { type: "custom", label: String(customLabel) };
      } else if (available.length === 0) {
        await foundry.applications.api.DialogV2.alert({
          window:  { title: game.i18n.localize("EX2E.FlawsOfInvulnerability") },
          content: `<p>${game.i18n.localize("EX2E.FoiAllOwned")}</p>`,
        });
        return null;
      } else {
        const options = available.map(o => `<option value="${o.key}">${o.label}</option>`).join("");
        const selectedKey = await foundry.applications.api.DialogV2.prompt({
          window:  { title: game.i18n.localize("EX2E.FoiSelectPrompt") },
          content: `<div class="field-group"><label>${game.i18n.localize("EX2E.FoiSelectPrompt")}</label>
                    <select name="result">${options}</select></div>`,
          ok: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" }
        });
        if (!selectedKey) return null;
        const opt = available.find(o => o.key === selectedKey);
        newEntry = { type: opt.key, label: opt.label };
      }

      const existing = this.system.flawsOfInvulnerability ?? [];
      await this.update({ "system.flawsOfInvulnerability": [...existing, newEntry] });
    }

    // Motes (spendMotes returns per-pool breakdown on success, null if pools can't cover).
    if (moteCost > 0) {
      const breakdown = await actor.spendMotes(moteCost, motePool, { allowOverdrive });
      if (!breakdown) return null;
      ledger.moteBreakdown = breakdown;
    }

    // Willpower.
    if (willpowerCost > 0) {
      const currentWp = Number(actor.system.willpower?.value) || 0;
      await actor.update({
        "system.willpower.value": Math.max(0, currentWp - willpowerCost)
      });
      ledger.willpower = willpowerCost;
    }

    // Health costs — sequential so wound-cap / incapacitation runs per bucket.
    if (bashingCost    > 0) { await actor.applyDamage(bashingCost,    "bashing");    ledger.bashing    = bashingCost; }
    if (lethalCost     > 0) { await actor.applyDamage(lethalCost,     "lethal");     ledger.lethal     = lethalCost; }
    if (aggravatedCost > 0) { await actor.applyDamage(aggravatedCost, "aggravated"); ledger.aggravated = aggravatedCost; }

    // XP last.
    if (xpCost > 0) {
      const currentXp = Number(actor.system.experience?.value) || 0;
      await actor.update({
        "system.experience.value": Math.max(0, currentXp - xpCost)
      });
      ledger.xp = xpCost;
    }

    return ledger;
  }

  /**
   * Open DialogV2 prompts to resolve a variable mote cost at activation time.
   *
   * Surcharge pre-step: if parsed.surcharge is set, offer surcharge options first.
   * MoteVar step: if parsed.moteVar is set, open the appropriate picker.
   * Returns { motes, surchargeExtra } on success, or null if cancelled.
   * surchargeExtra is the full ParsedCost of the chosen surcharge option (for non-mote spend),
   * or null if no surcharge was taken.
   *
   * @param {object}     cost    The charm's system.cost object (has formula field).
   * @param {ParsedCost} parsed  Pre-parsed result of parseCostFormula(cost.formula).
   * @returns {Promise<{motes:number, surchargeExtra:ParsedCost|null}|null>}
   */
  async _resolveVariableMoteCost(cost, parsed) {
    if (!parsed) parsed = parseCostFormula(cost?.formula ?? "");
    if (!parsed) return { motes: 0, surchargeExtra: null };

    let selectedMotes = parsed.motes;
    let surchargeExtra = null;

    // ── Surcharge pre-step ───────────────────────────────────────────────────
    if (parsed.surcharge?.length) {
      const available = parsed.surcharge.filter(o => !o.condition || o.conditionMet);
      if (available.length === 1) {
        // Single option: confirm dialog
        const opt    = available[0];
        const label  = opt.label ?? moteCostString(opt.cost);
        const prefix = opt.relative ? "+" : "";
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window:  { title: game.i18n.format("EX2E.SurchargeConfirmTitle", { name: this.name }) },
          content: `<p>${game.i18n.format("EX2E.SurchargeConfirmBody", { cost: prefix + label })}</p>`,
          yes: { label: game.i18n.localize("EX2E.Confirm"), icon: "fa-solid fa-check" },
          no:  { label: game.i18n.localize("EX2E.Skip"),   icon: "fa-solid fa-xmark"  }
        });
        if (confirmed) { selectedMotes += opt.cost.motes; surchargeExtra = opt.cost; }
      } else if (available.length > 1) {
        // Multiple options: radio picker
        const rows = available.map((o, i) => {
          const prefix = o.relative ? "+" : "";
          const label  = o.label ?? moteCostString(o.cost);
          return `<label style="display:block;margin:4px 0;cursor:pointer">
            <input type="radio" name="surcharge" value="${i}" ${i === 0 ? "checked" : ""}> ${foundry.utils.escapeHTML(prefix + label)}
          </label>`;
        }).join("");
        const optIdx = await foundry.applications.api.DialogV2.wait({
          window:  { title: game.i18n.format("EX2E.SurchargeConfirmTitle", { name: this.name }) },
          content: `<div style="padding:8px">${rows}</div>`,
          buttons: [
            { action: "confirm", label: game.i18n.localize("EX2E.Confirm"), default: true,
              callback: (_ev, _btn, dialog) => parseInt(dialog.element.querySelector("input[name=surcharge]:checked")?.value ?? "0", 10) },
            { action: "skip", label: game.i18n.localize("EX2E.Skip") }
          ],
          rejectClose: false
        });
        if (optIdx !== null && optIdx !== "skip" && Number.isFinite(optIdx)) {
          const picked = available[optIdx];
          if (picked) { selectedMotes += picked.cost.motes ?? 0; surchargeExtra = picked.cost; }
        }
      }
    }

    // ── MoteVar picker ───────────────────────────────────────────────────────
    const { moteVar } = parsed;
    if (!moteVar) return { motes: selectedMotes, surchargeExtra };

    if (moteVar.type === "tiered") {
      const tierRows = moteVar.tiers.map((t, i) =>
        `<label style="display:block;margin:4px 0;cursor:pointer">
          <input type="radio" name="tier" value="${i}" ${i === 0 ? "checked" : ""}> ${foundry.utils.escapeHTML(t.label || String(t.moteCost) + "m")} (${t.moteCost}m)
        </label>`
      ).join("");
      const tierId = await foundry.applications.api.DialogV2.wait({
        window:  { title: game.i18n.format("EX2E.VariableMotePromptTitle", { name: this.name }) },
        content: `<div style="padding:8px"><p>${game.i18n.localize("EX2E.SelectTierPrompt")}</p>${tierRows}</div>`,
        buttons: [
          { action: "confirm", label: game.i18n.localize("EX2E.Confirm"), default: true,
            callback: (_ev, _btn, dialog) => parseInt(dialog.element.querySelector("input[name=tier]:checked")?.value ?? "0", 10) },
          { action: "cancel",  label: game.i18n.localize("EX2E.Cancel") }
        ],
        rejectClose: false
      });
      if (tierId == null || tierId === "cancel") return null;
      const safeId = Math.min(Math.max(0, tierId), moteVar.tiers.length - 1);
      selectedMotes = moteVar.tiers[safeId]?.moteCost ?? selectedMotes;
    }

    if (moteVar.type === "perUnit" || moteVar.type === "openEnded") {
      const isPerUnit   = moteVar.type === "perUnit";
      const rate        = isPerUnit ? moteVar.rate    : 1;
      const unitLabel   = isPerUnit ? moteVar.unit    : "mote";
      const min         = isPerUnit ? moteVar.min     : 0;
      const maxResolved = isPerUnit ? (moteVar.maxResolved ?? 0) : 0;
      const maxAttr     = maxResolved > 0 ? ` max="${maxResolved}"` : "";
      const rateN       = isPerUnit ? (moteVar.rateN ?? 1) : 1;
      const rateNote    = rateN > 1 ? ` (${rate}m per ${rateN} ${unitLabel})` : ` (${rate}m/${unitLabel})`;

      const units = await foundry.applications.api.DialogV2.wait({
        window:  { title: game.i18n.format("EX2E.VariableMotePromptTitle", { name: this.name }) },
        content: `<div style="padding:8px">
          <p>${game.i18n.format("EX2E.SelectUnitsPrompt", { unit: foundry.utils.escapeHTML(unitLabel), cost: rate })}${rateNote}</p>
          <div class="form-group">
            <label>${foundry.utils.escapeHTML(unitLabel)}</label>
            <input type="number" name="units" value="${min}" min="${min}"${maxAttr} style="width:60px">
          </div>
        </div>`,
        buttons: [
          { action: "confirm", label: game.i18n.localize("EX2E.Confirm"), default: true,
            callback: (_ev, _btn, dialog) => {
              const v = parseInt(dialog.element.querySelector("input[name=units]")?.value ?? String(min), 10);
              return Math.max(min, isNaN(v) ? min : v);
            }
          },
          { action: "cancel", label: game.i18n.localize("EX2E.Cancel") }
        ],
        rejectClose: false
      });
      if (units == null || units === "cancel") return null;
      // For perUnit: cost += floor(units / rateN) * rate
      // For openEnded: cost += units (extra motes spent)
      selectedMotes += isPerUnit
        ? Math.floor(units / rateN) * rate
        : units;
    }

    return { motes: selectedMotes, surchargeExtra };
  }

  /**
   * Build a transient weapon item from the charm's attack block, run a full
   * attack through ExaltedRoll.rollAttack using it, then delete the item.
   * The attack card flags snapshot the mode's stats so removal is safe.
   */
  async _rollCharmInstantAttack({ extraDice = 0 } = {}) {
    const actor = this.actor;
    if (!actor) return;
    const weaponData = this._buildCharmWeaponData();
    const [weapon] = await actor.createEmbeddedDocuments("Item", [weaponData]);
    try {
      const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttack(actor, weapon.id, { modeIndex: 0, extraDice });
    } finally {
      await weapon.delete();
    }
  }

  /**
   * Spawn a persistent weapon item + a tracking ActiveEffect on the actor.
   * Both carry `flags.exalted2e.charmSource = <charmId>` so we can find and
   * remove them when the charm deactivates (or via the Effects tab).
   */
  async _spawnCharmWeaponArtifacts() {
    const actor = this.actor;
    if (!actor) return;
    // If we've already spawned for this charm (double-activation, sheet
    // re-renders, etc.), don't stack duplicates.
    const alreadySpawned = actor.items.some(
      i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === this.id
    );
    if (alreadySpawned) return;

    const weaponData = this._buildCharmWeaponData();
    weaponData.system.equipped = true;
    await actor.createEmbeddedDocuments("Item", [weaponData]);
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${this.name} — ${game.i18n.localize("EX2E.CharmWeapon")}`,
      img:  this.img || "icons/svg/sword.svg",
      flags: { exalted2e: {
        charmSource:   this.id,
        charmDuration: this.system.duration
      } },
      disabled: false,
      transfer: false
    }]);
  }

  /**
   * Find and delete every weapon / AE tagged with this charm as its source.
   * Called when the charm toggles off, is deleted, or when the tracking AE
   * is deleted manually (see exalted2e.mjs pre-delete hook).
   */
  async _removeCharmWeaponArtifacts() {
    const actor = this.actor;
    if (!actor) return;
    const weaponIds = actor.items
      .filter(i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === this.id)
      .map(i => i.id);
    const effectIds = actor.effects
      .filter(e => e.flags?.exalted2e?.charmSource === this.id)
      .map(e => e.id);
    if (weaponIds.length) await actor.deleteEmbeddedDocuments("Item",         weaponIds);
    if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
  }

  /**
   * Activate this Combo: plan which owned charms will fire vs. skip,
   * show a single preflight dialog with aggregate cost + XP confirm,
   * post a header chat card, then iterate each planned charm through
   * the existing `activateCharm({ skipXpConfirm: true, via: "combo" })`
   * pipeline so each keeps its own chat card + Reverse button.
   *
   * @param {boolean} [opts.isSocialContext=false]  True when the combo fires as part of a social roll.
   * @returns {{ success: boolean, activatedCharms: ExaltedItem[] }}
   *   `success` is false if the user cancelled. Callers that only care about
   *   cancellation can test `result.success`; callers that need the charm list
   *   (e.g. social attack pipeline) read `result.activatedCharms`.
   */
  async activateCombo({ isSocialContext = false } = {}) {
    if (this.type !== "combo") return { success: false, activatedCharms: [] };
    const actor = this.actor;
    if (!actor) return { success: false, activatedCharms: [] };

    // Escape user-controlled strings (charm names, actor/combo names,
    // raw UIDs) before they land in dialog / chat HTML.
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

    // Resolve charmUids → owned charms by stable UID.
    const byUid = new Map();
    for (const i of actor.items) {
      if (i.type !== "charm") continue;
      const uid = i.system?.charmUid;
      if (uid) byUid.set(uid, i);
    }

    const planned  = [];  // { charm }
    const skipped  = [];  // { charm }
    const missing  = [];  // { uid }

    for (const uid of (this.system.charmUids ?? [])) {
      const charm = byUid.get(uid);
      if (!charm) { missing.push({ uid }); continue; }
      const isToggleable = charm.system?.duration !== "instant" && charm.system?.duration !== "permanent";
      if (isToggleable && charm.system?.active) {
        skipped.push({ charm });
      } else {
        planned.push({ charm });
      }
    }

    // Aggregate cost totals over the planned set.
    const total = { motes: 0, willpower: 0, bashing: 0, lethal: 0, aggravated: 0, xp: 0 };
    for (const { charm } of planned) {
      const c = charm.system?.cost ?? {};
      total.motes      += (Number(c.motes) || 0) + getOutOfAspectSurcharge(actor, charm) + getForeignCharmSurcharge(actor, charm) + getCelestialMASurcharge(actor, charm);
      total.willpower  += Number(c.willpower)        || 0;
      total.bashing    += Number(c.bashingHealth)    || 0;
      total.lethal     += Number(c.lethalHealth)     || 0;
      total.aggravated += Number(c.aggravatedHealth) || 0;
      total.xp         += Number(c.xp)               || 0;
    }

    // Flaw of Invulnerability surcharge: +2 WP when the combo has a Form-type
    // charm and at least one charm with repurchased FoI entries.
    const allComboCharms = [
      ...planned.map(p => p.charm),
      ...skipped.map(s => s.charm),
    ];
    const foiSurcharge = computeFoiSurcharge(allComboCharms);
    total.willpower += foiSurcharge;

    // Build the preflight body.
    const sectionList = (items, mapFn) =>
      items.length ? `<ul style="margin:4px 0 10px 18px">${items.map(mapFn).join("")}</ul>` : "";
    const costBits = [];
    if (total.motes)      costBits.push(`${total.motes}m`);
    if (total.willpower)  costBits.push(`${total.willpower}wp`);
    if (total.bashing)    costBits.push(`${total.bashing}b`);
    if (total.lethal)     costBits.push(`${total.lethal}l`);
    if (total.aggravated) costBits.push(`${total.aggravated}a`);
    if (total.xp)         costBits.push(`${total.xp}xp`);
    const costLine = costBits.length ? costBits.join(", ") : "—";
    const foiNote  = foiSurcharge > 0
      ? `<p class="foi-surcharge-note"><em>${game.i18n.localize("EX2E.FoiSurcharge")}: +2wp</em></p>`
      : "";

    const charmCost = (charm) => {
      const c = charm.system?.cost ?? {};
      const surcharge = getOutOfAspectSurcharge(actor, charm) + getForeignCharmSurcharge(actor, charm) + getCelestialMASurcharge(actor, charm);
      const bits = [];
      const motes = (Number(c.motes) || 0) + surcharge;
      if (motes)              bits.push(`${motes}m`);
      if (c.willpower)        bits.push(`+${c.willpower}wp`);
      if (c.bashingHealth)    bits.push(`${c.bashingHealth}b`);
      if (c.lethalHealth)     bits.push(`${c.lethalHealth}l`);
      if (c.aggravatedHealth) bits.push(`${c.aggravatedHealth}a`);
      if (c.xp)               bits.push(`${c.xp}xp`);
      return bits.length ? ` (${bits.join(" ")})` : "";
    };

    const content = `
      ${planned.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightWillActivate")}</h4>${
        sectionList(planned, ({ charm }) =>
          `<li>${esc(charm.name)}${charmCost(charm)}</li>`)
      }` : ""}
      ${skipped.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightAlreadyActive")}</h4>${
        sectionList(skipped, ({ charm }) =>
          `<li>${esc(charm.name)}</li>`)
      }` : ""}
      ${missing.length ? `<h4>${game.i18n.localize("EX2E.ComboPreflightMissing")}</h4>${
        sectionList(missing, ({ uid }) =>
          `<li title="${esc(uid)}">${game.i18n.localize("EX2E.ComboBroken")}</li>`)
      }` : ""}
      ${planned.length === 0
        ? `<p><em>${game.i18n.localize("EX2E.ComboPreflightNothingToDo")}</em></p>`
        : `<p><strong>${game.i18n.localize("EX2E.ComboPreflightTotal")}:</strong> ${costLine}</p>`}
      ${foiNote}
    `;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:  { title: game.i18n.format("EX2E.ComboPreflightTitle", { name: this.name }) },
      content,
      yes: { label: game.i18n.localize("EX2E.ComboActivate"), icon: "fa-solid fa-bolt" },
      no:  { label: game.i18n.localize("EX2E.Cancel"),        icon: "fa-solid fa-xmark" }
    });
    if (!confirmed) return { success: false, activatedCharms: [] };

    // Fire each planned charm; collect ledgers for the consolidated activation card.
    const activationBucket = [];
    for (const { charm } of planned) {
      await charm.activateCharm({ skipXpConfirm: true, via: "combo", ledgerBucket: activationBucket });
    }

    const hasObviousCharm = planned.some(({ charm }) =>
      charm.system?.keywords?.includes("Obvious")
    );

    if (activationBucket.length > 0) {
      await sendCombinedActivationCard(actor, activationBucket, {
        title:          game.i18n.format("EX2E.ComboHeaderMessage", { actor: actor.name, name: this.name }),
        isSocialContext,
        isObvious:      hasObviousCharm,
      });
    }

    const activatedIds = new Set(activationBucket.map(e => e.charmId));
    return { success: true, activatedCharms: planned.filter(({ charm }) => activatedIds.has(charm.id)).map(({ charm }) => charm) };
  }

  /** Shape the charm's attack config into a weapon item's creation data. */
  _buildCharmWeaponData() {
    return buildCharmWeaponData({
      attack:   this.system.attack,
      name:     this.name,
      img:      this.img,
      id:       this.id,
      duration: this.system.duration,
      rollData: this.actor?.getRollData?.() ?? {}
    });
  }

  /**
   * Send this item's description as a chat message.
   *
   * @param {object} [options]
   * @param {object} [options.activation] Ledger of what a charm activation
   *   spent / toggled, stamped onto the message's flags so the card's
   *   Reverse button can undo it later. Shape:
   *     { moteBreakdown, willpower, toggledOn, toggledOff,
   *       spawnedWeapon, rolledInstant }
   */
  async sendToChat({ activation = null } = {}) {
    const templateData = {
      item:  this,
      actor: this.actor,
      activation,
      canReverse: !!activation && !!this.actor
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/item-card.hbs",
      templateData
    );
    const speaker = this.actor
      ? ChatMessage.getSpeaker({ actor: this.actor })
      : ChatMessage.getSpeaker();

    const flags = activation
      ? { exalted2e: {
          charmActivation: {
            charmId:  this.id,
            actorId:  this.actor?.id ?? null,
            ledger:   activation,
            reversed: false
          }
        } }
      : {};
    return ChatMessage.create({ content, speaker, flags });
  }
}

/**
 * Create one consolidated activation chat card for a batch of charms that fired
 * together (combo activation or multiple supplementals in an attack dialog).
 *
 * @param {ExaltedActor} actor   The actor who activated the charms.
 * @param {object[]}     entries Array of `{ charmId, charmName, charmImg, actorId, ledger }` — one per charm.
 * @param {object}       [opts]
 * @param {string}       [opts.title=""]               Header title for the card.
 * @param {boolean}      [opts.isSocialContext=false]   True when the activation is part of a social roll.
 * @param {boolean}      [opts.isObvious=false]         True when at least one charm in the batch has the Obvious keyword.
 */
export async function sendCombinedActivationCard(actor, entries, { title = "", isSocialContext = false, isObvious = false } = {}) {
  const processedEntries = entries.map(e => {
    const parts = [];
    const mb = e.ledger?.moteBreakdown;
    if (mb) {
      const total = (mb.fromPrimary ?? 0) + (mb.fromSecondary ?? 0);
      if (total > 0) parts.push(`${total}m`);
    }
    if (e.ledger?.willpower)  parts.push(`${e.ledger.willpower}wp`);
    if (e.ledger?.bashing)    parts.push(`${e.ledger.bashing}b`);
    if (e.ledger?.lethal)     parts.push(`${e.ledger.lethal}l`);
    if (e.ledger?.aggravated) parts.push(`${e.ledger.aggravated}a`);
    if (e.ledger?.xp)         parts.push(`${e.ledger.xp}xp`);
    return { ...e, costDisplay: parts.join(", ") || "—" };
  });

  const socialSubtle = isSocialContext && !isObvious;

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/charm-activation-combined.hbs",
    { title, actorName: actor.name, entries: processedEntries, canReverse: processedEntries.length > 0, socialSubtle }
  );
  const speaker = ChatMessage.getSpeaker({ actor });
  const flags = {
    exalted2e: {
      charmActivation: {
        combined: true,
        actorId:  actor.id,
        entries:  entries.map(e => ({ ...e, reversed: false })),
        reversed: false
      }
    }
  };
  return ChatMessage.create({ content, speaker, flags });
}

/**
 * Resolve a charm-attack formula (e.g. `"@str + @essence / 2"`) against
 * the given actor roll-data to an integer. Plain numbers short-circuit;
 * empty strings return `fallback`. Parse / eval failures log a warning
 * and fall back as well — a broken formula shouldn't block charm use.
 */
export function evaluateCharmFormula(formula, rollData, fallback = 0) {
  if (formula === null || formula === undefined || formula === "") return fallback;
  if (typeof formula === "number") return Math.floor(formula);
  const s = String(formula).trim();
  if (s === "") return fallback;
  // Plain integer / decimal — skip Roll machinery.
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Math.floor(Number(s));
  try {
    const substituted = Roll.replaceFormulaData(s, rollData ?? {}, { missing: "0", warn: false });
    const value       = Roll.safeEval(substituted);
    return Number.isFinite(value) ? Math.floor(value) : fallback;
  } catch (err) {
    console.warn("[EX2E] Charm formula failed:", formula, err);
    return fallback;
  }
}
