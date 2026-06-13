import { describe, it, expect } from 'vitest';
import {
  matchesFilter,
  deduplicateCharms,
  buildTree,
  splitIntoBranches,
  getCharmState,
  getPipData,
} from '../../module/helpers/charm-tree-builder.mjs';

// ─── helpers ───────────────────────────────────────────────────────────────

function makeCharm({
  id = 'c1', charmUid = 'solar.melee.1', exaltType = 'solar',
  ability = 'melee', yoziPatron = '', essence = 2, minAbility = 3,
  prereqGroups = [], maxPurchases = '1', purchaseLevel = 1,
  purchaseXp = 0, name = 'Test Charm',
} = {}) {
  return {
    id,
    uuid: `Item.${id}`,
    name,
    img: 'icons/svg/aura.svg',
    type: 'charm',
    system: {
      charmUid, exaltType, ability, yoziPatron,
      essence, minAbility, prereqGroups,
      maxPurchases, purchaseLevel, purchaseXp,
    },
  };
}

function makeActor({
  essence = 3, purchaseLocked = false, abilities = {}, items = [],
} = {}) {
  const sys = { essence: { value: essence }, purchaseLocked, abilities };
  return {
    system: sys,
    items: items,
    getRollData() {
      const d = { ess: sys.essence.value, essence: sys.essence.value };
      for (const [k, ab] of Object.entries(sys.abilities)) d[k] = ab?.value ?? 0;
      return d;
    },
  };
}

// ─── matchesFilter ──────────────────────────────────────────────────────────

describe('matchesFilter', () => {
  it('matches solar/melee charm', () => {
    const c = makeCharm({ exaltType: 'solar', ability: 'melee' });
    expect(matchesFilter(c, 'solar', 'melee')).toBe(true);
  });

  it('rejects wrong exaltType', () => {
    const c = makeCharm({ exaltType: 'lunar', ability: 'melee' });
    expect(matchesFilter(c, 'solar', 'melee')).toBe(false);
  });

  it('rejects wrong ability', () => {
    const c = makeCharm({ exaltType: 'solar', ability: 'archery' });
    expect(matchesFilter(c, 'solar', 'melee')).toBe(false);
  });

  it('matches infernal by yoziPatron', () => {
    const c = makeCharm({ exaltType: 'infernal', yoziPatron: 'malfeas' });
    expect(matchesFilter(c, 'infernal', 'malfeas')).toBe(true);
  });

  it('rejects infernal with wrong patron', () => {
    const c = makeCharm({ exaltType: 'infernal', yoziPatron: 'adorjan' });
    expect(matchesFilter(c, 'infernal', 'malfeas')).toBe(false);
  });
});

// ─── deduplicateCharms ──────────────────────────────────────────────────────

