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
  const pipColor   = splatPipColor?.[exaltType]   ?? '#888';
  const lightColor = splatLightColor?.[exaltType] ?? 'transparent';

  for (let tier = 0; tier <= maxTier; tier++) {
    const nodes = tierMap.get(tier) ?? [];
    if (!nodes.length) continue;

    const rowEl = document.createElement('div');
    rowEl.className = 'charm-tree-tier-row';
    rowEl.dataset.tier = String(tier);

    const virtualNodes = nodes.filter(n => n.isVirtual);
    const charmNodes   = nodes.filter(n => !n.isVirtual);

    if (virtualNodes.length) {
      const vRow = document.createElement('div');
      vRow.className = 'charm-tree-virtual-row';
      for (const node of virtualNodes) {
        const el = _makeVirtualNode(node, pipColor, lightColor);
        el.dataset.nodeId = node.id;
        vRow.appendChild(el);
        nodeEls.set(node.id, el);
      }
      rowEl.appendChild(vRow);
    }

    if (charmNodes.length) {
      const cRow = document.createElement('div');
      cRow.className = 'charm-tree-cards-row';
      for (const node of charmNodes) {
        const el = _makeCharmCard(node, exaltType, splatPipColor, splatLightColor);
        el.dataset.nodeId = node.id;
        cRow.appendChild(el);
        nodeEls.set(node.id, el);
      }
      rowEl.appendChild(cRow);
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
export function drawConnectors(svgEl, containerEl, edges, nodeEls) {
  // Clear previous
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const wr = containerEl.getBoundingClientRect();
  svgEl.setAttribute('width',  String(wr.width));
  svgEl.setAttribute('height', String(wr.height));

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

    const attrs = {
      x1: String(x1), y1: String(y1),
      x2: String(x2), y2: String(y2),
      stroke: skip ? '#c84' : '#777',
      'stroke-width': '1.5',
    };
    if (skip) attrs['stroke-dasharray'] = '5,3';

    svgEl.appendChild(_svgEl('line', attrs));
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

