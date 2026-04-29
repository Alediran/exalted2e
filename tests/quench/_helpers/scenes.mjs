import { register } from "./cleanup.mjs";

/**
 * Place a TokenDocument for the given Actor on the given Scene at known
 * pixel coordinates. The Scene should be the active fixture scene so that
 * `actor.getActiveTokens()[0]` returns the placed token (knockback reads
 * tokens via that path).
 *
 * Returns the TokenDocument; auto-registered for cleanup.
 */
export async function placeToken(actor, scene, { x = 0, y = 0, name } = {}) {
  const protoToken = await actor.getTokenDocument({ x, y, name: name ?? actor.name });
  const data = protoToken.toObject();
  // Link the token to the source actor so `combatant.actor` resolves to
  // the source (not a per-token synthetic with overlay data). Without
  // this, code paths split between `item.actor` (source) and
  // `combatant.actor` (synthetic) write to different documents — the
  // spend-on-source / refund-on-synthetic mismatch is silent in
  // production (both paths use the synthetic) but breaks tests that
  // attach items to the source actor.
  data.actorLink = true;
  const [doc] = await scene.createEmbeddedDocuments("Token", [data]);
  register(doc);
  return doc;
}
