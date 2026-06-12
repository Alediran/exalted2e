import { areCharmPrereqsMet, meetsMinAbility } from './charm-prereqs.mjs';

/**
 * Returns true if charm belongs to the given exaltType + groupKey combination.
 * groupKey is an ability key (solar/db/etc), attribute key (lunar/alchemical),
 * yoziPatron key (infernal), or MA style name (martialArts).
 */
export function matchesFilter(charm, exaltType, groupKey) {
  const s = charm.system;
  if (s.exaltType !== exaltType) return false;
  if (exaltType === 'infernal') return s.yoziPatron === groupKey;
  if (exaltType === 'martialarts') {
    return s.ability === 'martialarts' && s.martialArtsStyleName === groupKey;
  }
  return s.ability === groupKey;
}

/**
 * Takes an array of { charm, priority } objects (priority: 0=system, 1=worldPack, 2=worldItem).
 * Returns a deduplicated array of charm objects, highest priority wins per charmUid.
 * Charms with empty charmUid are always kept (no dedup).
 */
export function deduplicateCharms(entries) {
  const map = new Map();
  for (const { charm, priority } of entries) {
    const uid = charm.system?.charmUid;
    if (!uid) continue; // no uid → always keep, tracked separately below
    const existing = map.get(uid);
    if (!existing || priority > existing.priority) {
      map.set(uid, { charm, priority });
    }
  }
  const noUid = entries.filter(e => !e.charm.system?.charmUid).map(e => e.charm);
  return [...Array.from(map.values()).map(v => v.charm), ...noUid];
}

/**
 * Topological sort — assigns each charm a tier = longest prerequisite path from any root.
 * Synthesizes virtual anyExcellency nodes at tier 0.
 *
 * Returns:
 *   nodes:   Map<nodeId, TreeNode>
 *   edges:   Edge[]
 *   tierMap: Map<tier, TreeNode[]>
 *   maxTier: number
 *
 * TreeNode: { id, charm, tier, isVirtual, virtualLabel }
 * Edge:     { fromId, toId, skip: boolean }
 */