describe('deduplicateCharms', () => {
  it('deduplicates same charmUid: world item wins over system pack', () => {
    const systemCharm = makeCharm({ id: 'sys1', charmUid: 'solar.melee.1', name: 'System Version' });
    const worldItem   = makeCharm({ id: 'wld1', charmUid: 'solar.melee.1', name: 'World Version' });
    // priority: 0 = system pack, 1 = world pack, 2 = world item
    const result = deduplicateCharms([
      { charm: systemCharm, priority: 0 },
      { charm: worldItem,   priority: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('World Version');
  });

  it('deduplicates: world pack wins over system pack', () => {
    const systemCharm = makeCharm({ id: 'sys1', charmUid: 'solar.melee.1', name: 'System' });
    const worldPack   = makeCharm({ id: 'wp1',  charmUid: 'solar.melee.1', name: 'World Pack' });
    const result = deduplicateCharms([
      { charm: systemCharm, priority: 0 },
      { charm: worldPack,   priority: 1 },
    ]);
    expect(result[0].name).toBe('World Pack');
  });

  it('keeps unique charmUids as separate entries', () => {
    const c1 = makeCharm({ id: 'c1', charmUid: 'solar.melee.1' });
    const c2 = makeCharm({ id: 'c2', charmUid: 'solar.melee.2' });
    const result = deduplicateCharms([
      { charm: c1, priority: 0 },
      { charm: c2, priority: 0 },
    ]);
    expect(result).toHaveLength(2);
  });

  it('ignores charms with empty charmUid — no dedup collision', () => {
    const c1 = makeCharm({ id: 'c1', charmUid: '' });
    const c2 = makeCharm({ id: 'c2', charmUid: '' });
    const result = deduplicateCharms([
      { charm: c1, priority: 0 },
      { charm: c2, priority: 0 },
    ]);
    expect(result).toHaveLength(2);
  });
});

// ─── buildTree ──────────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('assigns tier 0 to charms with no prerequisites', () => {
    const c = makeCharm({ charmUid: 'solar.melee.1', prereqGroups: [] });
    const { tierMap } = buildTree([c]);
    expect(tierMap.get(0)).toHaveLength(1);
    expect(tierMap.get(0)[0].charm.system.charmUid).toBe('solar.melee.1');
  });

  it('assigns tier 1 to charm with one tier-0 prereq', () => {
    const root = makeCharm({ id: 'r', charmUid: 'solar.melee.root', prereqGroups: [] });
    const child = makeCharm({
      id: 'ch', charmUid: 'solar.melee.child',
      prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'solar.melee.root' }] }],
    });
    const { tierMap } = buildTree([root, child]);
    expect(tierMap.get(0)).toHaveLength(1);
    expect(tierMap.get(1)).toHaveLength(1);
    expect(tierMap.get(1)[0].charm.system.charmUid).toBe('solar.melee.child');
  });

  it('linear chain: tier = position in chain', () => {
    const a = makeCharm({ id: 'a', charmUid: 'uid.a', prereqGroups: [] });
    const b = makeCharm({ id: 'b', charmUid: 'uid.b', prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'uid.a' }] }] });
    const c = makeCharm({ id: 'c', charmUid: 'uid.c', prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'uid.b' }] }] });
    const { tierMap } = buildTree([a, b, c]);
    expect(tierMap.get(0)[0].charm.system.charmUid).toBe('uid.a');
    expect(tierMap.get(1)[0].charm.system.charmUid).toBe('uid.b');
    expect(tierMap.get(2)[0].charm.system.charmUid).toBe('uid.c');
  });

  it('tier = longest path (branching tree)', () => {
    // a→c, b→c: c is at tier 1 (both parents at tier 0)
    const a = makeCharm({ id: 'a', charmUid: 'uid.a', prereqGroups: [] });
    const b = makeCharm({ id: 'b', charmUid: 'uid.b', prereqGroups: [] });
    const c = makeCharm({
      id: 'c', charmUid: 'uid.c',
      prereqGroups: [
        { alternatives: [{ type: 'charm', charmUid: 'uid.a' }] },
        { alternatives: [{ type: 'charm', charmUid: 'uid.b' }] },
      ],
    });
    const { tierMap } = buildTree([a, b, c]);
    expect(tierMap.get(0)).toHaveLength(2);
    expect(tierMap.get(1)).toHaveLength(1);
    expect(tierMap.get(1)[0].charm.system.charmUid).toBe('uid.c');
  });

  it('synthesizes virtual anyExcellency node at tier 0', () => {
    const c = makeCharm({
      id: 'c1', charmUid: 'solar.melee.1',
      prereqGroups: [{ alternatives: [{ type: 'anyExcellency', abilityKey: 'melee' }] }],
    });
    const { nodes, tierMap } = buildTree([c]);
    const tier0 = tierMap.get(0);
    expect(tier0.some(n => n.isVirtual)).toBe(true);
    const virtual = tier0.find(n => n.isVirtual);
    expect(virtual.virtualLabel).toMatch(/excellency/i);
  });

  it('places standalone charms (no parents, no children) in the Excellency row (tier 0)', () => {
    // A charm depending on anyExcellency synthesises a virtual node → an
    // Excellency row exists. A standalone charm (no prereqs, nothing depends on
    // it) would otherwise be floored to Math.max(essence, 2); it should instead
    // share tier 0 with the Excellencies.
    const dep = makeCharm({
      id: 'd', charmUid: 'solar.melee.dep', essence: 3,
      prereqGroups: [{ alternatives: [{ type: 'anyExcellency', abilityKey: 'melee' }] }],
    });
    const lone = makeCharm({ id: 'l', charmUid: 'solar.melee.lone', essence: 4, prereqGroups: [] });
    const { tierMap } = buildTree([dep, lone]);
    const tier0 = tierMap.get(0) ?? [];
    expect(tier0.some(n => n.charm?.system?.charmUid === 'solar.melee.lone')).toBe(true);
  });

  it('keeps a subtree root (no parents but has children) below the Excellency row', () => {
    // A root with its own children must NOT be pulled up to tier 0 just because
    // it lacks prerequisites — only truly isolated charms join the Excellency row.
    const dep = makeCharm({
      id: 'd', charmUid: 'solar.melee.dep', essence: 3,
      prereqGroups: [{ alternatives: [{ type: 'anyExcellency', abilityKey: 'melee' }] }],
    });
    const root = makeCharm({ id: 'r', charmUid: 'solar.melee.root', essence: 4, prereqGroups: [] });
    const child = makeCharm({
      id: 'ch', charmUid: 'solar.melee.child', essence: 4,
      prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'solar.melee.root' }] }],
    });
    const { nodes } = buildTree([dep, root, child]);
    expect(nodes.get('solar.melee.root').tier).toBeGreaterThan(0);
  });

  it('edges flag cross-tier skips correctly', () => {
    // a (tier 0) → c (tier 2) via skip; b (tier 0) → c via b→c (normal)
    const a = makeCharm({ id: 'a', charmUid: 'uid.a', prereqGroups: [] });
    const b = makeCharm({ id: 'b', charmUid: 'uid.b', prereqGroups: [] });
    const bChild = makeCharm({ id: 'bc', charmUid: 'uid.bc', prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'uid.b' }] }] });
    const c = makeCharm({
      id: 'c', charmUid: 'uid.c',
      prereqGroups: [
        { alternatives: [{ type: 'charm', charmUid: 'uid.a' }] },
        { alternatives: [{ type: 'charm', charmUid: 'uid.bc' }] },
      ],
    });
    const { edges } = buildTree([a, b, bChild, c]);
    const skipEdge = edges.find(e => e.fromId.includes('uid.a') && e.toId.includes('uid.c'));
    expect(skipEdge).toBeDefined();
    expect(skipEdge.skip).toBe(true);
    const normalEdge = edges.find(e => e.fromId.includes('uid.bc') && e.toId.includes('uid.c'));
    expect(normalEdge).toBeDefined();
    expect(normalEdge.skip).toBe(false);
  });
});

