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

// rotation in radians, 0 = right/east. Circle, ring, and emanation ignore rotation.
function _buildAreaGfx(shape, pos, radiusPx, rotation = Math.PI / 2) {
  const color = 0xFF0000;
  const gfx   = new PIXI.Graphics();
  gfx.lineStyle(2, color, 0.8);
  gfx.beginFill(color, 0.2);
  if (shape === "circle" || shape === "emanation") {
    gfx.drawCircle(0, 0, radiusPx);
  } else if (shape === "ring") {
    gfx.drawCircle(0, 0, radiusPx);
    gfx.beginHole();
    gfx.drawCircle(0, 0, radiusPx * 0.5);
    gfx.endHole();
  } else if (shape === "cone") {
    // Draw pointing right (0°); gfx.rotation below handles the actual direction.
    const half = Math.PI / 6; // ±30° = 60° total
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, radiusPx, -half, half);
    gfx.lineTo(0, 0);
    gfx.closePath();
  } else if (shape === "ray") {
    gfx.drawRect(0, -radiusPx * 0.15, radiusPx, radiusPx * 0.3);
  } else {
    // Rectangle: extends right from origin, vertically centred.
    gfx.drawRect(0, -radiusPx / 2, radiusPx, radiusPx);
  }
  gfx.endFill();
  gfx.position.set(pos.x, pos.y);
  if (shape !== "circle" && shape !== "ring" && shape !== "emanation") gfx.rotation = rotation;
  return gfx;
}

// rotation in radians, 0 = right/east. Must match the angle passed to _buildAreaGfx.
function _tokensInArea(shape, pos, radiusPx, rotation = Math.PI / 2) {
  if (shape === "circle" || shape === "emanation") {
    const geom = new PIXI.Circle(pos.x, pos.y, radiusPx);
    return canvas.tokens.placeables.filter(t => geom.contains(t.center.x, t.center.y));
  }
  if (shape === "ring") {
    const inner = radiusPx * 0.5, outer = radiusPx;
    return canvas.tokens.placeables.filter(t => {
      const dx = t.center.x - pos.x, dy = t.center.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist >= inner && dist <= outer;
    });
  }
  if (shape === "cone") {
    return canvas.tokens.placeables.filter(t => {
      const dx = t.center.x - pos.x, dy = t.center.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) > radiusPx) return false;
      const tokenAngle = Math.atan2(dy, dx);
      const diff = tokenAngle - rotation;
      const diffNorm = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      return Math.abs(diffNorm) <= Math.PI / 6; // ±30°
    });
  }
  if (shape === "ray") {
    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);
    return canvas.tokens.placeables.filter(t => {
      const dx = t.center.x - pos.x;
      const dy = t.center.y - pos.y;
      const localX =  dx * cosR - dy * sinR;
      const localY =  dx * sinR + dy * cosR;
      return localX >= 0 && localX <= radiusPx && Math.abs(localY) <= radiusPx * 0.15;
    });
  }
  // Rectangle: extends from pos in rotation direction, radiusPx wide and tall, centred on perpendicular.
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);
  return canvas.tokens.placeables.filter(t => {
    const dx = t.center.x - pos.x;
    const dy = t.center.y - pos.y;
    const localX =  dx * cosR - dy * sinR;
    const localY =  dx * sinR + dy * cosR;
    return localX >= 0 && localX <= radiusPx && Math.abs(localY) <= radiusPx / 2;
  });
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
 * @returns {Promise<{ targets: Actor[], regionId: string|null } | null>}
 */