export function buildTree(charms, groupKey = '', { externalUids = null } = {}) {
  const nodes = new Map();
  const edges = [];
  // Tracks minPurchases per directed edge key "fromId:toId" for type:"charm" prereqs.
  const prereqMeta = new Map();

  // Index charms by charmUid for prereq resolution
  // Use charmUid as the node id when available so edges carry readable uid-based ids.
  const byUid = new Map();
  for (const charm of charms) {
    const uid = charm.system?.charmUid;
    const nodeId = uid || charm.id;
    if (uid) byUid.set(uid, charm);
    nodes.set(nodeId, { id: nodeId, charm, tier: 0, isVirtual: false, virtualLabel: '', isQuasiExcellency: _isQuasiExcellency(charm, groupKey) });
  }

  // Synthesize virtual anyExcellency nodes — keyed by "abilityKey:minCount"
  const countWords = ['', '', 'Two', 'Three', 'Four', 'Five'];
  const virtualNodes = new Map(); // `${abilityKey}:${minCount}` → virtual node id
  for (const charm of charms) {
    for (const group of (charm.system?.prereqGroups ?? [])) {
      for (const alt of (group.alternatives ?? [])) {
        if (alt.type === 'anyExcellency') {
          const key      = alt.abilityKey || charm.system?.ability || '';
          const minCount = alt.minCount ?? 1;
          const vKey     = `${key}:${minCount}`;
          if (!virtualNodes.has(vKey)) {
            const vId  = minCount > 1 ? `virtual:anyExcellency:${key}:${minCount}` : `virtual:anyExcellency:${key}`;
            const word = countWords[minCount] ?? String(minCount);
            const label = minCount > 1
              ? `(Any ${word} ${_capitalizeKey(key)} Excellencies)`
              : `(Any ${_capitalizeKey(key)} Excellency)`;
            nodes.set(vId, {
              id: vId, charm: null, tier: 0, isVirtual: true,
              virtualLabel: label, abilityKey: key, minCount,
            });
            virtualNodes.set(vKey, vId);
          }
        }
      }
    }
  }

  // Alchemical "Any … Augmentation" prereqs (type:"charm", charmUid:"") function exactly
  // like anyExcellency prereqs.  The pattern covers both single-attribute ("Any Strength
  // Augmentation") and attribute-group forms ("Any Physical Attribute Augmentation") — in
  // either case the charm is already scoped to its attribute by matchesFilter, so we create
  // the virtual node keyed to the charm's own ability rather than parsing the prereq text.
  for (const charm of charms) {
    if (charm.system?.exaltType !== 'alchemical') continue;
    const abilityKey = charm.system?.ability || '';
    if (!abilityKey) continue;
    for (const group of (charm.system?.prereqGroups ?? [])) {
      for (const alt of (group.alternatives ?? [])) {
        if (alt.type !== 'charm' || alt.charmUid) continue;
        if (!/\bAugmentation\b/i.test(alt.charmName ?? '')) continue;
        const vKey = `${abilityKey}:1`;
        if (!virtualNodes.has(vKey)) {
          const vId = `virtual:anyExcellency:${abilityKey}`;
          nodes.set(vId, {
            id: vId, charm: null, tier: 0, isVirtual: true,
            virtualLabel: `(Any ${_capitalizeKey(abilityKey)} Augmentation)`,
            abilityKey, minCount: 1,
          });
          virtualNodes.set(vKey, vId);
        }
      }
    }
  }

  // Name → nodeId fallback for prereqs with empty charmUid but a charmName set.
  // Covers specific named refs (e.g. "Personal Gravity Manipulation Apparatus") and
  // Alchemical charms that reference siblings by name rather than by UID.
  const byName = new Map();
  for (const [nodeId, node] of nodes) {
    if (!node.isVirtual && node.charm?.name) byName.set(node.charm.name, nodeId);
  }

  // Build adjacency: fromId → toId
  const childrenOf = new Map();
  const parentsOf  = new Map();

  for (const node of nodes.values()) {
    if (node.isVirtual || node.isGhost) continue;
    const charm = node.charm;

    // Excellency charms feed INTO their virtual anyExcellency node
    if (_isTierZeroExcellency(charm)) {
      const abilityKey = charm.system?.ability || '';
      for (const [vKey, vId] of virtualNodes) {
        if (vKey.startsWith(`${abilityKey}:`)) {
          if (!childrenOf.has(node.id)) childrenOf.set(node.id, []);
          if (!childrenOf.get(node.id).includes(vId)) {
            childrenOf.get(node.id).push(vId);
          }
          if (!parentsOf.has(vId)) parentsOf.set(vId, []);
          if (!parentsOf.get(vId).includes(node.id)) {
            parentsOf.get(vId).push(node.id);
          }
        }
      }
    }

    for (const group of (charm.system?.prereqGroups ?? [])) {
      for (const alt of (group.alternatives ?? [])) {
        let fromId = null;
        if (alt.type === 'charm') {
          const prereq = byUid.get(alt.charmUid);
          if (prereq) {
            fromId = prereq.system?.charmUid || prereq.id;
          } else if (alt.charmUid && externalUids?.has(alt.charmUid)) {
            // Cross-tree prereq: create a ghost node to anchor the dependent charm
            const ghostId = `ghost:${alt.charmUid}`;
            if (!nodes.has(ghostId)) {
              const ext = externalUids.get(alt.charmUid);
              nodes.set(ghostId, {
                id: ghostId,
                charm: null,
                tier: 0,
                isVirtual: false,
                isGhost: true,
                virtualLabel: `↱ ${ext.name}`,
                ghostUid: alt.charmUid,
                ghostName: ext.name,
                ghostAbility: ext.ability,
              });
            }
            fromId = ghostId;
          } else if (!alt.charmUid) {
            if (charm.system?.exaltType === 'alchemical' && /\bAugmentation\b/i.test(alt.charmName ?? '')) {
              // "Any … Augmentation" (single-attr or attr-group) → charm's own attribute virtual node
              const vId = `virtual:anyExcellency:${charm.system?.ability || ''}`;
              if (nodes.has(vId)) fromId = vId;
            } else if (alt.charmName) {
              // Name-based fallback for broken charmUid refs (e.g. specific charm names without a UID)
              fromId = byName.get(alt.charmName) ?? null;
            }
          }
        } else if (alt.type === 'anyExcellency') {
          // Excellency charms feed INTO the virtual node — skip the reverse edge to break cycles
          if (_isTierZeroExcellency(charm)) continue;
          const key      = alt.abilityKey || charm.system?.ability || '';
          const minCount = alt.minCount ?? 1;
          const vId      = minCount > 1 ? `virtual:anyExcellency:${key}:${minCount}` : `virtual:anyExcellency:${key}`;
          fromId = nodes.has(vId) ? vId : null;
        }
        if (!fromId) continue;

        if (!childrenOf.has(fromId)) childrenOf.set(fromId, []);
        childrenOf.get(fromId).push(node.id);
        if (!parentsOf.has(node.id)) parentsOf.set(node.id, []);
        parentsOf.get(node.id).push(fromId);
        if (alt.type === 'charm' && (alt.minPurchases ?? 1) > 1) {
          prereqMeta.set(`${fromId}:${node.id}`, alt.minPurchases);
        }
      }
    }
  }

  // Compute tiers via iterative longest-path (topological order).
  // When the tree has no virtual anyExcellency nodes (e.g. pure test chains with
  // no Excellency charms), orphaned roots get floor 0 so they head the chain at
  // tier 0. When virtual nodes ARE present (real trees with Excellencies), orphans
  // use Math.max(essence, 2) to stay below the tier-0/tier-1 excellency rows.
  const hasVirtualNodes = virtualNodes.size > 0;
  const tierOf = new Map();
  for (const [id, node] of nodes) {
    const hasPrereqs  = (parentsOf.get(id) ?? []).length > 0;
    const hasChildren = (childrenOf.get(id) ?? []).length > 0;
    // Standalone charms (no parents AND no children) share the Excellency row;
    // only subtree roots (no parents but with children) stay floored below it.
    const isStandalone = !hasPrereqs && !hasChildren;
    const floor = (node.isVirtual || node.isGhost || _isTierZeroExcellency(node.charm) || node.isQuasiExcellency || hasPrereqs || isStandalone)
      ? 0
      : hasVirtualNodes
        ? Math.max(node.charm?.system?.essence ?? 1, 2)
        : 0;
    tierOf.set(id, floor);
  }

  // Kahn's BFS by in-degree
  const inDegree = new Map();
  for (const id of nodes.keys()) inDegree.set(id, 0);
  for (const [, children] of childrenOf) {
    for (const toId of children) {
      inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1);
    }
  }
  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  while (queue.length > 0) {
    const id = queue.shift();
    const myTier = tierOf.get(id) ?? 0;
    const currentNode = nodes.get(id);
    for (const childId of (childrenOf.get(id) ?? [])) {
      const childNode = nodes.get(childId);
      // virtual→quasi edge: quasi-Excellencies sit in the same row as the virtual node
      const increment = (currentNode?.isVirtual && childNode?.isQuasiExcellency) ? 0 : 1;
      const candidate = myTier + increment;
      if (candidate > (tierOf.get(childId) ?? 0)) {
        tierOf.set(childId, candidate);
      }
      inDegree.set(childId, inDegree.get(childId) - 1);
      if (inDegree.get(childId) === 0) queue.push(childId);
    }
  }

  // Apply tiers to nodes
  for (const [id, tier] of tierOf) {
    if (nodes.has(id)) nodes.get(id).tier = tier;
  }

  // Snap quasi-Excellency nodes to the tier of their nearest virtual anyExcellency parent
  for (const node of nodes.values()) {
    if (!node.isQuasiExcellency) continue;
    let minVirtualTier = Infinity;
    for (const pid of (parentsOf.get(node.id) ?? [])) {
      const parent = nodes.get(pid);
      if (parent?.isVirtual && parent.tier < minVirtualTier) minVirtualTier = parent.tier;
    }
    if (minVirtualTier !== Infinity) node.tier = minVirtualTier;
  }

  // Build edges (skip = toTier - fromTier > 1; sameTier = tiers are equal)
  for (const [fromId, children] of childrenOf) {
    const fromTier = nodes.get(fromId)?.tier ?? 0;
    for (const toId of children) {
      const toTier  = nodes.get(toId)?.tier ?? 0;
      const diff    = toTier - fromTier;
      edges.push({ fromId, toId, skip: diff > 1, sameTier: diff === 0, minPurchases: prereqMeta.get(`${fromId}:${toId}`) ?? 1 });
    }
  }

  // Build tierMap
  const tierMap = new Map();
  let maxTier = 0;
  for (const node of nodes.values()) {
    const t = node.tier;
    if (t > maxTier) maxTier = t;
    if (!tierMap.has(t)) tierMap.set(t, []);
    tierMap.get(t).push(node);
  }

  // Sort tier 0: First → Second → Third Excellency, then everything else
  const _EXCL_ORDER = { first: 0, second: 1, third: 2 };
  const tier0 = tierMap.get(0);
  if (tier0) tier0.sort((a, b) => {
    const aO = _EXCL_ORDER[a.charm?.system?.excellency] ?? 99;
    const bO = _EXCL_ORDER[b.charm?.system?.excellency] ?? 99;
    return aO - bO;
  });

  // Barycenter heuristic: 3-pass alternating (top-down → bottom-up → top-down).
  // All index lookups are normalised to [0..1] then projected onto the target
  // tier's range so children remain proportionally positioned under their parents
  // even when tier widths differ (e.g. 9-node tier 2 → 16-node tier 4).
  const tierIndex = new Map(); // nodeId → column index within its tier
  (tierMap.get(0) ?? []).forEach((n, i) => tierIndex.set(n.id, i));

  for (let pass = 0; pass < 3; pass++) {
    if (pass % 2 === 0) {
      // Top-down: score each node by normalised average parent position
      for (let t = 1; t <= maxTier; t++) {
        const tierNodes = tierMap.get(t);
        if (!tierNodes || tierNodes.length < 2) {
          (tierNodes ?? []).forEach((n, i) => tierIndex.set(n.id, i));
          continue;
        }
        const tMax   = tierNodes.length - 1;
        const center = tMax / 2;
        const scored = tierNodes.map(node => {
          const parentPositions = (parentsOf.get(node.id) ?? [])
            .filter(pid => nodes.has(pid) && nodes.get(pid).tier < t)
            .map(pid => {
              const pLen = (tierMap.get(nodes.get(pid).tier) ?? []).length;
              const pIdx = tierIndex.get(pid) ?? 0;
              return pLen > 1 ? (pIdx / (pLen - 1)) * tMax : center;
            });
          const score = parentPositions.length
            ? parentPositions.reduce((a, b) => a + b, 0) / parentPositions.length
            : center;
          return { node, score };
        });
        scored.sort((a, b) => a.score - b.score);
        const sorted = scored.map(s => s.node);
        tierMap.set(t, sorted);
        sorted.forEach((n, i) => tierIndex.set(n.id, i));
      }
    } else {
      // Bottom-up: blend td-score with normalised average child position
      for (let t = maxTier - 1; t >= 1; t--) {
        const tierNodes = tierMap.get(t);
        if (!tierNodes || tierNodes.length < 2) continue;
        const belowNodes = tierMap.get(t + 1) ?? [];
        if (!belowNodes.length) continue;
        const tMax     = tierNodes.length - 1;
        const belowMax = belowNodes.length - 1;
        const belowIdx = new Map();
        belowNodes.forEach((n, i) => belowIdx.set(n.id, i));
        const scored = tierNodes.map(node => {
          const tdScore = tierIndex.get(node.id) ?? 0;
          const childPositions = (childrenOf.get(node.id) ?? [])
            .filter(cid => nodes.has(cid) && nodes.get(cid)?.tier === t + 1)
            .map(cid => {
              const cIdx = belowIdx.get(cid);
              return cIdx !== undefined && belowMax > 0 ? (cIdx / belowMax) * tMax : tdScore;
            });
          const buScore = childPositions.length
            ? childPositions.reduce((a, b) => a + b, 0) / childPositions.length
            : tdScore;
          return { node, score: (tdScore + buScore) / 2 };
        });
        scored.sort((a, b) => a.score - b.score);
        const sorted = scored.map(s => s.node);
        tierMap.set(t, sorted);
        sorted.forEach((n, i) => tierIndex.set(n.id, i));
      }
    }
  }

  return { nodes, edges, tierMap, maxTier };
}

