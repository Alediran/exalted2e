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
export function buildTree(charms, groupKey = '') {
  const nodes = new Map();
  const edges = [];

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
            const vId  = `virtual:anyExcellency:${vKey}`;
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

  // Build adjacency: fromId → toId
  const childrenOf = new Map();
  const parentsOf  = new Map();

  for (const node of nodes.values()) {
    if (node.isVirtual) continue;
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
          }
        } else if (alt.type === 'anyExcellency') {
          // Excellency charms feed INTO the virtual node — skip the reverse edge to break cycles
          if (_isTierZeroExcellency(charm)) continue;
          const key      = alt.abilityKey || charm.system?.ability || '';
          const minCount = alt.minCount ?? 1;
          const vId      = `virtual:anyExcellency:${key}:${minCount}`;
          fromId = nodes.has(vId) ? vId : null;
        }
        if (!fromId) continue;

        if (!childrenOf.has(fromId)) childrenOf.set(fromId, []);
        childrenOf.get(fromId).push(node.id);
        if (!parentsOf.has(node.id)) parentsOf.set(node.id, []);
        parentsOf.get(node.id).push(fromId);
      }
    }
  }

  // Compute tiers via iterative longest-path (topological order).
  // Excellency charms and virtual nodes start at 0; everything else starts at its
  // essence requirement so Excellencies are the only tier-0 nodes.
  const tierOf = new Map();
  for (const [id, node] of nodes) {
    const floor = (node.isVirtual || _isTierZeroExcellency(node.charm) || node.isQuasiExcellency) ? 0 : (node.charm?.system?.essence ?? 1);
    tierOf.set(id, floor);
  }

  // Kahn's BFS by in-degree
  const inDegree = new Map();
  for (const id of nodes.keys()) inDegree.set(id, 0);
  for (const [fromId, children] of childrenOf) {
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
    for (const childId of (childrenOf.get(id) ?? [])) {
      const candidate = myTier + 1;
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

  // Build edges (skip = toTier - fromTier > 1)
  for (const [fromId, children] of childrenOf) {
    const fromTier = nodes.get(fromId)?.tier ?? 0;
    for (const toId of children) {
      const toTier = nodes.get(toId)?.tier ?? 0;
      edges.push({ fromId, toId, skip: (toTier - fromTier) > 1 });
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

  // Barycenter heuristic: reorder each tier by average parent-index to reduce edge crossings.
  // One top-down pass; tier 0 is the anchor (already sorted above).
  const tierIndex = new Map(); // nodeId → column index within its tier
  (tierMap.get(0) ?? []).forEach((n, i) => tierIndex.set(n.id, i));

  for (let t = 1; t <= maxTier; t++) {
    const tierNodes = tierMap.get(t);
    if (!tierNodes || tierNodes.length < 2) {
      (tierNodes ?? []).forEach((n, i) => tierIndex.set(n.id, i));
      continue;
    }

    const center = (tierIndex.size > 0 ? Math.max(...tierIndex.values()) : 0) / 2;
    const scored = tierNodes.map(node => {
      const parentIdxs = (parentsOf.get(node.id) ?? [])
        .filter(pid => nodes.has(pid) && nodes.get(pid).tier < t)
        .map(pid => tierIndex.get(pid) ?? 0);
      const score = parentIdxs.length
        ? parentIdxs.reduce((a, b) => a + b, 0) / parentIdxs.length
        : center;
      return { node, score };
    });

    scored.sort((a, b) => a.score - b.score);
    const sorted = scored.map(s => s.node);
    tierMap.set(t, sorted);
    sorted.forEach((n, i) => tierIndex.set(n.id, i));
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

function _isTierZeroExcellency(charm) {
  const exc = charm?.system?.excellency;
  return exc === 'first' || exc === 'second' || exc === 'third';
}

function _isQuasiExcellency(charm, groupKey) {
  if (!groupKey || _isTierZeroExcellency(charm)) return false;
  return charm?.name?.toLowerCase().includes(groupKey.toLowerCase()) ?? false;
}

function _capitalizeKey(key) {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
