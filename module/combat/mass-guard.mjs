import { EX2E } from "../config.mjs";

/**
 * Map selected tokens to the combatants they represent in the active combat.
 * Pure: reads only combat.combatants and token.actor.id. Dedupes by combatant
 * id (two tokens of one linked actor → one combatant). A token whose actor
 * maps to no combatant counts toward `skipped`.
 *
 * @param {object} combat  Active combat (needs `combatants` iterable of {id, actor}).
 * @param {Array}  tokens  Selected tokens/placeables (each may expose `actor`).
 * @returns {{ combatants: object[], skipped: number }}
 */
export function collectGuardTargets(combat, tokens) {
  const out = { combatants: [], skipped: 0 };
  if (!combat || !Array.isArray(tokens)) return out;
  const all  = combat.combatants ? Array.from(combat.combatants) : [];
  const seen = new Set();
  for (const token of tokens) {
    const actorId = token?.actor?.id;
    const match   = actorId ? all.find(c => c.actor?.id === actorId) : null;
    if (!match) { out.skipped++; continue; }
    if (seen.has(match.id)) continue;   // shared-actor tokens collapse to one
    seen.add(match.id);
    out.combatants.push(match);
  }
  return out;
}

/**
 * Stamp the standard Guard declaration on one combatant, matching the exact
 * `pendingAction` shape the single-Guard quickbar path produces so Finish Turn
 * consumes it identically. Guard's dvMod is 0, so no DV-penalty AE is created.
 * Any previously-declared action is cleared first (its DV AE deleted if present).
 *
 * @param {Combatant} combatant
 * @param {string}    label      Localized "Guard" label.
 */
async function stampGuard(combatant, label) {
  const g     = EX2E.actions.guard;
  const prior = combatant.flags?.exalted2e?.pendingAction;
  if (prior?.dvEffectId) {
    const eff = combatant.actor?.effects?.get(prior.dvEffectId);
    if (eff) await eff.delete();
  }
  if (prior) await combatant.unsetFlag("exalted2e", "pendingAction");
  await combatant.setFlag("exalted2e", "pendingAction", {
    actionKey: "guard",
    label,
    speed:     g.speed,
    dvPenalty: g.dvMod,
    abortable: !!g.abortable,
    dvEffectId: null,
  });
}

/**
 * Put every selected token's combatant (in the given combat) on Guard, post one
 * combined chat card, and warn once for any selected token not in the combat.
 *
 * @param {Combat} combat
 * @param {Array}  tokens  Selected tokens/placeables.
 * @returns {Promise<{ guarded: string[], skipped: number }>}
 */
export async function applyMassGuard(combat, tokens) {
  const { combatants, skipped } = collectGuardTargets(combat, tokens);
  const label = game.i18n.localize(EX2E.actions.guard.labelKey);

  for (const c of combatants) await stampGuard(c, label);

  const names = combatants.map(c => c.actor?.name ?? c.name);
  if (names.length) {
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/exalted2e/templates/chat/mass-guard-card.hbs",
      { names }
    );
    await ChatMessage.create({ content });
  }

  if (skipped > 0) {
    ui.notifications.warn(game.i18n.format("EX2E.MassGuardSkipped", { count: skipped }));
  }

  return { guarded: names, skipped };
}