/**
 * Returns: 'neutral' | 'owned' | 'purchasable' | 'available' | 'locked'
 * - neutral: no actor
 * - owned:   actor owns it at max purchaseLevel
 * - purchasable: prereqs met + actor.purchaseLocked = true
 * - available:   prereqs met + actor.purchaseLocked = false
 * - locked:  prerequisites not met
 */
export function getCharmState(charm, actor) {
  if (!actor) return 'neutral';

  const uid = charm.system?.charmUid;
  const ownedItem = uid
    ? actor.items.filter(i => i.type === 'charm' && i.system?.charmUid === uid)[0] ?? null
    : null;
  const maxPurch = parseInt(charm.system?.maxPurchases ?? '1', 10) || 1;
  const ownedLevel = ownedItem?.system?.purchaseLevel ?? 0;

  if (ownedItem && ownedLevel >= maxPurch) return 'owned';

  // Check essence
  const essenceVal = actor.system?.essence?.value ?? 0;
  if (essenceVal < (charm.system?.essence ?? 1)) return 'locked';

  // Check ability minimum
  if (!meetsMinAbility(charm, actor)) return 'locked';

  // Check charm prerequisites
  if (!areCharmPrereqsMet(charm, actor)) return 'locked';

  // Prereqs met
  return actor.system?.purchaseLocked ? 'purchasable' : 'available';
}

