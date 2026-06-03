/**
 * Resplendent Destiny helpers — wear/carry identity ActiveEffect lifecycle
 * and the auto-end pending guard (mirrors `_limitBreakPending`).
 */
export const _resplendentEndPending = new Set();

/** Stamp the worn-identity AE on the destiny's parent actor. */
export async function stampIdentityAE(item) {
  const actor = item.parent;
  if (!actor) return;
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name:     item.system.identity || item.name,
    img:      item.img ?? "icons/svg/mystery-man.svg",
    transfer: false,
    flags: { exalted2e: {
      resplendentIdentity: {
        destinyId:         item.id,
        identity:          item.system.identity,
        college:           item.system.college,
        disguiseBonus:     3,
        disbelievePenalty: 3,
        dvPenalty:         2,
      },
      gmOnlyRemoval: true
    } }
  }]);
}

/** Delete the identity AE for a specific destiny (or all, if destinyId omitted). */
export async function removeIdentityAE(actor, destinyId = null) {
  if (!actor) return;
  const aes = actor.effects.filter(e => {
    const ri = e.flags?.exalted2e?.resplendentIdentity;
    return ri && (destinyId === null || ri.destinyId === destinyId);
  });
  for (const ae of aes) await ae.delete();
}

/**
 * Delete stat-bonus AEs stamped by Resplendency activation. Resplendency powers
 * function only while the cover is worn, so these are torn down when the parent
 * destiny ends or the resplendency item is removed. Match on either the parent
 * destiny or the specific resplendency; both omitted clears all.
 */
export async function removeResplendencyEffects(actor, { destinyId = null, resplendencyId = null } = {}) {
  if (!actor) return;
  const aes = actor.effects.filter(e => {
    const re = e.flags?.exalted2e?.resplendencyEffect;
    if (!re) return false;
    if (destinyId !== null && re.destinyId !== destinyId) return false;
    if (resplendencyId !== null && re.resplendencyId !== resplendencyId) return false;
    return true;
  });
  for (const ae of aes) await ae.delete();
}
