/**
 * ExaltedCombat — tick-based initiative for Exalted 2e.
 *
 * The `initiative` field on each Combatant stores that combatant's current
 * tick number. Lower ticks act first (sort ascending). When a combatant
 * finishes an action we add the action's Speed to their initiative, which
 * pushes them later in the turn order.
 *
 * Join Battle resolves at combat start: each combatant rolls Wits +
 * Awareness, whoever rolls the most successes acts on tick 0, and every
 * other combatant starts at `maxSuccesses - mySuccesses` ticks later.
 */
export class ExaltedCombat extends Combat {

  /**
   * Ascending initiative = lowest tick acts next.
   *
   * Canonical Exalted 2e same-tick tiebreaker: higher Dexterity acts first,
   * then higher Wits. NPCs without full attribute blocks fall through to 0
   * on both, which pushes them behind any statted character — a reasonable
   * default you can override by giving the NPC explicit Dex/Wits data.
   * Name and id provide a final stable order so renders don't jitter.
   */
  _sortCombatants(a, b) {
    const ai = Number.isFinite(a.initiative) ? a.initiative : Infinity;
    const bi = Number.isFinite(b.initiative) ? b.initiative : Infinity;
    if (ai !== bi) return ai - bi;

    const aDex = a.actor?.system?.attributes?.dexterity?.value ?? 0;
    const bDex = b.actor?.system?.attributes?.dexterity?.value ?? 0;
    if (aDex !== bDex) return bDex - aDex;                 // higher Dex wins

    const aWits = a.actor?.system?.attributes?.wits?.value ?? 0;
    const bWits = b.actor?.system?.attributes?.wits?.value ?? 0;
    if (aWits !== bWits) return bWits - aWits;             // higher Wits wins

    const byName = (a.name ?? "").localeCompare(b.name ?? "");
    if (byName !== 0) return byName;
    return (a.id ?? "").localeCompare(b.id ?? "");
  }

  /**
   * Roll Join Battle (Wits + Awareness) for every combatant in this combat,
   * then assign each combatant's initial tick as `maxSuccesses - mySuccesses`
   * so the winner acts on tick 0.
   */
  async rollJoinBattle() {
    const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");

    const rolls = [];
    for (const combatant of this.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;
      const pool = this._joinBattlePoolFor(actor);
      const roll = new ExaltedRoll({
        pool,
        flavor:    game.i18n.localize("EX2E.JoinBattle"),
        actorName: actor.name
      });
      const result = await roll.evaluate();
      await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
      rolls.push({ combatant, successes: result.successes });
    }
    if (rolls.length === 0) return;

    const maxSuccesses = Math.max(...rolls.map(r => r.successes));
    const updates = rolls.map(({ combatant, successes }) => ({
      _id:        combatant.id,
      initiative: maxSuccesses - successes
    }));
    await this.updateEmbeddedDocuments("Combatant", updates);
    await this.update({ turn: 0 });
  }

  /**
   * Advance the current combatant's tick by `speed` (the Speed of whatever
   * action they just performed), re-sort the tracker, and hand the turn to
   * whoever has the lowest tick now.
   */
  async advanceCurrentByTicks(speed) {
    const current = this.combatant;
    if (!current) return;
    const safeSpeed = Math.max(0, Math.floor(Number(speed) || 0));
    const newTick = (current.initiative ?? 0) + safeSpeed;
    await current.update({ initiative: newTick });
    // `turn` is an index into the sorted combatants array; whoever sits at
    // index 0 after the re-sort is the new active combatant.
    await this.update({ turn: 0 });
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
