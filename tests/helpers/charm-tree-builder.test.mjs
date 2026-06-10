import { describe, it, expect } from 'vitest';
import {
  matchesFilter,
  deduplicateCharms,
  buildTree,
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
  return {
    system: {
      essence: { value: essence },
      purchaseLocked,
      abilities,
    },
    items: { filter: (fn) => items.filter(fn) },
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

  it('returns owned for multi-purchase when purchaseLevel >= maxPurchases', () => {
    const c = makeCharm({ charmUid: 'uid.2', maxPurchases: '3', essence: 2, minAbility: 0 });
    const ownedItem = { type: 'charm', system: { charmUid: 'uid.2', purchaseLevel: 3 } };
    const actor = makeActor({ essence: 5, items: [ownedItem] });
    expect(getCharmState(c, actor)).toBe('owned');
  });

  it('returns purchasable (not owned) for multi-purchase at partial level', () => {
    const c = makeCharm({ charmUid: 'uid.3', maxPurchases: '3', essence: 2, minAbility: 0 });
    const ownedItem = { type: 'charm', system: { charmUid: 'uid.3', purchaseLevel: 2 } };
    const actor = makeActor({ essence: 5, purchaseLocked: true, items: [ownedItem] });
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