// ─── getCharmState ──────────────────────────────────────────────────────────

describe('getCharmState', () => {
  it('returns neutral when no actor', () => {
    const c = makeCharm();
    expect(getCharmState(c, null)).toBe('neutral');
  });

  it('returns owned when actor has charm at max purchaseLevel', () => {
    const c = makeCharm({ charmUid: 'uid.1', maxPurchases: '1' });
    const ownedItem = { type: 'charm', system: { charmUid: 'uid.1', purchaseLevel: 1 } };
    const actor = makeActor({ essence: 5, items: [ownedItem] });
    // prereqs empty → met
    expect(getCharmState(c, actor)).toBe('owned');
  });

  it('returns owned for multi-purchase when item count >= maxPurchases', () => {
    const c = makeCharm({ charmUid: 'uid.2', maxPurchases: '3', essence: 2, minAbility: 0 });
    const instances = Array.from({ length: 3 }, () =>
      ({ type: 'charm', system: { charmUid: 'uid.2', purchaseLevel: 1 } })
    );
    const actor = makeActor({ essence: 5, items: instances });
    expect(getCharmState(c, actor)).toBe('owned');
  });

  it('returns purchasable (not owned) for multi-purchase at partial item count', () => {
    const c = makeCharm({ charmUid: 'uid.3', maxPurchases: '3', essence: 2, minAbility: 0 });
    const instances = Array.from({ length: 2 }, () =>
      ({ type: 'charm', system: { charmUid: 'uid.3', purchaseLevel: 1 } })
    );
    const actor = makeActor({ essence: 5, purchaseLocked: true, items: instances });
    expect(getCharmState(c, actor)).toBe('purchasable');
  });

  it('returns purchasable when purchaseLocked=true and prereqs met', () => {
    const c = makeCharm({ charmUid: 'uid.4', essence: 2, minAbility: 0, prereqGroups: [] });
    const actor = makeActor({ essence: 5, purchaseLocked: true, items: [] });
    expect(getCharmState(c, actor)).toBe('purchasable');
  });

  it('returns available when purchaseLocked=false and prereqs met', () => {
    const c = makeCharm({ charmUid: 'uid.5', essence: 2, minAbility: 0, prereqGroups: [] });
    const actor = makeActor({ essence: 5, purchaseLocked: false, items: [] });
    expect(getCharmState(c, actor)).toBe('available');
  });

  it('returns locked when essence requirement not met', () => {
    const c = makeCharm({ charmUid: 'uid.6', essence: 5, minAbility: 0, prereqGroups: [] });
    const actor = makeActor({ essence: 2, items: [] });
    expect(getCharmState(c, actor)).toBe('locked');
  });

  it('returns locked when ability requirement not met', () => {
    const c = makeCharm({ charmUid: 'uid.ab', essence: 1, minAbility: 4, ability: 'melee' });
    const actor = makeActor({
      essence: 5,
      abilities: { melee: { value: 2 } },
      items: [],
    });
    expect(getCharmState(c, actor)).toBe('locked');
  });

  it('returns locked when charm prereqs not met', () => {
    const c = makeCharm({
      charmUid: 'uid.7', essence: 1, minAbility: 0,
      prereqGroups: [{ alternatives: [{ type: 'charm', charmUid: 'uid.prereq' }] }],
    });
    const actor = makeActor({ essence: 5, items: [] });
    expect(getCharmState(c, actor)).toBe('locked');
  });
});

