/** Layout constants — match the .charm-tree-card width + cards-row gap in _charm-tree.css. */
export const CARD_WIDTH = 110;
export const H_GAP      = 16;
export const ROW_HEIGHT = 160;

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Spread nodes in a tier so they are at least `step` apart, preserving their
 * centroid (centre of mass). Nodes are shifted symmetrically outward so that
 * a parent positioned at the group centroid remains centred after resolve.
 */
function resolveSymmetric(tierNodes, x, step, orderIndex) {
  if (tierNodes.length < 2) return;

  // Sort by current x, breaking ties by original insertion order.
  const sorted = [...tierNodes].sort(
    (a, b) => (x.get(a.id) - x.get(b.id)) || (orderIndex.get(a.id) - orderIndex.get(b.id))
  );

  // Capture the centroid before spreading so we can restore it afterward.
  const centroidBefore = median(sorted.map(n => x.get(n.id)));

  // Forward pass: push rightward to enforce minimum spacing.
  for (let k = 1; k < sorted.length; k++) {
    const minX = x.get(sorted[k - 1].id) + step;
    if (x.get(sorted[k].id) < minX) x.set(sorted[k].id, minX);
  }

  // Shift all nodes so the centroid is preserved (spreads symmetrically).
  const centroidAfter = median(sorted.map(n => x.get(n.id)));
  if (centroidAfter != null && centroidBefore != null) {
    const shift = centroidBefore - centroidAfter;
    if (Math.abs(shift) > 1e-9) for (const n of sorted) x.set(n.id, x.get(n.id) + shift);
  }
}

/**
 * Assign each node an x-coordinate so parents are centred over their children
 * (and vice-versa), with no same-tier overlap. Pure + deterministic.
 * @returns {Map<string, number>} nodeId → x (min x normalised to 0)
 */
