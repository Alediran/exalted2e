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
    return { inRange: spaces <= maxSpaces, distance, spaces, maxRange: maxSpaces, band: null, rangePenalty: 0 };
  }

  if (distance > rangeVal) {
    return { inRange: false, distance, spaces, maxRange: rangeVal, band: null, rangePenalty: 0 };
  }

  // Determine range band from config table.
  const { EX2E } = game.exalted2e ?? {};
  const bands = EX2E?.rangeBands ?? [];
  for (const b of bands) {
    if (distance <= rangeVal * b.maxFraction) {
      return { inRange: true, distance, spaces, maxRange: rangeVal, band: b.key, rangePenalty: b.penalty };
    }
  }
  // Fallback: treat as long range.
  return { inRange: true, distance, spaces, maxRange: rangeVal, band: "long", rangePenalty: 2 };
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

function _buildAreaGfx(shape, pos, radiusPx) {
  const fill = 0xFF0000;
  const gfx  = new PIXI.Graphics();
  if (shape === "circle") {
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: fill, alpha: 0.2 });
    gfx.circle(0, 0, radiusPx);
    gfx.stroke({ color: fill, width: 2, alpha: 0.8 });
  } else if (shape === "cone") {
    const half = Math.PI / 6; // 60° cone = ±30°
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, radiusPx, Math.PI / 2 - half, Math.PI / 2 + half);
    gfx.lineTo(0, 0);
    gfx.fill({ color: fill, alpha: 0.2 });
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, radiusPx, Math.PI / 2 - half, Math.PI / 2 + half);
    gfx.lineTo(0, 0);
    gfx.stroke({ color: fill, width: 2, alpha: 0.8 });
  } else {
    gfx.rect(-radiusPx / 2, 0, radiusPx, radiusPx);
    gfx.fill({ color: fill, alpha: 0.2 });
    gfx.rect(-radiusPx / 2, 0, radiusPx, radiusPx);
    gfx.stroke({ color: fill, width: 2, alpha: 0.8 });
  }
  gfx.position.set(pos.x, pos.y);
  return gfx;
}

function _tokensInArea(shape, pos, radiusPx) {
  if (shape === "circle") {
    const geom = new PIXI.Circle(pos.x, pos.y, radiusPx);
    return canvas.tokens.placeables.filter(t => geom.contains(t.center.x, t.center.y));
  }
  if (shape === "cone") {
    const half = 30; // degrees
    return canvas.tokens.placeables.filter(t => {
      const dx = t.center.x - pos.x, dy = t.center.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) > radiusPx) return false;
      const deg  = Math.atan2(dy, dx) * (180 / Math.PI);
      const diff = ((deg - 90 + 540) % 360) - 180; // default direction: down
      return Math.abs(diff) <= half;
    });
  }
  const geom = new PIXI.Rectangle(pos.x - radiusPx / 2, pos.y, radiusPx, radiusPx);
  return canvas.tokens.placeables.filter(t => geom.contains(t.center.x, t.center.y));
}

/**
 * Interactively places an area-of-effect shape on the canvas and returns
 * the tokens inside it plus a Drawing ID for post-attack cleanup.
 *
 * Preview follows the mouse using a client-only PIXI.Graphics object.
 * On confirm a persistent Drawing is created on the scene so players see
 * where the attack landed; the Drawing is removed when the "Remove Template"
 * button on the chat card is clicked.
 *
 * @param {Actor} _actor  Reserved for future formula resolution.
 * @param {{ shape: string, size: string }} opts
 * @returns {Promise<{ targets: Actor[], drawingId: string|null } | null>}
 */
export async function placeAreaTemplate(_actor, { shape, size }) {
  const view = canvas?.app?.view;
  if (!view || !canvas?.ready) return null;

  const sizeVal  = parseFloat(size) || 3;
  const gs       = canvas.scene.grid.size;
  const radiusPx = sizeVal * gs;

  const toWorld = (clientX, clientY) => {
    const rect = view.getBoundingClientRect();
    const raw  = canvas.stage.worldTransform.applyInverse({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    return { x: Math.round(raw.x / gs) * gs, y: Math.round(raw.y / gs) * gs };
  };

  return new Promise((resolve) => {
    let previewObj  = null;
    let currentPos  = { x: 0, y: 0 };
    let rafId       = null;
    let drawPending = false;

    const drawPreview = (pos) => {
      if (previewObj) {
        previewObj.parent?.removeChild(previewObj);
        previewObj.destroy();
        previewObj = null;
      }
      previewObj = _buildAreaGfx(shape, pos, radiusPx);
      canvas.interface.addChild(previewObj);
      drawPending = false;
    };

    const cleanup = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      view.removeEventListener("mousemove",     onMove,    true);
      view.removeEventListener("mousedown",     onClick,   true);
      window.removeEventListener("contextmenu", onCancel,  true);
      window.removeEventListener("keydown",     onKeydown, true);
      if (previewObj) {
        previewObj.parent?.removeChild(previewObj);
        previewObj.destroy();
        previewObj = null;
      }
    };

    const onMove = (ev) => {
      currentPos = toWorld(ev.clientX, ev.clientY);
      if (drawPending) return;
      drawPending = true;
      rafId = requestAnimationFrame(() => { rafId = null; drawPreview(currentPos); });
    };

    const onCancel = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      cleanup(); resolve(null);
    };

    const onKeydown = (ev) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault(); ev.stopPropagation();
      cleanup(); resolve(null);
    };

    const onClick = async (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

      const finalPos = { ...currentPos };
      cleanup();

      let drawingId = null;
      try {
        const drawingData = _buildDrawingData(shape, finalPos, sizeVal, gs);
        const [created] = await canvas.scene.createEmbeddedDocuments("Drawing", [drawingData]);
        drawingId = created?.id ?? null;
      } catch { /* non-fatal — area attack proceeds without the persistent marker */ }

      const targets = _tokensInArea(shape, finalPos, radiusPx);
      resolve({
        targets:   targets.map(t => t.actor).filter(Boolean),
        drawingId,
      });
    };

    view.addEventListener("mousemove",     onMove,    true);
    view.addEventListener("mousedown",     onClick,   true);
    window.addEventListener("contextmenu", onCancel,  true);
    window.addEventListener("keydown",     onKeydown, true);

    const rect      = view.getBoundingClientRect();
    const centerRaw = canvas.stage.worldTransform.applyInverse({ x: rect.width / 2, y: rect.height / 2 });
    currentPos = { x: Math.round(centerRaw.x / gs) * gs, y: Math.round(centerRaw.y / gs) * gs };
    drawPreview(currentPos);
  });
}

function _buildDrawingData(shape, pos, sizeVal, gridSize) {
  const px   = sizeVal * gridSize;
  const base = {
    strokeColor: "#FF0000",
    strokeWidth: 2,
    strokeAlpha: 0.8,
    fillColor:   "#FF0000",
    fillAlpha:   0.2,
  };
  if (shape === "circle") {
    return { ...base, type: "e", x: pos.x - px, y: pos.y - px, width: px * 2, height: px * 2 };
  }
  if (shape === "cone") {
    const half = Math.tan(Math.PI / 6) * px;
    return {
      ...base, type: "p",
      x: pos.x, y: pos.y,
      points: [0, 0, half, px, -half, px],
    };
  }
  return { ...base, type: "r", x: pos.x - px / 2, y: pos.y, width: px, height: px };
}