/**
 * Returns { current, max } for multi-purchase charms, or null for single-purchase.
 * ownedItem may be null (charm not yet owned).
 */
export function getPipData(charm, ownedItem) {
  const max = parseInt(charm.system?.maxPurchases ?? '1', 10) || 1;
  if (max <= 1) return null;
  const current = ownedItem?.system?.purchaseLevel ?? 0;
  return { current, max };
}

// ─── private ────────────────────────────────────────────────────────────────

/**
 * Returns the card state for a virtual anyExcellency node.
 * 'owned' = actor owns enough excellencies; 'locked' = not enough; 'neutral' = no actor.
 */
export function getVirtualNodeState(node, actor) {
  if (!actor) return 'neutral';
  const abilityKey = node.abilityKey ?? '';
  const minCount   = node.minCount   ?? 1;
  const owned = [...actor.items].filter(i =>
    i.type === 'charm' &&
    i.system?.excellency && i.system.excellency !== '' &&
    (i.system?.ability ?? '') === abilityKey
  ).length;
  return owned >= minCount ? 'owned' : 'locked';
}

/**
 * Splits a built tree into self-contained branches by detecting connected
 * components using only direct charm-to-charm edges (virtual/Excellency nodes
 * are excluded from the connectivity graph so they don't bridge all branches).
 * Each branch re-includes its relevant Excellency/virtual/quasi-Excellency nodes.
 * Returns an array of treeData objects { nodes, edges, tierMap, maxTier, label }.
 * If there is only one component, returns the original treeData as a single-element array.
 */
