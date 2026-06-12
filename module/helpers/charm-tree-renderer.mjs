import { assignCoordinates, CARD_WIDTH, ROW_HEIGHT } from "./charm-tree-layout.mjs";

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Render charm cards into a content-sized canvas inside the scroll viewport.
 *
 * The canvas is sized to the tree's content and centred horizontally (CSS
 * `margin: 0 auto`) so the tree never pins to the left edge of a wider dialog;
 * when the tree is wider than the viewport the viewport simply scrolls. Nodes
 * are absolutely positioned within the canvas from the coordinate map.
 *
 * @param {HTMLElement} containerEl  — scroll viewport (.charm-tree-body, fills the dialog)
 * @param {{ tierMap: Map, maxTier: number }} treeData
 * @param {string} exaltType — used for CSS colour class
 * @param {Object} splatPipColor — EX2E.splatPipColor map
 * @param {Object} splatLightColor — EX2E.splatLightColor map
 * @returns {{ nodeEls: Map<string,HTMLElement>, canvas: HTMLElement }}
 *   nodeEls for connector measurement; canvas is the positioned content box the
 *   SVG overlay must be appended to and passed to drawConnectors.
 */
export function renderTree(containerEl, { nodes, edges, tierMap, maxTier }, exaltType, splatPipColor, splatLightColor) {
  containerEl.innerHTML = '';
  const nodeEls = new Map();
  const pipColor   = splatPipColor?.[exaltType]   ?? '#888';
  const lightColor = splatLightColor?.[exaltType] ?? 'transparent';

  const xMap = assignCoordinates({ edges, tierMap, maxTier }, {});

  // Content-sized, centred canvas — the positioned ancestor for the cards + SVG.
  const canvas = document.createElement('div');
  canvas.className = 'charm-tree-canvas';

  let maxX = 0;
  for (let tier = 0; tier <= maxTier; tier++) {
    for (const node of (tierMap.get(tier) ?? [])) {
      const el = node.isGhost
        ? _makeGhostNode(node)
        : node.isVirtual
          ? _makeVirtualNode(node, pipColor, lightColor)
          : _makeCharmCard(node, exaltType, splatPipColor, splatLightColor);
      el.dataset.nodeId = node.id;
      const x = xMap.get(node.id) ?? 0;
      el.style.position = 'absolute';
      el.style.left = `${x}px`;
      // Centre every node on its row's midline so variable-height cards in a
      // tier share one centreline — keeps same-tier connectors horizontal and
      // cross-tier vertical gaps uniform.
      el.style.top = `${tier * ROW_HEIGHT + ROW_HEIGHT / 2}px`;
      el.style.transform = 'translateY(-50%)';
      canvas.appendChild(el);
      nodeEls.set(node.id, el);
      if (x > maxX) maxX = x;
    }
  }

  canvas.style.width  = `${maxX + CARD_WIDTH}px`;
  canvas.style.height = `${(maxTier + 1) * ROW_HEIGHT}px`;
  containerEl.appendChild(canvas);
  return { nodeEls, canvas };
}

/**
 * Draw SVG connector lines after DOM layout.
 * svgEl must be position:absolute over containerEl.
 *
 * @param {SVGElement} svgEl
 * @param {HTMLElement} containerEl
 * @param {Array<{fromId,toId,skip}>} edges
 * @param {Map<string,HTMLElement>} nodeEls
 * @param {string} markerId — unique id prefix for arrowhead marker
 */
