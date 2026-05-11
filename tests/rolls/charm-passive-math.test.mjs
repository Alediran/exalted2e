import { describe, it, expect } from "vitest";
import {
  computeHealthGrantBonus,
  computeMotePoolBonus,
  computeSoakBonus,
  computeWoundReduction,
  aggregateCharmDVBonus,
  applyStatBoostDeltas,
  isCharmPassivelyActive,
} from "../../module/rolls/charm-passive-math.mjs";

// ── computeHealthGrantBonus ──────────────────────────────────────────
describe("computeHealthGrantBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeHealthGrantBonus([])).toEqual({ zero: 0, one: 0, two: 0 });
  });
  it("sums options from one charm (Ox-Body style)", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      options: [{ zero: 1, one: 0, two: 2, dying: 0 }]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 2 });
  });
  it("sums multiple charms", () => {
    const items = [
      { system: { healthGrant: { enabled: true, options: [{ zero: 0, one: 0, two: 3, dying: 0 }] }}},
      { system: { healthGrant: { enabled: true, options: [{ zero: 1, one: 0, two: 0, dying: 0 }] }}}
    ];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 3 });
  });
  it("skips disabled charms", () => {
    const items = [{ system: { healthGrant: {
      enabled: false,
      options: [{ zero: 1, one: 1, two: 1, dying: 0 }]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 0, one: 0, two: 0 });
  });
  it("multi-option charm: uses only the selected option (default index 0)", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 0,
      options: [
        { zero: 0, one: 0, two: 2, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 0, one: 0, two: 2 });
  });
  it("multi-option charm: selectedOption 1 picks the second option", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 1,
      options: [
        { zero: 0, one: 0, two: 2, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 0 });
  });
  it("multi-option charm: out-of-bounds selectedOption clamps to last valid index", () => {
    const items = [{ system: { healthGrant: {
      enabled: true,
      selectedOption: 99,
      options: [
        { zero: 0, one: 2, two: 0, dying: 0 },
        { zero: 1, one: 0, two: 0, dying: 0 }
      ]
    }}}];
    expect(computeHealthGrantBonus(items)).toEqual({ zero: 1, one: 0, two: 0 });
  });
});

// ── computeMotePoolBonus ─────────────────────────────────────────────
describe("computeMotePoolBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeMotePoolBonus([])).toEqual({ personal: 0, peripheral: 0 });
  });
  it("adds peripheral bonus", () => {
    const items = [{ system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 0, peripheral: 10 });
  });
  it("adds personal bonus", () => {
    const items = [{ system: { motePoolBonus: { enabled: true, pool: "personal", amount: 5 }}}];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 5, peripheral: 0 });
  });
  it("stacks multiple charms", () => {
    const items = [
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}},
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}
    ];
    expect(computeMotePoolBonus(items)).toEqual({ personal: 0, peripheral: 20 });
  });
});

// ── computeSoakBonus ─────────────────────────────────────────────────
describe("computeSoakBonus", () => {
  it("returns zeros when entries is empty", () => {
    expect(computeSoakBonus([])).toEqual(
      { bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 }
    );
  });
  it("sums bashing/lethal/aggravated across entries", () => {
    const entries = [
      { bashing: 3, lethal: 3, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 },
      { bashing: 1, lethal: 0, aggravated: 0, hardnessAdd: 2, hardnessSetTo: 0 }
    ];
    expect(computeSoakBonus(entries)).toEqual(
      { bashing: 4, lethal: 3, aggravated: 0, hardnessAdd: 2, hardnessSetTo: 0 }
    );
  });
  it("takes the max hardnessSetTo across entries (not sum)", () => {
    const entries = [
      { bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 5 },
      { bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 3 }
    ];
    expect(computeSoakBonus(entries).hardnessSetTo).toBe(5);
  });
});

// ── computeWoundReduction ────────────────────────────────────────────
describe("computeWoundReduction", () => {
  it("returns base penalty unchanged when no charms", () => {
    expect(computeWoundReduction([], -2)).toBe(-2);
  });
  it("formula='' negates all wound penalties", () => {
    const items = [{ system: { woundReduction: { enabled: true, formula: "" }}}];
    expect(computeWoundReduction(items, -4)).toBe(0);
  });
  it("formula='-1' reduces magnitude by 1 (less negative)", () => {
    const items = [{ system: { woundReduction: { enabled: true, formula: "-1" }}}];
    expect(computeWoundReduction(items, -2)).toBe(-1);
  });
  it("formula='-3' reduces magnitude by 3", () => {
    const items = [{ system: { woundReduction: { enabled: true, formula: "-3" }}}];
    expect(computeWoundReduction(items, -4)).toBe(-1);
  });
  it("result is clamped to 0 (never positive)", () => {
    const items = [{ system: { woundReduction: { enabled: true, formula: "-3" }}}];
    expect(computeWoundReduction(items, -2)).toBe(0);
  });
  it("stacking: multiple reductions accumulate", () => {
    const items = [
      { system: { woundReduction: { enabled: true, formula: "-1" }}},
      { system: { woundReduction: { enabled: true, formula: "-1" }}}
    ];
    expect(computeWoundReduction(items, -4)).toBe(-2);
  });
  it("any full-negation charm overrides everything", () => {
    const items = [
      { system: { woundReduction: { enabled: true, formula: "-1" }}},
      { system: { woundReduction: { enabled: true, formula: "" }}}
    ];
    expect(computeWoundReduction(items, -4)).toBe(0);
  });
});

