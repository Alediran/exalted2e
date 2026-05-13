import { clearAllSocialInfluenceEffectsForActor } from "./social-influence-effects.mjs";

/**
 * Clear all per-scene social-attack state across every actor in the
 * world. Called by the End Scene button on the JoinBattlePanel and by
 * `ExaltedCombat.endCombat()` when combat ends.
 *
 * Specifically removes `flags.exalted2e.socialScene` from any actor
 * that has it set. The flag carries:
 *   - `<attackerId>.wpDrainedNatural` — natural-influence WP-drain counter
 *   - `<attackerId>.unnaturalLimitGranted` — once-per-scene Limit accrual lock
 *
 * Also sweeps social-influence marker AEs (Compel/Emotion/Illusion) flagged
 * `flags.exalted2e.socialInfluence: true` from every actor.
 *
 * Both reset on scene end.
 */
export async function clearSocialScene({ silent = false } = {}) {
  const dirty = game.actors.filter(a => a.flags?.exalted2e?.socialScene);
  for (const a of dirty) {
    await a.unsetFlag("exalted2e", "socialScene");
  }
  for (const a of game.actors) {
    await clearAllSocialInfluenceEffectsForActor(a);
  }
  if (!silent) {
    ui.notifications.info(game.i18n.localize("EX2E.SceneEndedToast"));
  }
}

export async function clearIntimacyAblation(actor) {
  if (!actor) return;
  const damaged = actor.items.filter(
    i => i.type === "intimacy" && (i.system?.ablationDamage ?? 0) > 0
  );
  if (!damaged.length) return;
  await actor.updateEmbeddedDocuments("Item",
    damaged.map(i => ({ _id: i.id, "system.ablationDamage": 0 }))
  );
}
