// These tests verify the arithmetic the _prepareHealthData / _prepareMoteMaxima
// wiring relies on. Full end-to-end wiring is covered by Quench integration tests.
import { describe, it, expect } from "vitest";
import {
  computeHealthGrantBonus,
  computeWoundReduction,
  computeMotePoolBonus,
  computeSoakBonus,
  aggregateCharmDVBonus,
  applyStatBoostDeltas,
} from "../../module/rolls/charm-passive-math.mjs";

describe("computeHealthGrantBonus arithmetic", () => {
  it("two extra -2 boxes give totalBoxes = 9", () => {
    const charms = [{ system: { healthGrant: {
      enabled: true,
      options: [{ zero: 0, one: 0, two: 2, dying: 0 }]
    }}}];
    const baseBonus  = { zero: 0, one: 0, two: 0 };
    const charmBonus = computeHealthGrantBonus(charms);
    const zeroCount  = 1 + baseBonus.zero + charmBonus.zero;
    const oneCount   = 2 + baseBonus.one  + charmBonus.one;
    const twoCount   = 2 + baseBonus.two  + charmBonus.two;
    expect(zeroCount + oneCount + twoCount + 2).toBe(9);
  });
});

describe("computeWoundReduction penalty arithmetic", () => {
  it("no charms: returns base penalty unchanged", () => {
    expect(computeWoundReduction([], -2)).toBe(-2);
  });
  it("formula='-1' reduces -2 to -1", () => {
    const charms = [{ system: { woundReduction: { enabled: true, formula: "-1" }}}];
    expect(computeWoundReduction(charms, -2)).toBe(-1);
  });
  it("formula='' negates all: -4 becomes 0", () => {
    const charms = [{ system: { woundReduction: { enabled: true, formula: "" }}}];
    expect(computeWoundReduction(charms, -4)).toBe(0);
  });
});

describe("computeMotePoolBonus arithmetic", () => {
  it("no charms: bonus is zero", () => {
    expect(computeMotePoolBonus([])).toEqual({ personal: 0, peripheral: 0 });
  });
  it("Essence Plethora adds 10 peripheral", () => {
    const charms = [{ system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}];
    expect(computeMotePoolBonus(charms)).toEqual({ personal: 0, peripheral: 10 });
  });
  it("two stacked give 20", () => {
    const charms = [
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}},
      { system: { motePoolBonus: { enabled: true, pool: "peripheral", amount: 10 }}}
    ];
    expect(computeMotePoolBonus(charms).peripheral).toBe(20);
  });
});

describe("computeSoakBonus arithmetic", () => {
  it("no entries: all zeros", () => {
    const bonus = computeSoakBonus([]);
    expect(bonus.bashing).toBe(0);
    expect(bonus.lethal).toBe(0);
  });
  it("invincible-essence-reinforcement adds 3B/3L", () => {
    const entries = [{ bashing: 3, lethal: 3, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 }];
    const bonus = computeSoakBonus(entries);
    expect(bonus).toEqual({ bashing: 3, lethal: 3, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 });
  });
  it("applies to simulated totalSoak object", () => {
    const totalSoak = { bashing: 5, lethal: 2, aggravated: 0 };
    const bonus = computeSoakBonus([{ bashing: 3, lethal: 3, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 }]);
    const result = {
      bashing:    totalSoak.bashing    + bonus.bashing,
      lethal:     totalSoak.lethal     + bonus.lethal,
      aggravated: totalSoak.aggravated + bonus.aggravated
    };
    expect(result).toEqual({ bashing: 8, lethal: 5, aggravated: 0 });
  });
  it("hardnessSetTo takes max over existing hardness, not replacement", () => {
    // armor gives hardness 3; charm hardnessSetTo 2 must not lower it
    const bonus = computeSoakBonus([{ bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 2 }]);
    const result = Math.max(3, bonus.hardnessSetTo) + bonus.hardnessAdd;
    expect(result).toBe(3);
  });
  it("hardnessAdd stacks on top of hardnessSetTo result", () => {
    const bonus = computeSoakBonus([{ bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 1, hardnessSetTo: 5 }]);
    const result = Math.max(3, bonus.hardnessSetTo) + bonus.hardnessAdd;
    expect(result).toBe(6);
  });
});

describe("aggregateCharmDVBonus arithmetic", () => {
  it("flat parry bonus adds to parryBonus only", () => {
    const items = [{ system: { dvBonus: {
      enabled: true, dodgeBonus: 0, parryBonus: 2,
      ignoreAllPenalties: false, ignorePenaltyTypes: []
    }}}];
    const r = aggregateCharmDVBonus(items);
    expect(r.parryBonus).toBe(2);
    expect(r.dodgeBonus).toBe(0);
  });
  it("ignorePenaltyTypes includes 'parryPenalties'", () => {
    const items = [{ system: { dvBonus: {
      enabled: true, dodgeBonus: 0, parryBonus: 0,
      ignoreAllPenalties: false, ignorePenaltyTypes: ["parryPenalties"]
    }}}];
    const r = aggregateCharmDVBonus(items);
    expect(r.ignorePenaltyTypes).toContain("parryPenalties");
  });
});

describe("applyStatBoostDeltas arithmetic", () => {
  it("boost strength by 1", () => {
    const data = { attributes: { strength: { value: 3 } } };
    applyStatBoostDeltas(data, [{ path: "attributes.strength.value", delta: 1 }]);
    expect(data.attributes.strength.value).toBe(4);
  });
  it("boost an ability", () => {
    const data = { abilities: { melee: { value: 2 } } };
    applyStatBoostDeltas(data, [{ path: "abilities.melee.value", delta: 3 }]);
    expect(data.abilities.melee.value).toBe(5);
  });
});