// ── aggregateCharmDVBonus ────────────────────────────────────────────
describe("aggregateCharmDVBonus", () => {
  it("returns zeros when no charms", () => {
    const r = aggregateCharmDVBonus([]);
    expect(r).toEqual({ dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: [] });
  });
  it("sums flat dodge/parry bonuses", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 2, parryBonus: 1, ignoreAllPenalties: false, ignorePenaltyTypes: [] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.dodgeBonus).toBe(2);
    expect(r.parryBonus).toBe(1);
  });
  it("sets ignoreAllPenalties when any charm has it", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: true, ignorePenaltyTypes: [] }}}
    ];
    expect(aggregateCharmDVBonus(items).ignoreAllPenalties).toBe(true);
  });
  it("unions ignorePenaltyTypes across charms", () => {
    const items = [
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: ["parryPenalties"] }}},
      { system: { dvBonus: { enabled: true, dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: ["environmental"] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.ignorePenaltyTypes).toContain("parryPenalties");
    expect(r.ignorePenaltyTypes).toContain("environmental");
  });
  it("skips disabled charms", () => {
    const items = [
      { system: { dvBonus: { enabled: false, dodgeBonus: 5, parryBonus: 5, ignoreAllPenalties: true, ignorePenaltyTypes: [] }}}
    ];
    const r = aggregateCharmDVBonus(items);
    expect(r.dodgeBonus).toBe(0);
    expect(r.ignoreAllPenalties).toBe(false);
  });
});

// ── applyStatBoostDeltas ─────────────────────────────────────────────
describe("applyStatBoostDeltas", () => {
  it("adds delta to flat object path", () => {
    const data = { attributes: { strength: { value: 3 } } };
    applyStatBoostDeltas(data, [{ path: "attributes.strength.value", delta: 2 }]);
    expect(data.attributes.strength.value).toBe(5);
  });
  it("stacks multiple deltas on the same path", () => {
    const data = { abilities: { melee: { value: 4 } } };
    applyStatBoostDeltas(data, [
      { path: "abilities.melee.value", delta: 1 },
      { path: "abilities.melee.value", delta: 1 }
    ]);
    expect(data.abilities.melee.value).toBe(6);
  });
  it("creates intermediate objects if missing", () => {
    const data = {};
    applyStatBoostDeltas(data, [{ path: "a.b.c", delta: 3 }]);
    expect(data.a.b.c).toBe(3);
  });
  it("no-ops on empty deltas array", () => {
    const data = { attributes: { dexterity: { value: 4 } } };
    applyStatBoostDeltas(data, []);
    expect(data.attributes.dexterity.value).toBe(4);
  });
});

// ── isCharmPassivelyActive ───────────────────────────────────────────
import { isCharmPassivelyActive } from "../../module/rolls/charm-passive-math.mjs";

describe("isCharmPassivelyActive", () => {
  it("permanent charm is always active", () => {
    expect(isCharmPassivelyActive({ system: { duration: "permanent", active: false } })).toBe(true);
  });
  it("permanent charm is active even when active=false", () => {
    expect(isCharmPassivelyActive({ system: { duration: "permanent", active: false } })).toBe(true);
  });
  it("oneScene charm is active when active=true", () => {
    expect(isCharmPassivelyActive({ system: { duration: "oneScene", active: true } })).toBe(true);
  });
  it("oneScene charm is inactive when active=false", () => {
    expect(isCharmPassivelyActive({ system: { duration: "oneScene", active: false } })).toBe(false);
  });
  it("instant charm with active=false is inactive", () => {
    expect(isCharmPassivelyActive({ system: { duration: "instant", active: false } })).toBe(false);
  });
  it("charmType=permanent is active even when duration defaults to instant", () => {
    expect(isCharmPassivelyActive({ system: { charmType: "permanent", duration: "instant", active: false } })).toBe(true);
  });
  it("undefined item returns false", () => {
    expect(isCharmPassivelyActive(undefined)).toBe(false);
  });
});