export function splitIntoBranches({ nodes, edges, tierMap, maxTier }) {
  const _special = (node) =>
    node.isVirtual || node.isGhost || node.isQuasiExcellency || _isTierZeroExcellency(node?.charm);

  // Undirected adjacency over non-special nodes only
  const adj = new Map();
  for (const [id, node] of nodes) {
    if (!_special(node)) adj.set(id, []);
  }
  for (const { fromId, toId } of edges) {
    if (adj.has(fromId) && adj.has(toId)) {
      adj.get(fromId).push(toId);
      adj.get(toId).push(fromId);
    }
  }

  // Supplement adjacency via prereqGroups scanning.
  // buildTree only creates edges when alt.charmUid matches system.charmUid (byUid lookup).
  // If that lookup failed (broken/mismatched ref), the edge is absent and the charm becomes
  // isolated. Here we also try matching alt.charmUid against the node's Foundry document id
  // so that stale references still connect the two nodes for splitting purposes.
  const docIdToNodeId = new Map();
  for (const [nodeId, node] of nodes) {
    if (_special(node) || !node.charm?.id) continue;
    docIdToNodeId.set(node.charm.id, nodeId);
  }
  for (const [nodeId, node] of nodes) {
    if (_special(node)) continue;
    for (const group of (node.charm?.system?.prereqGroups ?? [])) {
      for (const alt of (group.alternatives ?? [])) {
        if (alt.type !== 'charm') continue;
        // Try the document-id fallback when the charmUid lookup already produced an edge
        const prereqNodeId = adj.has(alt.charmUid)
          ? alt.charmUid
          : docIdToNodeId.get(alt.charmUid);
        if (prereqNodeId && prereqNodeId !== nodeId && adj.has(prereqNodeId)) {
          adj.get(nodeId).push(prereqNodeId);
          adj.get(prereqNodeId).push(nodeId);
        }
      }
    }
  }

  // BFS connected components
  const visited = new Set();
  const components = [];
  for (const id of adj.keys()) {
    if (visited.has(id)) continue;
    const comp = new Set();
    const queue = [id];
    while (queue.length) {
      const curr = queue.shift();
      if (visited.has(curr)) continue;
      visited.add(curr);
      comp.add(curr);
      for (const n of (adj.get(curr) ?? [])) {
        if (!visited.has(n)) queue.push(n);
      }
    }
    components.push(comp);
  }

  if (components.length <= 1) {
    return [{ nodes, edges, tierMap, maxTier, label: '' }];
  }

  // Precheck: if the widest charm-card tier fits comfortably on screen, don't split.
  // Dialog is 920px; each card is 110px + 16px gap = 126px → 7 cards = 882px (fits).
  // Count only non-special nodes since virtual/quasi-Excellency nodes live in a separate row.
  const _maxTierWidth = Math.max(...[...tierMap.values()].map(tier =>
    tier.filter(n => !_special(n)).length
  ));
  if (_maxTierWidth <= 7) {
    return [{ nodes, edges, tierMap, maxTier, label: '' }];
  }

  // Sort largest branch first
  components.sort((a, b) => b.size - a.size);

  // Merge small isolated components (< 6 non-special nodes) into the largest one.
  // These are typically charms whose only prerequisites are from a different ability
  // group (cross-ability prereqs not in the current loaded set), so they have no
  // edges and appear isolated. Merging keeps them visible in the main tree.
  for (let i = components.length - 1; i >= 1; i--) {
    if (components[i].size < 6) {
      for (const id of components[i]) components[0].add(id);
      components.splice(i, 1);
    }
  }

  return components.map(charmIds => {
    // Walk backwards through edges to pull in:
    //   1. Connected special nodes (Excellencies, virtual nodes) that are parents
    //   2. Quasi-Excellency children of virtual nodes already in the branch
    //   3. Regular charm prerequisites that were split into a different component
    //      (e.g. when the only path between two charms passes through a virtual node)
    const allIds = new Set(charmIds);
    // Seed every tier-zero Excellency in the tree — they anchor every branch.
    // This matters for Yozi trees where ALL anyExcellency charms are quasi-excellencies,
    // leaving no regular charm to pull the Excellency in via the backward pass.
    for (const [id, node] of nodes) {
      if (_isTierZeroExcellency(node?.charm)) allIds.add(id);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const { fromId, toId } of edges) {
        const fromNode = nodes.get(fromId);
        const toNode   = nodes.get(toId);
        if (!allIds.has(toId) || allIds.has(fromId) || !fromNode) continue;
        // Special parent, quasi-Excellency forward-link, or regular prerequisite charm
        if (_special(fromNode) || (!_special(toNode) && !_special(fromNode))) {
          allIds.add(fromId);
          changed = true;
        }
      }
      // Forward: virtual children of tier-zero Excellencies already in the branch.
      // Required when all children of a virtual node are quasi-excellencies (the backward
      // pass can never pull the virtual node in from a regular charm child in that case).
      for (const { fromId, toId } of edges) {
        const fromNode = nodes.get(fromId);
        const toNode   = nodes.get(toId);
        if (allIds.has(fromId) && !allIds.has(toId) && _isTierZeroExcellency(fromNode?.charm) && toNode?.isVirtual) {
          allIds.add(toId);
          changed = true;
        }
      }
      // Forward: quasi-Excellency children of virtual or quasi-Excellency nodes now in the branch
      // (handles chains like virtual → Instinctive Strength Unity → Impossible Strength Improvement)
      for (const { fromId, toId } of edges) {
        const fromNode = nodes.get(fromId);
        const toNode   = nodes.get(toId);
        if (allIds.has(fromId) && !allIds.has(toId) && (fromNode?.isVirtual || fromNode?.isQuasiExcellency) && toNode?.isQuasiExcellency) {
          allIds.add(toId);
          changed = true;
        }
      }
    }

    const compNodes = new Map([...nodes].filter(([id]) => allIds.has(id)));
    const compEdges = edges.filter(e => allIds.has(e.fromId) && allIds.has(e.toId));

    const compTierMap = new Map();
    let compMaxTier = 0;
    for (const [t, tierNodes] of tierMap) {
      const filtered = tierNodes.filter(n => allIds.has(n.id));
      if (filtered.length) {
        compTierMap.set(t, filtered);
        if (t > compMaxTier) compMaxTier = t;
      }
    }

    // Label: name of the lowest-tier non-special charm
    let label = '';
    for (let t = 0; t <= compMaxTier && !label; t++) {
      for (const n of (compTierMap.get(t) ?? [])) {
        if (!_special(n)) { label = n.charm?.name ?? ''; break; }
      }
    }

    return { nodes: compNodes, edges: compEdges, tierMap: compTierMap, maxTier: compMaxTier, label };
  });
}

