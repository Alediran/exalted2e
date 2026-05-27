const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Render tier rows + charm cards into containerEl.
 * Returns a Map<nodeId, HTMLElement> for connector measurement.
 *
 * @param {HTMLElement} containerEl  — scrollable tree container (position:relative)
 * @param {{ tierMap: Map, maxTier: number }} treeData
 * @param {string} exaltType — used for CSS colour class
 * @param {Object} splatPipColor — EX2E.splatPipColor map
 * @param {Object} splatLightColor — EX2E.splatLightColor map
 */
export function renderTree(containerEl, { tierMap, maxTier }, exaltType, splatPipColor, splatLightColor) {
  containerEl.innerHTML = '';
  const nodeEls = new Map();

  for (let tier = 0; tier <= maxTier; tier++) {
    const nodes = tierMap.get(tier) ?? [];
    if (!nodes.length) continue;

    const rowEl = document.createElement('div');
    rowEl.className = 'charm-tree-tier-row';
    rowEl.dataset.tier = String(tier);

    for (const node of nodes) {
      if (node.isVirtual) {
        const el = _makeVirtualNode(node);
        el.dataset.nodeId = node.id;
        rowEl.appendChild(el);
        nodeEls.set(node.id, el);
      } else {
        const el = _makeCharmCard(node, exaltType, splatPipColor, splatLightColor);
        el.dataset.nodeId = node.id;
        rowEl.appendChild(el);
        nodeEls.set(node.id, el);
      }
    }

    containerEl.appendChild(rowEl);
  }

  return nodeEls;
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
export function drawConnectors(svgEl, containerEl, edges, nodeEls, markerId = 'arr') {
  // Clear previous
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const wr = containerEl.getBoundingClientRect();
  svgEl.setAttribute('width',  String(wr.width));
  svgEl.setAttribute('height', String(wr.height));

  // Defs: arrowhead markers for normal and skip lines
  const defs = _svgEl('defs', {});

  const normalMark = _makeArrowMarker(`${markerId}-normal`, '#777');
  const skipMark   = _makeArrowMarker(`${markerId}-skip`,   '#c84');
  defs.appendChild(normalMark);
  defs.appendChild(skipMark);
  svgEl.appendChild(defs);

  for (const { fromId, toId, skip } of edges) {
    const fromEl = nodeEls.get(fromId);
    const toEl   = nodeEls.get(toId);
    if (!fromEl || !toEl) continue;

    const fRect = fromEl.getBoundingClientRect();
    const tRect = toEl.getBoundingClientRect();

    const x1 = fRect.left + fRect.width  / 2 - wr.left;
    const y1 = fRect.bottom - wr.top;
    const x2 = tRect.left + tRect.width  / 2 - wr.left;
    const y2 = tRect.top  - wr.top;

    const color   = skip ? '#c84' : '#777';
    const dashArr = skip ? '5,3'  : null;
    const marker  = `url(#${skip ? `${markerId}-skip` : `${markerId}-normal`})`;

    const attrs = {
      x1: String(x1), y1: String(y1),
      x2: String(x2), y2: String(y2),
      stroke: color,
      'stroke-width': '1.5',
      'marker-end': marker,
    };
    if (dashArr) attrs['stroke-dasharray'] = dashArr;

    svgEl.appendChild(_svgEl('line', attrs));
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

function _makeVirtualNode(node) {
  const el = document.createElement('div');
  el.className = 'charm-tree-virtual-node';
  el.textContent = node.virtualLabel ?? '';
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
  } else if (state === 'locked') {
    el.style.opacity = '0.5';
  }

  // Essence pips row
  const essMax = 5;
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
    const abilMax = 5;
    const abilVal = Math.min(s.minAbility ?? 0, abilMax);
    el.appendChild(_makePipRow(abilVal, abilMax, '#c66', 'ability'));
  }

  // Multi-purchase pip track
  if (node.pipData) {
    el.appendChild(_makePurchasePipTrack(node.pipData, pipColor));
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

function _makeArrowMarker(id, color) {
  const marker = _svgEl('marker', {
    id, markerWidth: '8', markerHeight: '8', refX: '7', refY: '4', orient: 'auto',
  });
  marker.appendChild(_svgEl('polygon', { points: '0 0, 8 4, 0 8', fill: color }));
  return marker;
}