export function assignCoordinates({ edges, tierMap, maxTier }, { cardWidth = CARD_WIDTH, hGap = H_GAP, passes = 4 } = {}) {
  const step = cardWidth + hGap;

  const tierOf = new Map();
  for (let t = 0; t <= maxTier; t++) for (const n of (tierMap.get(t) ?? [])) tierOf.set(n.id, t);

  const parentsOf = new Map();
  const childrenOf = new Map();
  const sameTierPeers = new Map(); // id → Set<id> of same-tier neighbours
  for (const { fromId, toId } of edges) {
    const ft = tierOf.get(fromId);
    const tt = tierOf.get(toId);
    if (ft == null || tt == null) continue;
    if (ft === tt) {
      // Same-tier edge (Excellency row: feeding Excellencies → virtual node →
      // quasi-Excellencies). These don't drive the median passes; they bind the
      // nodes into a horizontal band handled after coordinate assignment.
      if (!sameTierPeers.has(fromId)) sameTierPeers.set(fromId, new Set());
      if (!sameTierPeers.has(toId)) sameTierPeers.set(toId, new Set());
      sameTierPeers.get(fromId).add(toId);
      sameTierPeers.get(toId).add(fromId);
      continue;
    }
    if (!parentsOf.has(toId)) parentsOf.set(toId, []);
    parentsOf.get(toId).push(fromId);
    if (!childrenOf.has(fromId)) childrenOf.set(fromId, []);
    childrenOf.get(fromId).push(toId);
  }

  const x = new Map();
  for (let t = 0; t <= maxTier; t++) (tierMap.get(t) ?? []).forEach((n, i) => x.set(n.id, i * step));

  const orderIndex = new Map();
  for (let t = 0; t <= maxTier; t++) (tierMap.get(t) ?? []).forEach((n, i) => orderIndex.set(n.id, i));

  // Isolated standalone nodes (no edges of any kind) are kept out of the
  // positioning + overlap passes so they can't drag anchored nodes off-centre
  // (a standalone in the Excellency row must not shift the Excellencies). They
  // are placed last, flanking their tier's anchored content.
  const isIsolated = (id) =>
    !(parentsOf.get(id)?.length) && !(childrenOf.get(id)?.length) && !(sameTierPeers.get(id)?.size);
  const isolatedSet = new Set();
  for (const id of x.keys()) if (isIsolated(id)) isolatedSet.add(id);

  const resolve = (t) => resolveSymmetric(tierMap.get(t) ?? [], x, step, orderIndex);
  const resolveAnchored = (t) =>
    resolveSymmetric((tierMap.get(t) ?? []).filter(n => !isolatedSet.has(n.id)), x, step, orderIndex);

  // Iterative refinement: alternate top-down and bottom-up sweeps.
  for (let p = 0; p < passes; p++) {
    if (p % 2 === 0) {
      // Top-down: centre each child at the median of its parents' positions.
      for (let t = 1; t <= maxTier; t++) {
        for (const n of (tierMap.get(t) ?? [])) {
          const m = median((parentsOf.get(n.id) ?? []).map(id => x.get(id)).filter(v => v != null));
          if (m != null) x.set(n.id, m);
        }
        resolveAnchored(t);
      }
    } else {
      // Bottom-up: centre each parent at the median of its children's positions.
      for (let t = maxTier - 1; t >= 0; t--) {
        for (const n of (tierMap.get(t) ?? [])) {
          const m = median((childrenOf.get(n.id) ?? []).map(id => x.get(id)).filter(v => v != null));
          if (m != null) x.set(n.id, m);
        }
        resolveAnchored(t);
      }
    }
  }

  // Same-tier clustering: pack each same-tier component (the Excellency row)
  // into a tight horizontal band centred on its hub — the member with the most
  // cross-tier connections, i.e. the virtual anyExcellency node, which the
  // median passes already centred over the whole subtree. The hub sits in the
  // middle of the band with its peers split half on each side (preserving their
  // left→right tier order), each one step apart, giving short straight
  // horizontal connectors instead of letting peers drift over their own subtrees.
  if (sameTierPeers.size) {
    const seen = new Set();
    const touchedTiers = new Set();
    const degree = (id) => (childrenOf.get(id)?.length ?? 0) + (parentsOf.get(id)?.length ?? 0);
    for (const startId of sameTierPeers.keys()) {
      if (seen.has(startId)) continue;
      const cluster = [];
      const stack = [startId];
      seen.add(startId);
      while (stack.length) {
        const id = stack.pop();
        cluster.push(id);
        for (const peer of (sameTierPeers.get(id) ?? [])) {
          if (!seen.has(peer)) { seen.add(peer); stack.push(peer); }
        }
      }
      if (cluster.length < 2) continue;
      cluster.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
      let hub = cluster[0];
      for (const id of cluster) {
        const better = degree(id) > degree(hub)
          || (degree(id) === degree(hub) && (orderIndex.get(id) ?? 0) < (orderIndex.get(hub) ?? 0));
        if (better) hub = id;
      }
      // Split peers evenly: first half left of the hub, second half right.
      const peers = cluster.filter(id => id !== hub);
      const leftCount = Math.floor(peers.length / 2);
      const ordered = [...peers.slice(0, leftCount), hub, ...peers.slice(leftCount)];
      const hubPos = leftCount;
      const hubX   = x.get(hub) ?? 0;
      ordered.forEach((id, i) => x.set(id, hubX + (i - hubPos) * step));
      touchedTiers.add(tierOf.get(hub));
    }
    for (const t of touchedTiers) resolveAnchored(t);
  }

  // Isolated standalone nodes (held out of the passes above) split evenly on
  // both sides of their tier's anchored content instead of clumping at one end
  // from their seed order — and without having shifted the anchored nodes.
  const isolatedTiers = new Set();
  for (let t = 0; t <= maxTier; t++) {
    const tn = tierMap.get(t) ?? [];
    const isolated = tn.filter(n => isolatedSet.has(n.id));
    const anchored = tn.filter(n => !isolatedSet.has(n.id));
    if (!isolated.length || !anchored.length) continue;
    isolated.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
    const minX = Math.min(...anchored.map(n => x.get(n.id) ?? 0));
    const maxX = Math.max(...anchored.map(n => x.get(n.id) ?? 0));
    const leftCount = Math.floor(isolated.length / 2);
    const left  = isolated.slice(0, leftCount);
    const right = isolated.slice(leftCount);
    left.forEach((n, i)  => x.set(n.id, minX - step * (left.length - i)));
    right.forEach((n, i) => x.set(n.id, maxX + step * (i + 1)));
    isolatedTiers.add(t);
  }
  for (const t of isolatedTiers) resolve(t);

  const min = Math.min(...x.values());
  if (Number.isFinite(min)) for (const k of x.keys()) x.set(k, x.get(k) - min);
  return x;
}
