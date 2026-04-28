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
  const [doc] = await scene.createEmbeddedDocuments("Token", [protoToken.toObject()]);
  register(doc);
  return doc;
}