// ─── getPipData ─────────────────────────────────────────────────────────────

describe('getPipData', () => {
  it('returns null when maxPurchases is 1', () => {
    const c = makeCharm({ maxPurchases: '1' });
    const ownedItem = { system: { charmUid: c.system.charmUid, purchaseLevel: 1 } };
    expect(getPipData(c, ownedItem)).toBeNull();
  });

  it('returns pip data for multi-purchase charm', () => {
    const c = makeCharm({ charmUid: 'uid.pip', maxPurchases: '3' });
    const ownedItem = { system: { charmUid: 'uid.pip', purchaseLevel: 2 } };
    const result = getPipData(c, ownedItem);
    expect(result).toEqual({ current: 2, max: 3 });
  });

  it('returns pip data with 0 current when not yet owned', () => {
    const c = makeCharm({ maxPurchases: '3' });
    expect(getPipData(c, null)).toEqual({ current: 0, max: 3 });
  });
});

describe('getCharmState — formula maxPurchases (@ess)', () => {
  it('returns owned when item count equals resolved @ess', () => {
    const c = makeCharm({ charmUid: 'uid.ess1', maxPurchases: '@ess', essence: 1, minAbility: 0 });
    const instances = Array.from({ length: 3 }, () =>
      ({ type: 'charm', system: { charmUid: 'uid.ess1', purchaseLevel: 1 } })
    );
    const actor = makeActor({ essence: 3, items: instances });
    expect(getCharmState(c, actor)).toBe('owned');
  });

  it('returns available when item count is below resolved @ess', () => {
    const c = makeCharm({ charmUid: 'uid.ess2', maxPurchases: '@ess', essence: 1, minAbility: 0 });
    const instances = Array.from({ length: 2 }, () =>
      ({ type: 'charm', system: { charmUid: 'uid.ess2', purchaseLevel: 1 } })
    );
    const actor = makeActor({ essence: 4, items: instances });
    expect(getCharmState(c, actor)).toBe('available');
  });
});

describe('getPipData — formula maxPurchases and actor item count', () => {
  it('returns null for single-purchase charm regardless of actor', () => {
    const c = makeCharm({ charmUid: 'uid.sp', maxPurchases: '1' });
    const actor = makeActor({ essence: 3, items: [] });
    expect(getPipData(c, null, actor)).toBeNull();
  });

  it('returns item-count current when actor provided', () => {
    const c = makeCharm({ charmUid: 'uid.pp', maxPurchases: '3' });
    const instances = [
      { type: 'charm', system: { charmUid: 'uid.pp', purchaseLevel: 1 } },
      { type: 'charm', system: { charmUid: 'uid.pp', purchaseLevel: 1 } },
    ];
    const actor = makeActor({ essence: 5, items: instances });
    expect(getPipData(c, instances[0], actor)).toEqual({ current: 2, max: 3 });
  });

  it('resolves @ess formula against actor for max', () => {
    const c = makeCharm({ charmUid: 'uid.ef', maxPurchases: '@ess' });
    const instances = [
      { type: 'charm', system: { charmUid: 'uid.ef', purchaseLevel: 1 } },
    ];
    const actor = makeActor({ essence: 4, items: instances });
    expect(getPipData(c, instances[0], actor)).toEqual({ current: 1, max: 4 });
  });

  it('falls back to purchaseLevel when no actor', () => {
    const c = makeCharm({ charmUid: 'uid.fb', maxPurchases: '3' });
    const ownedItem = { system: { charmUid: 'uid.fb', purchaseLevel: 2 } };
    expect(getPipData(c, ownedItem, null)).toEqual({ current: 2, max: 3 });
  });
});