function _isTierZeroExcellency(charm) {
  const exc = charm?.system?.excellency;
  if (exc === 'first' || exc === 'second' || exc === 'third') return true;
  // Alchemical Fourth/Fifth/Sixth Augmentations have no excellency marker but belong at tier 0.
  // Detected by name since adding excellency fields to 27 source files would be large churn.
  return charm?.system?.exaltType === 'alchemical'
    && /^(fourth|fifth|sixth)\s+\w+\s+augmentation\b/i.test(charm?.name ?? '');
}

// Yozi groupKeys are camelCase (e.g. "theEbonDragon") but charm names use natural language.
// Map camelCase keys that need translation to the name fragment used in charm names.
const _YOZI_NAME_FRAGMENTS = {
  ebonDragon:           'The Ebon Dragon',
  sheWhoLivesInHerName: 'She Who Lives In Her Name',
};

function _isQuasiExcellency(charm, groupKey) {
  if (!groupKey || _isTierZeroExcellency(charm)) return false;
  // Require the ability/attribute/yozi word to appear in a known quasi-excellency slot:
  // leading ("Ride Essence Flow", "Malfeas Inevitability Technique"),
  // after "Infinite" ("Infinite Ride Mastery"),
  // after "of" ("Supreme Perfection of Ride"), after "Instinctive" ("Instinctive Strength Unity"),
  // after "Flawless" ("Flawless Dexterity Focus"), after "Impossible" ("Impossible Strength Improvement"),
  // after "Effortless" ("Effortless Malfeas Dominance"), after "So Speaks" ("So Speaks Malfeas"),
  // after "Terrestrial" ("Terrestrial Melee Reinforcement"), after "Fateful" ("Fateful Archery Excellency"),
  // or after "Propitious" ("Propitious Archery Alignment").
  // Mid-name occurrences like "Last Ride Glory" are excluded.
  // Multi-word Yozi keys are translated via _YOZI_NAME_FRAGMENTS; spaces become \s+.
  const nameKey = (_YOZI_NAME_FRAGMENTS[groupKey] ?? groupKey).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|\\bInfinite\\s+|\\bof\\s+|\\bInstinctive\\s+|\\bFlawless\\s+|\\bImpossible\\s+|\\bEffortless\\s+|\\bSo\\s+Speaks\\s+|\\bTerrestrial\\s+|\\bFateful\\s+|\\bPropitious\\s+)${nameKey}\\b(?!-)`, 'i').test(charm?.name ?? '');
}

function _capitalizeKey(key) {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