export function drawConnectors(svgEl, containerEl, edges, nodeEls) {
  // Clear previous
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  // SVG covers the full scrollable content area
  svgEl.setAttribute('width',  String(containerEl.scrollWidth));
  svgEl.setAttribute('height', String(containerEl.scrollHeight));

  const wr         = containerEl.getBoundingClientRect();
  const scrollLeft = containerEl.scrollLeft;
  const scrollTop  = containerEl.scrollTop;

  for (const { fromId, toId, skip, sameTier, minPurchases } of edges) {
    const fromEl = nodeEls.get(fromId);
    const toEl   = nodeEls.get(toId);
    if (!fromEl || !toEl) continue;

    const fRect = fromEl.getBoundingClientRect();
    const tRect = toEl.getBoundingClientRect();

    // getBoundingClientRect is viewport-relative; adjust to scroll-content-relative
    let x1, y1, x2, y2;
    if (sameTier) {
      // Same-tier edges: anchor on left/right sides at vertical centre
      const fCx = fRect.left + fRect.width / 2;
      const tCx = tRect.left + tRect.width / 2;
      if (fCx <= tCx) {
        x1 = fRect.right  - wr.left + scrollLeft;
        x2 = tRect.left   - wr.left + scrollLeft;
      } else {
        x1 = fRect.left   - wr.left + scrollLeft;
        x2 = tRect.right  - wr.left + scrollLeft;
      }
      y1 = fRect.top + fRect.height / 2 - wr.top + scrollTop;
      y2 = tRect.top + tRect.height / 2 - wr.top + scrollTop;
    } else {
      x1 = fRect.left + fRect.width  / 2 - wr.left + scrollLeft;
      y1 = fRect.bottom - wr.top + scrollTop;
      x2 = tRect.left + tRect.width  / 2 - wr.left + scrollLeft;
      y2 = tRect.top  - wr.top + scrollTop;
    }

    const attrs = {
      x1: String(x1), y1: String(y1),
      x2: String(x2), y2: String(y2),
      stroke: skip ? '#c84' : '#777',
      'stroke-width': '1.5',
    };
    if (skip) attrs['stroke-dasharray'] = '5,3';

    svgEl.appendChild(_svgEl('line', attrs));

    if ((minPurchases ?? 1) > 1) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const label = svgEl.appendChild(_svgEl('text', {
        x: String(Math.round(mx + 3)), y: String(Math.round(my - 3)),
        fill: '#c48', 'font-size': '10', 'font-weight': 'bold',
        'font-family': 'sans-serif',
      }));
      label.textContent = `×${minPurchases}`;
    }
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

function _makeVirtualNode(node, pipColor, lightColor) {
  const state = node.cardState ?? 'neutral';
  const el = document.createElement('div');
  el.className = `charm-tree-virtual-node charm-tree-virtual-node--${state}`;
  if (state === 'owned') {
    el.style.borderColor = pipColor ?? '#777';
    el.style.color       = pipColor ?? '#777';
    el.style.backgroundColor = lightColor ?? 'transparent';
  }
  el.textContent = node.virtualLabel ?? '';
  return el;
}

function _makeGhostNode(node) {
  const el = document.createElement('div');
  el.className = 'charm-tree-card charm-tree-card--ghost';
  el.title = `${node.ghostName} (${node.ghostAbility} tree — cross-tree prerequisite)`;
  const label = document.createElement('span');
  label.className = 'charm-tree-card__ghost-label';
  label.textContent = node.virtualLabel ?? '';
  el.appendChild(label);
  return el;
}

function _makeCharmCard(node, exaltType, splatPipColor, splatLightColor) {
  const charm = node.charm;
  const s = charm.system;
  const state = node.cardState ?? 'neutral';

  const pipColor   = splatPipColor?.[exaltType]   ?? '#888';
  const lightColor = splatLightColor?.[exaltType] ?? 'transparent';

  const el = document.createElement('div');
  el.className = `charm-tree-card charm-tree-card--${state}`;
  el.dataset.charmId  = charm.id;
  el.dataset.charmUid = s.charmUid ?? '';

  // Border + background by state
  if (state === 'owned') {
    el.style.borderColor     = '#000';
    el.style.backgroundColor = lightColor;
  } else if (state === 'purchasable' || state === 'available') {
    el.style.borderColor = pipColor;
  }

  // Essence pips row
  const essMax = 10;
  const essVal = Math.min(s.essence ?? 1, essMax);
  el.appendChild(_makePipRow(essVal, essMax, pipColor, 'essence'));

  // Charm name
  const nameEl = document.createElement('div');
  nameEl.className = 'charm-tree-card__name';
  nameEl.textContent = charm.name;
  if (state === 'owned') nameEl.style.color = '#000';
  else if (state === 'locked') nameEl.style.color = '#888';
  else if (state === 'purchasable' || state === 'available') nameEl.style.color = pipColor;
  el.appendChild(nameEl);

  // Ability pips row (not for infernal)
  if (exaltType !== 'infernal') {
    const abilMax = 10;
    const abilVal = Math.min(s.minAbility ?? 0, abilMax);
    el.appendChild(_makePipRow(abilVal, abilMax, '#c66', 'ability'));
  }

  // Multi-purchase pip track
  if (node.pipData) {
    el.appendChild(_makePurchasePipTrack(node.pipData, pipColor));
  }

  // Purchase button — visible only when the charm can be learned
  if (state === 'purchasable' || state === 'available') {
    const isRePurchase = node.pipData && node.pipData.current > 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'charm-tree-card__learn-btn';
    btn.dataset.action = 'learnCharm';
    btn.style.borderColor = pipColor;
    btn.style.color = pipColor;
    btn.textContent = isRePurchase
      ? game.i18n.localize('EX2E.CharmTree.LearnAgain')
      : game.i18n.localize('EX2E.CharmTree.Learn');
    el.appendChild(btn);
  }

  return el;
}

function _makePipRow(filled, total, color, type) {
  const row = document.createElement('div');
  row.className = `charm-tree-card__pips charm-tree-card__pips--${type}`;
  row.style.color = color;
  let text = '';
  for (let i = 0; i < total; i++) {
    text += i < filled ? '●' : '○';
  }
  row.textContent = text;
  return row;
}

function _makePurchasePipTrack({ current, max }, color) {
  const row = document.createElement('div');
  row.className = 'charm-tree-card__purchase-pips';
  row.style.color = color;
  let text = '';
  for (let i = 0; i < max; i++) text += i < current ? '●' : '○';
  row.textContent = text;
  return row;
}

function _svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