// ─── buildTree — ghost nodes for cross-tree prereqs ─────────────────────────

function makeGhostCharm({ id, name, uid, ability = 'dexterity', essence = 1, prereqGroups = [], exaltType = 'alchemical' } = {}) {
  return {
    id,
    name,
    type: 'charm',
    system: { charmUid: uid, ability, essence, prereqGroups, exaltType, excellency: '', keywords: [], martialArtsStyleName: '' }
  };
}

function makePrereqGroup(charmUid, charmName = '') {
  return { alternatives: [{ type: 'charm', charmUid, charmName, abilityKey: '', virtueKey: '', virtueMin: 0 }] };
}

describe('buildTree — ghost nodes for cross-tree prereqs', () => {
  it('orphans a charm when cross-tree prereq UID absent and no externalUids provided', () => {
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main',
      prereqGroups: [makePrereqGroup('uid-ext')] });
    const { nodes } = buildTree([main], 'dexterity');
    expect(nodes.has('uid-main')).toBe(true);
    // No ghost node — uid-ext is simply missing from the tree
    expect([...nodes.values()].some(n => n.isGhost)).toBe(false);
  });

  it('creates a ghost node when externalUids contains the missing prereq UID', () => {
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main',
      prereqGroups: [makePrereqGroup('uid-ext', 'Ext Charm')] });
    const externalUids = new Map([
      ['uid-ext', { name: 'Aim-Calibrating Sensors', ability: 'perception' }]
    ]);
    const { nodes } = buildTree([main], 'dexterity', { externalUids });
    const ghost = [...nodes.values()].find(n => n.isGhost);
    expect(ghost).toBeDefined();
    expect(ghost.ghostUid).toBe('uid-ext');
    expect(ghost.ghostAbility).toBe('perception');
    expect(ghost.virtualLabel).toBe('↱ Aim-Calibrating Sensors');
  });

  it('dependent charm is wired to the ghost node (parentsOf edge)', () => {
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main',
      prereqGroups: [makePrereqGroup('uid-ext')] });
    const externalUids = new Map([['uid-ext', { name: 'Ext', ability: 'perception' }]]);
    const { edges } = buildTree([main], 'dexterity', { externalUids });
    const ghostId = 'ghost:uid-ext';
    const edge = edges.find(e => e.fromId === ghostId && e.toId === 'uid-main');
    expect(edge).toBeDefined();
  });

  it('ghost node is placed at tier 0 and the dependent charm at tier 1 (no virtual nodes)', () => {
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main', essence: 1,
      prereqGroups: [makePrereqGroup('uid-ext')] });
    const externalUids = new Map([['uid-ext', { name: 'Ext', ability: 'perception' }]]);
    const { nodes } = buildTree([main], 'dexterity', { externalUids });
    const ghost = [...nodes.values()].find(n => n.isGhost);
    expect(ghost.tier).toBe(0);
    expect(nodes.get('uid-main').tier).toBe(1);
  });

  it('ghost node is placed at tier 1 (below Excellencies) when virtual nodes exist', () => {
    // dep has anyExcellency prereq → synthesises a virtual node → hasVirtualNodes = true
    const dep = makeCharm({
      id: 'dep', charmUid: 'uid-dep', exaltType: 'alchemical', ability: 'dexterity',
      prereqGroups: [{ alternatives: [{ type: 'anyExcellency', abilityKey: 'dexterity' }] }],
    });
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main', essence: 1,
      prereqGroups: [makePrereqGroup('uid-ext')] });
    const externalUids = new Map([['uid-ext', { name: 'Ext', ability: 'perception' }]]);
    const { nodes } = buildTree([dep, main], 'dexterity', { externalUids });
    const ghost = [...nodes.values()].find(n => n.isGhost);
    expect(ghost.tier).toBe(1);
    expect(nodes.get('uid-main').tier).toBe(2);
  });

  it('deduplicates ghost nodes — two charms depending on the same external prereq share one ghost', () => {
    const a = makeGhostCharm({ id: 'a', name: 'A', uid: 'uid-a', prereqGroups: [makePrereqGroup('uid-ext')] });
    const b = makeGhostCharm({ id: 'b', name: 'B', uid: 'uid-b', prereqGroups: [makePrereqGroup('uid-ext')] });
    const externalUids = new Map([['uid-ext', { name: 'Ext', ability: 'perception' }]]);
    const { nodes } = buildTree([a, b], 'dexterity', { externalUids });
    const ghosts = [...nodes.values()].filter(n => n.isGhost);
    expect(ghosts).toHaveLength(1);
  });

  it('does not create a ghost when the prereq UID is already in the current tree', () => {
    const ext = makeGhostCharm({ id: 'e1', name: 'Ext', uid: 'uid-ext', ability: 'perception' });
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main',
      prereqGroups: [makePrereqGroup('uid-ext')] });
    const externalUids = new Map([['uid-ext', { name: 'Ext', ability: 'perception' }]]);
    // uid-ext is in the tree AND in externalUids — in-tree lookup wins, no ghost
    const { nodes } = buildTree([ext, main], 'dexterity', { externalUids });
    expect([...nodes.values()].some(n => n.isGhost)).toBe(false);
  });

  it('does not create a ghost when externalUids is provided but UID is absent from it', () => {
    const main = makeGhostCharm({ id: 'm1', name: 'Main', uid: 'uid-main',
      prereqGroups: [makePrereqGroup('uid-other')] });
    const externalUids = new Map([['uid-unrelated', { name: 'Unrelated', ability: 'strength' }]]);
    const { nodes } = buildTree([main], 'dexterity', { externalUids });
    expect([...nodes.values()].some(n => n.isGhost)).toBe(false);
  });
});

