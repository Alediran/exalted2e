import { ex2eCan } from "../helpers/permissions.mjs";
import { sortCombatants, computeTickFromJB } from "../combat/combat-math.mjs";
import { planCommitOther, dispatchTickAdvance } from "../combat/multi-tick.mjs";

/**
 * ExaltedCombat — wheel-based tick initiative for Exalted 2e.
 *
 * The wheel: `combat.currentTick` is a GM-advanced counter. Every combatant
 * has an `initiative` value equal to the tick on which their next action
 * will resolve. A combatant is:
 *   • Free            — `initiative <= currentTick && !actedThisTick`
 *   • Mid-action      — `initiative > currentTick` (committed a Speed-N
 *                       action; riding out the ticks until it completes)
 *   • Acted this tick — `actedThisTick === true` (committed on this tick,
 *                       waiting for the GM to advance the wheel)
 *
 * Join Battle rolls Wits+Awareness and plants combatants at ticks 0..6
 * based on the gap from the winner. The wheel starts at tick 0 on
 * `startCombat`, so the JB winner is free first; the GM's Next Tick button
 * frees the rest in sequence.
 *
 * Committing an action (Finish Turn) sets
 *   initiative   = currentTick + speed
 *   actedThisTick = true
 * and clears the combatant's flurry / pendingAction flags. Speed 0 keeps
 * the combatant pinned to the current tick so they become free again on
 * the very next wheel advance — this is how Move-only characters act on
 * every tick.
 */
export class ExaltedCombat extends Combat {

  /** Current wheel position (GM-advanced). */
  get currentTick() {
    return this.getFlag("exalted2e", "currentTick") ?? 0;
  }

  /**
   * Sort order (ascending = highest-priority row first):
   *   1. unacted-this-tick ahead of acted-this-tick
   *   2. lower initiative ahead of higher
   *   3. higher Dex, higher Wits, name, id
   *
   * Keeping acted combatants at the bottom of the list means
   * `combat.combatant` (which Foundry derives from the first entry after
   * sort) always lands on a still-eligible combatant while any remain.
   */
  _sortCombatants(a, b) {
    return sortCombatants(a, b);
  }

  /**
   * Override Foundry's per-combatant Roll Initiative entry point so that
   * clicking the d20 on a combatant row, or the Roll All button, funnels
   * through our Join Battle logic (Wits + Awareness, store raw successes,
   * recompute every combatant's tick relative to the current max).
   *
   * @param {string|string[]} ids  One id, or an array of combatant ids.
   */
  async rollInitiative(ids, options = {}) {
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
    const idList = typeof ids === "string" ? [ids] : (Array.isArray(ids) ? ids : []);

    for (const id of idList) {
      const combatant = this.combatants.get(id);
      if (!combatant?.actor) continue;
      const pool = this._joinBattlePoolFor(combatant.actor);
      // Join Battle is Wits + Awareness (mental category). Going through
      // rollPool means any mental-category / universal penalties (and
      // wound) are honoured on the roll.
      const result = await ExaltedRoll.rollPool(combatant.actor, {
        pool,
        flavor:   game.i18n.localize("EX2E.JoinBattle"),
        category: "mental"
      });
      // Store both successes and the botch flag — `_recomputeTicks` forces
      // botchers onto tick 6 regardless of the usual max-theirs math.
      await combatant.update({
        "flags.exalted2e.joinBattleSuccesses": result.successes,
        "flags.exalted2e.joinBattleBotched":   !!result.botch
      });
    }

    await this._recomputeTicks();
    return this;
  }

  /**
   * Rebuild every rolled combatant's tick so the highest JB successes sits
   * at tick 0 and the rest fall at `max − theirs` ticks later. Called after
   * every Join Battle roll so late-arriving rolls adjust the standings.
   */
  async _recomputeTicks() {
    const entries = [];
    for (const c of this.combatants) {
      const s = c.getFlag("exalted2e", "joinBattleSuccesses");
      if (typeof s !== "number") continue;
      const botched = !!c.getFlag("exalted2e", "joinBattleBotched");
      entries.push({ id: c.id, successes: s, botched });
    }
    if (entries.length === 0) return;

    // Canonical wheel cap: botchers land on tick 6 regardless of the math;
    // everyone else lands at max-theirs, clamped to 6.
    const max = Math.max(...entries.map(e => e.successes));
    const updates = entries.map(({ id, successes, botched }) => ({
      _id:        id,
      initiative: computeTickFromJB(successes, botched, max)
    }));
    await this.updateEmbeddedDocuments("Combatant", updates);
  }

  /** Roll Join Battle for every combatant in this combat. */
  async rollJoinBattle() {
    const ids = this.combatants.map(c => c.id);
    return this.rollInitiative(ids);
  }

