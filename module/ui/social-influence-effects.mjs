/**
 * Marker AEs for social-influence keywords (Compel / Emotion / Illusion).
 *
 * These are not mechanically-enforced effects — they're flagged AEs that
 * tell the GM "this defender is currently under a Compel from <attacker>
 * via <charm>". Per-charm mechanical interpretation stays narrative.
 *
 * AEs are flagged `flags.exalted2e.socialInfluence: true` so the existing
 * scene cleanup (clearSocialScene) can sweep them up at combat-end.
 *
 * Lifecycle:
 *   - applySocialInfluenceEffects: stamps one AE per (keyword, sourceCharmId)
 *   - clearSocialInfluenceEffects: deletes specific AEs by id (used by Reverse)
 *   - clearAllSocialInfluenceEffectsForActor: deletes all flagged AEs on an
 *     actor (used by clearSocialScene)
 */

const KEYWORD_LABEL_KEYS = {
  Compel:   "EX2E.SocialInfluenceCompelEffect",
  Emotion:  "EX2E.SocialInfluenceEmotionEffect",
  Illusion: "EX2E.SocialInfluenceIllusionEffect"
};

const KEYWORD_ICON = {
  Compel:   "icons/svg/aura.svg",
  Emotion:  "icons/svg/sun.svg",
  Illusion: "icons/svg/eye.svg"
};

const HANDLED_KEYWORDS = Object.keys(KEYWORD_LABEL_KEYS);

/**
 * Stamp marker AEs on the defender, one per (keyword, sourceCharmId) pair.
 * Returns the created AE ids for later targeted cleanup (Reverse).
 *
 * @param {Actor} defender
 * @param {object} args
 * @param {string} args.attackerId
 * @param {Record<string,string>} args.sourceByKeyword - keyword -> charmId
 * @param {string[]} args.keywords - keywords to stamp (filtered to HANDLED_KEYWORDS)
 * @returns {Promise<string[]>} ids of created AEs
 */
export async function applySocialInfluenceEffects(defender, { attackerId, sourceByKeyword, keywords }) {
  if (!defender || !Array.isArray(keywords)) return [];
  const handled = keywords.filter(k => HANDLED_KEYWORDS.includes(k));
  if (handled.length === 0) return [];

  const attacker = game.actors?.get(attackerId);
  const toCreate = [];
  for (const keyword of handled) {
    const charmId   = sourceByKeyword?.[keyword];
    const charm     = charmId ? attacker?.items?.get(charmId) : null;
    const charmName = charm?.name ?? "?";
    const labelKey  = KEYWORD_LABEL_KEYS[keyword];
    toCreate.push({
      name: game.i18n.format("EX2E.SocialInfluenceMarkerSource", {
        keyword: game.i18n.localize(labelKey),
        charm:   charmName
      }),
      img:  charm?.img || KEYWORD_ICON[keyword] || "icons/svg/aura.svg",
      disabled: false,
      transfer: false,
      flags: {
        exalted2e: {
          socialInfluence: true,
          keyword,
          sourceCharmId: charmId ?? "",
          attackerId:    attackerId ?? ""
        }
      }
    });
  }

  const created = await defender.createEmbeddedDocuments("ActiveEffect", toCreate);
  return created.map(ae => ae.id);
}

/**
 * Delete specific marker AEs by id. Missing ids skipped silently.
 *
 * @param {Actor} defender
 * @param {string[]} effectIds
 */
export async function clearSocialInfluenceEffects(defender, effectIds) {
  if (!defender || !Array.isArray(effectIds) || effectIds.length === 0) return;
  const valid = effectIds.filter(id => defender.effects.has(id));
  if (valid.length === 0) return;
  await defender.deleteEmbeddedDocuments("ActiveEffect", valid);
}

/**
 * Delete all social-influence marker AEs on an actor. Called by
 * clearSocialScene at combat-end / End Scene / deleteCombat.
 *
 * @param {Actor} actor
 */
export async function clearAllSocialInfluenceEffectsForActor(actor) {
  if (!actor) return;
  const ids = actor.effects
    .filter(ae => ae.flags?.exalted2e?.socialInfluence === true)
    .map(ae => ae.id);
  if (ids.length === 0) return;
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
}
