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