  /** Roll Join Battle only for combatants whose actor isn't player-owned. */
  async rollJoinBattleForNPCs() {
    const ids = this.combatants
      .filter(c => c.actor && !c.actor.hasPlayerOwner)
      .map(c => c.id);
    if (ids.length === 0) {
      ui.notifications.info(game.i18n.localize("EX2E.NoNPCsToRoll"));
      return this;
    }
    return this.rollInitiative(ids);
  }

  /**
   * Commit the current combatant's action into the wheel: push their
   * initiative to `currentTick + speed`, mark them as acted-this-tick, and
   * clear any declaration flags (flurry / pendingAction) tied to the
   * finished action. Does NOT advance the wheel — that's the GM's job via
   * `advanceWheel()`.
   *
   * Speed 0 keeps the combatant at the current tick so the next
   * `advanceWheel()` frees them again (how Move / 0-speed actions earn a
   * turn every tick).
   */
  async advanceCurrentByTicks(speed) {
    const current = this.combatant;
    if (!current) return;
    const safeSpeed = Math.max(0, Math.floor(Number(speed) || 0));

    // Sticky DV AEs (Aim, Guard, etc.) survive the prior abortable
    // action's own refresh but must clear at the end of whatever we
    // commit NEXT. Flip them to non-sticky here so the upcoming
    // `advanceWheel` refresh tears them down alongside the new action's
    // DV AE. Runs before the flurry/pending snapshots so we don't touch
    // the freshly-stamped abortable DV AE for THIS action.
    if (current.actor) {
      const stickies = current.actor.effects.filter(e =>
        e.flags?.exalted2e?.dvSticky === true
        && e.flags?.exalted2e?.dvRefreshable === true
      );
      for (const ae of stickies) {
        // Only flip AEs stamped by a PRIOR commit. The DV AE created as
        // part of the current declaration (the one whose id matches the
        // pendingAction we're about to snapshot) stays sticky — it's
        // the new abortable action's own penalty.
        const currentDvId = current.getFlag("exalted2e", "pendingAction")?.dvEffectId;
        if (ae.id === currentDvId) continue;
        await ae.update({ "flags.exalted2e.dvSticky": false });
      }
    }

    // Snapshot the action that's being committed so the Abort button has
    // something to read after the pendingAction / flurry declaration is
    // cleared. Flurries aren't abortable; single actions inherit their
    // `abortable` flag from EX2E.actions.
    const pending = current.getFlag("exalted2e", "pendingAction") ?? null;
    const flurry  = current.getFlag("exalted2e", "flurry")        ?? null;
    let committedAction = null;
    if (pending) {
      committedAction = {
        actionKey:   pending.actionKey ?? null,
        label:       pending.label     ?? "",
        speed:       safeSpeed,
        dvPenalty:   pending.dvPenalty ?? 0,
        dvEffectId:  pending.dvEffectId ?? null,
        abortable:   !!pending.abortable,
        aborted:     false
      };
    } else if (flurry) {
      committedAction = {
        actionKey: "flurry",
        label:     game.i18n.localize("EX2E.FlurryDeclared"),
        speed:     safeSpeed,
        dvPenalty: flurry.dvPenalty ?? 0,
        abortable: false,
        aborted:   false
      };
    }

    const updates = {
      initiative: this.currentTick + safeSpeed,
      "flags.exalted2e.actedThisTick": true
    };
    if (committedAction) {
      updates["flags.exalted2e.committedAction"] = committedAction;
    } else if (current.getFlag("exalted2e", "committedAction")) {
      updates["flags.exalted2e.-=committedAction"] = null;
    }
    if (current.getFlag("exalted2e", "flurry")) {
      updates["flags.exalted2e.-=flurry"] = null;
    }
    if (current.getFlag("exalted2e", "pendingAction")) {
      updates["flags.exalted2e.-=pendingAction"] = null;
    }

    // ── Multi-tick action commit dispatch ───────────────────────────────
    // Reads the active multi-tick action (single slot) and asks its
    // handler what to do — clear, apply abort penalty, or both. Aim's
    // handler covers the prior planCommitOnAim semantics; future
    // consumers (sorcery, clinch, warstrider) plug in via the registry.
    const { plan: mtPlan } = await planCommitOther(current, pending, flurry);
    if (mtPlan.clearAction) {
      updates["flags.exalted2e.-=multiTickAction"] = null;
    }
    if (mtPlan.applyAbortPenalty && current.actor) {
      await current.actor.applyInternalPenalty(2, {
        type:  "all",
        label: game.i18n.localize("EX2E.AimAbortedPenaltyLabel"),
        icon:  "icons/svg/ruins.svg"
      });
    }

    await current.update(updates);
    // `turn = 0` rehydrates `combat.combatant` to whoever is first in the
    // freshly-sorted list (next free-and-unacted combatant).
    await this.update({ turn: 0 });
  }

