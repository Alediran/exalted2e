/**
 * targeting.mjs — canvas-targeting helpers.
 *
 * When an attack is rolled with no pre-selected target, the caller asks the
 * attacker's user to click a token on the canvas. We take over canvas input
 * long enough to capture that click and return the chosen actor, restoring
 * normal input afterwards.
 */

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
