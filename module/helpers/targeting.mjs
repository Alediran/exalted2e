/**
 * targeting.mjs — canvas-targeting helpers.
 *
 * When an attack is rolled with no pre-selected target, the caller asks the
 * attacker's user to click a token on the canvas. We take over canvas input
 * long enough to capture that click and return the chosen actor, restoring
 * normal input afterwards.
 */

/**
 * Resolve the best available actor for the current user.
 *
 * Priority: first controlled token on the canvas → user's assigned character.
 * Returns null if neither is available.
 *
 * Use this anywhere the UI needs "the actor this user is acting as" without
 * knowing in advance whether the user has a character assigned or a token
 * selected.
 *
 * @returns {Actor|null}
 */
export function resolveUserActor() {
  return game.canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

/**
 * Prompt the user to click a canvas token as an attack target. Resolves
 * with the target's Actor, or `null` if the user right-clicks / hits Esc
 * to cancel.
 *
 * During the prompt the cursor is replaced with a crosshair and canvas
 * input is captured — the first left-click that lands on a token returns
 * that token's actor and also marks it as the user's current target (so
 * the standard reticle is visible for the rest of the turn). Clicks on
 * empty space keep the picker active for another attempt.
 */
export async function pickTargetActor() {
  const view = canvas?.app?.view;
  if (!view) return null;

  ui.notifications.info(game.i18n.localize("EX2E.PickTargetPrompt"));
  document.body.classList.add("ex2e-picking-target");

  return new Promise((resolve) => {
    const cleanup = () => {
      document.body.classList.remove("ex2e-picking-target");
      view.removeEventListener("mousedown",  onMouseDown,  true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown",     onKeyDown,     true);
    };
    const finish = (actor) => { cleanup(); resolve(actor); };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      // Swallow the click so Foundry's own canvas handlers don't also fire.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Screen → world coordinates so we can hit-test against token bounds.
      const rect = view.getBoundingClientRect();
      const world = canvas.stage.worldTransform.applyInverse({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });

      const token = canvas.tokens.placeables.find(
        t => t.bounds?.contains(world.x, world.y)
      );
      if (!token?.actor) {
        ui.notifications.warn(game.i18n.localize("EX2E.PickTargetNoToken"));
        return;  // keep picking — user can click again
      }
      // Best-effort target reticle so the picked token stays visually flagged.
      try { token.setTarget(true, { releaseOthers: true }); } catch (_) { /* non-fatal */ }
      finish(token.actor);
    };

    const onContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };

    view.addEventListener("mousedown",  onMouseDown,  true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown",     onKeyDown,     true);
  });
}

/**
 * Resolve the placed Token for an actor on the current scene. Prefers the
 * token the actor is represented by in the active combat, otherwise the
 * first active token on any scene.
 */
function _tokenForActor(actor) {
  const combatant = game.combat?.combatants?.find(c => c.actorId === actor?.id);
  const linked    = combatant?.token?.object;
  if (linked) return linked;
  return actor?.getActiveTokens?.()[0] ?? null;
}

/**
 * Check whether the target is within the firing weapon-mode's reach.
 *
 * Melee (effectiveRange === 0): must be within 1 grid cell — or 2 if the
 * mode carries the "Reach" tag.
 * Ranged: straight-line scene distance must be ≤ `effectiveRange`. The
 * weapon's range value is assumed to be in the scene's configured units;
 * scenes authored in feet/yards just need the weapon's range to match.
 *
 * @returns {{inRange: boolean, distance: number, spaces: number, maxRange: number}}
 *          `null` if tokens aren't available (no scene / unplaced actors) —
 *          callers should treat null as "can't verify, allow through".
 */
export function checkAttackRange(mode, attackerActor, targetActor) {
  const attackerToken = _tokenForActor(attackerActor);
  const targetToken   = _tokenForActor(targetActor);
  if (!attackerToken || !targetToken) return null;

  const path = canvas.grid.measurePath([
    { x: attackerToken.center.x, y: attackerToken.center.y },
    { x: targetToken.center.x,   y: targetToken.center.y   }
  ]);
  const distance = path?.distance ?? 0;
  const spaces   = path?.spaces   ?? 0;

  const rangeVal = mode?.effectiveRange ?? mode?.range ?? 0;
  if (rangeVal === 0) {
    const hasReach = mode?.tags?.includes("Reach");
    const maxSpaces = hasReach ? 2 : 1;
    return { inRange: spaces <= maxSpaces, distance, spaces, maxRange: maxSpaces };
  }
  return { inRange: distance <= rangeVal, distance, spaces, maxRange: rangeVal };
}

/**
 * Whether any potentially-hostile token sits within `spaces` grid cells
 * of the given actor's placed token. Used by the Rise-from-Prone flow to
 * decide between auto-success and a Dex + Dodge roll.
 *
 * A token counts as a threat when its disposition is HOSTILE relative to
 * the actor's token — so a PC (friendly) scans for hostile NPCs, and an
 * enemy NPC (hostile) scans for friendly / neutral PCs. The actor's own
 * token is always excluded.
 *
 * Returns `false` if we can't resolve a token for the actor (unplaced /
 * no scene) — callers should treat that as "nothing nearby" and let the
 * action proceed unchallenged.
 *
 * @param {ExaltedActor} actor
 * @param {number}       [spaces=1]  Grid-cell reach for the check.
 * @returns {boolean}
 */
export function hasAdjacentEnemy(actor, spaces = 1) {
  const ownToken = _tokenForActor(actor);
  if (!ownToken) return false;

  const H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
  const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  const ownDisp = ownToken.document?.disposition ?? F;

  for (const other of (canvas.tokens?.placeables ?? [])) {
    if (other === ownToken) continue;
    if (!other.actor) continue;
    const disp = other.document?.disposition;
    // A token is "hostile relative to us" when the two dispositions are
    // on opposite sides (hostile vs friendly). Neutrals / secret tokens
    // are ignored — players shouldn't be forced into a roll by a passive
    // bystander.
    const isThreat = (ownDisp === F && disp === H)
                  || (ownDisp === H && disp === F);
    if (!isThreat) continue;
    const path = canvas.grid.measurePath([
      { x: ownToken.center.x, y: ownToken.center.y },
      { x: other.center.x,    y: other.center.y    }
    ]);
    if ((path?.spaces ?? Infinity) <= spaces) return true;
  }
  return false;
}