  /**
   * Advance the wheel by one tick (GM-only). Clears every combatant's
   * acted-this-tick flag and refreshes DV penalties on any combatant who
   * lands on the new tick (they just finished their Speed-N action and
   * their DV penalty window closes as their next action begins).
   */
  async advanceWheel() {
    if (!ex2eCan("combatFlow")) return;
    const oldTick = this.currentTick;
    const newTick = oldTick + 1;

    // House rule: any free-but-unacted combatant at wheel-advance time is
    // treated as having taken a 1-tick pass action. Bumps their initiative
    // to `oldTick + 1` so they stay aligned with the wheel instead of
    // falling behind. Move-only characters (who committed Move this tick)
    // have actedThisTick set, so they're skipped.
    const passUpdates = [];
    for (const c of this.combatants) {
      if (c.getFlag("exalted2e", "actedThisTick")) continue;
      const init = Number.isFinite(c.initiative) ? c.initiative : 0;
      if (init > oldTick) continue;
      passUpdates.push({ _id: c.id, initiative: oldTick + 1 });
    }
    if (passUpdates.length > 0) {
      await this.updateEmbeddedDocuments("Combatant", passUpdates);
    }

    await this.setFlag("exalted2e", "currentTick", newTick);

    // Batch-clear actedThisTick; unsetFlag-per-combatant would be slower.
    const clears = [];
    for (const c of this.combatants) {
      if (c.getFlag("exalted2e", "actedThisTick")) {
        clears.push({ _id: c.id, "flags.exalted2e.-=actedThisTick": null });
      }
    }
    if (clears.length > 0) {
      await this.updateEmbeddedDocuments("Combatant", clears);
    }

    // Multi-tick action dispatch: bump ticksElapsed (and cycleCount on
    // boundary), persist, then fire onComplete (boundary only) and
    // onTick (every tick) per active multi-tick action. Sequential per
    // combatant — handlers may write to flags / actor state / chat.
    for (const c of this.combatants) {
      if (c.getFlag("exalted2e", "multiTickAction")) {
        await dispatchTickAdvance(c, this);
      }
    }

    // Refresh DVs + clear committedAction for anyone whose committed
    // action lands exactly on the new tick — they're transitioning from
    // mid-action to free.
    for (const c of this.combatants) {
      if (c.initiative !== newTick) continue;
      if (c.actor) await this._refreshDVsFor(c.actor);
      if (c.getFlag("exalted2e", "committedAction")) {
        await c.unsetFlag("exalted2e", "committedAction");
      }
    }

    await this.update({ turn: 0 });
  }

  /**
   * Delete every dvRefreshable ActiveEffect on the given actor, except
   * those flagged as sticky (Aim / Guard etc.). Sticky AEs survive this
   * refresh — they're flipped to non-sticky at the combatant's NEXT
   * commit, so they clear on the action-after-the-abortable one.
   */
  async _refreshDVsFor(actor) {
    const toDelete = actor.effects
      .filter(e => e.flags?.exalted2e?.dvRefreshable === true
                && e.flags?.exalted2e?.dvSticky      !== true)
      .map(e => e.id);
    if (toDelete.length > 0) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    }
  }

  /**
   * Combat start seats the wheel at tick 0. The JB-0 combatant(s) are
   * immediately free; the rest wait for Next Tick. Also clears any stale
   * acted flags from a previous encounter on the same actors.
   */
  async startCombat() {
    const result = await super.startCombat();
    await this.setFlag("exalted2e", "currentTick", 0);
    const clears = [];
    for (const c of this.combatants) {
      if (c.getFlag("exalted2e", "actedThisTick")) {
        clears.push({ _id: c.id, "flags.exalted2e.-=actedThisTick": null });
      }
    }
    if (clears.length > 0) {
      await this.updateEmbeddedDocuments("Combatant", clears);
    }
    // Tick-0 combatants start with a clean DV slate.
    for (const c of this.combatants) {
      if (c.initiative === 0 && c.actor) {
        await this._refreshDVsFor(c.actor);
      }
    }
    return result;
  }

  /**
   * Override to clear per-scene social-attack state when combat ends.
   * Mirrors the End Scene button on the JoinBattlePanel — both routes
   * call `clearSocialScene` to wipe natural-drain counters and
   * unnatural-Limit-granted flags from every actor.
   */
  async endCombat() {
    const { clearSocialScene } = await import("../ui/social-scene.mjs");
    const { clearAllMultiTickActions } = await import("../combat/multi-tick.mjs");
    await clearSocialScene({ silent: true });
    await clearAllMultiTickActions(this);
    return super.endCombat();
  }

  /** Wits + Awareness for characters / combat.joinBattle for NPCs. */
  _joinBattlePoolFor(actor) {
    const s = actor.system ?? {};
    if (actor.type === "character") {
      return (s.attributes?.wits?.value ?? 0) + (s.abilities?.awareness?.value ?? 0);
    }
    if (actor.type === "npc") {
      return s.combat?.joinBattle ?? 0;
    }
    return 0;
  }
}