// ─── splitIntoBranches — ghost nodes do not merge branches ──────────────────

describe("splitIntoBranches — ghost nodes do not merge branches", () => {
  it("two subtrees sharing only a ghost prereq remain separate branches", () => {
    // Design: two internally-connected groups (A and B), each with 6 charms,
    // connected to each other only via a shared ghost node.
    // - Group A: a0 (root, needs ghost) + a1..a5 (all need a0) → 6 nodes, width-at-tier-1 = 5
    // - Group B: b0 (root, needs ghost) + b1..b5 (all need b0) → 6 nodes, width-at-tier-1 = 5
    // - Combined width at tier 1: 10 > 7 → width guard does NOT short-circuit
    // - Without fix: ghost in adj graph → bridges A+B → 1 component → 1 branch
    // - With fix: ghost is _special → excluded from adj → A and B disconnected →
    //   2 components of size 6 each (≥ 6 → not merged by <6 merge rule) → 2 branches
    const makeGroup = (prefix, ghostUid) => {
      const root = makeGhostCharm({ id: `${prefix}0`, name: `${prefix}Root`, uid: `uid-${prefix}0`,
        prereqGroups: [makePrereqGroup(ghostUid)] });
      const children = [1,2,3,4,5].map(i =>
        makeGhostCharm({ id: `${prefix}${i}`, name: `${prefix}${i}`, uid: `uid-${prefix}${i}`,
          prereqGroups: [makePrereqGroup(`uid-${prefix}0`)] })
      );
      return [root, ...children];
    };

    const groupA = makeGroup("a", "uid-ghost");
    const groupB = makeGroup("b", "uid-ghost");
    const externalUids = new Map([["uid-ghost", { name: "External Ghost", ability: "perception" }]]);
    const treeData = buildTree([...groupA, ...groupB], "dexterity", { externalUids });
    const branches = splitIntoBranches(treeData);
    // With the ghost fix: ghost excluded from adjacency → A and B disconnected →
    // 2 components of 6 each → neither < 6 → not merged → 2 branches.
    expect(branches.length).toBe(2);
  });
});