export async function placeAreaTemplate(_actor, { shape, size }) {
  const view = canvas?.app?.view;
  if (!view || !canvas?.ready) return null;

  const sizeVal       = parseFloat(size) || 3;
  const gs            = canvas.scene.grid.size;
  const radiusPx      = sizeVal * gs;
  const needsRotation = ["cone", "rect", "ray"].includes(shape);
  const autoAnchor    = (shape === "cone" || shape === "ray");

  const toWorld = (clientX, clientY) => {
    const rect = view.getBoundingClientRect();
    const raw  = canvas.stage.worldTransform.applyInverse({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    return { x: Math.round(raw.x / gs) * gs, y: Math.round(raw.y / gs) * gs };
  };

  const toWorldRaw = (clientX, clientY) => {
    const rect = view.getBoundingClientRect();
    return canvas.stage.worldTransform.applyInverse({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  // Cone and ray anchor origin to the attacker's token center automatically.
  let autoOrigin = null;
  if (autoAnchor) {
    const tok = _tokenForActor(_actor);
    if (tok) autoOrigin = { x: tok.center.x, y: tok.center.y };
  }

  return new Promise((resolve) => {
    let previewObj  = null;
    let currentPos  = { x: 0, y: 0 };
    let originPos   = autoOrigin ? { ...autoOrigin } : null;
    let currentRot  = Math.PI / 2;      // default: pointing down (π/2 rad = 90°)
    let rafId       = null;
    let drawPending = false;

    const drawPreview = (pos, rot) => {
      if (previewObj) {
        previewObj.parent?.removeChild(previewObj);
        previewObj.destroy();
        previewObj = null;
      }
      previewObj = _buildAreaGfx(shape, pos, radiusPx, rot);
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

    const schedulePreview = (pos, rot) => {
      if (drawPending) return;
      drawPending = true;
      rafId = requestAnimationFrame(() => { rafId = null; drawPreview(pos, rot); });
    };

    const onMove = (ev) => {
      if (originPos) {
        // Phase 2: use raw (unsnapped) coords for smooth rotation.
        const world = toWorldRaw(ev.clientX, ev.clientY);
        const dx = world.x - originPos.x, dy = world.y - originPos.y;
        if (dx !== 0 || dy !== 0) currentRot = Math.atan2(dy, dx);
        schedulePreview(originPos, currentRot);
      } else {
        currentPos = toWorld(ev.clientX, ev.clientY);
        schedulePreview(currentPos, currentRot);
      }
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

      if (needsRotation && !originPos) {
        // Phase 1 complete: lock origin and enter rotation mode.
        originPos = { ...currentPos };
        return;
      }

      // Final placement.
      const finalPos = originPos ?? { ...currentPos };
      const finalRot = currentRot;
      cleanup();

      let regionId = null;
      try {
        const regionData = _buildRegionData(shape, finalPos, sizeVal, gs, finalRot);
        const [created] = await canvas.scene.createEmbeddedDocuments("Region", [regionData]);
        regionId = created?.id ?? null;
      } catch { /* non-fatal — area attack proceeds without the persistent marker */ }

      const targets = _tokensInArea(shape, finalPos, radiusPx, finalRot);
      resolve({
        targets: targets.map(t => t.actor).filter(Boolean),
        regionId,
      });
    };

    view.addEventListener("mousemove",     onMove,    true);
    view.addEventListener("mousedown",     onClick,   true);
    window.addEventListener("contextmenu", onCancel,  true);
    window.addEventListener("keydown",     onKeydown, true);

    const rect      = view.getBoundingClientRect();
    const centerRaw = canvas.stage.worldTransform.applyInverse({ x: rect.width / 2, y: rect.height / 2 });
    currentPos = { x: Math.round(centerRaw.x / gs) * gs, y: Math.round(centerRaw.y / gs) * gs };
    drawPreview(originPos ?? currentPos, currentRot);
  });
}

// rotation in radians (converted to degrees for Foundry). Default: π/2 = 90° = down.
function _buildRegionData(shape, pos, sizeVal, gridSize, rotation = Math.PI / 2) {
  const px     = sizeVal * gridSize;
  const rotDeg = rotation * (180 / Math.PI);
  let regionShape;
  if (shape === "circle") {
    regionShape = { type: "circle", x: pos.x, y: pos.y, radius: px, gridBased: false };
  } else if (shape === "cone") {
    regionShape = {
      type: "cone",
      x: pos.x, y: pos.y,
      radius: px,
      angle: 60,
      rotation: rotDeg,
      curvature: "round",
      gridBased: false,
    };
  } else if (shape === "ring") {
    regionShape = {
      type: "ring",
      x: pos.x, y: pos.y,
      radius: px * 0.75,
      innerWidth: px * 0.25,
      outerWidth: px * 0.25,
      gridBased: false,
    };
  } else if (shape === "emanation") {
    regionShape = {
      type: "emanation",
      base: { type: "circle", x: pos.x, y: pos.y, radius: 0, gridBased: false },
      radius: px,
      gridBased: false,
    };
  } else if (shape === "ray") {
    regionShape = {
      type: "line",
      x: pos.x, y: pos.y,
      length: px,
      width: px * 0.3,
      rotation: rotDeg,
      gridBased: false,
    };
  } else {
    // anchorX:0, anchorY:0.5 → origin at left-centre; extends in rotation direction.
    regionShape = {
      type: "rectangle",
      x: pos.x, y: pos.y,
      width: px, height: px,
      anchorX: 0, anchorY: 0.5,
      rotation: rotDeg,
      gridBased: false,
    };
  }
  return {
    name:                game.i18n.localize("EX2E.AreaAttackRegion"),
    color:               "#FF0000",
    shapes:              [regionShape],
    elevation:           { bottom: null, top: null },
    behaviors:           [],
    visibility:          CONST.REGION_VISIBILITY.ALWAYS,
    highlightMode:       "coverage",
    displayMeasurements: true,
    locked:              false,
  };
}
