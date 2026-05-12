// These tests verify the arithmetic the _prepareHealthData / _prepareMoteMaxima
// wiring relies on. Full end-to-end wiring is covered by Quench integration tests.
import { describe, it, expect } from "vitest";
import {
  computeHealthGrantBonus,
  computeWoundReduction,
  computeMotePoolBonus,
  aggregateCharmDVBonus,
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
  it("no bonus (0): returns base penalty unchanged", () => {
    expect(computeWoundReduction(0, -2)).toBe(-2);
  });
  it("bonus=1 reduces -2 to -1", () => {
    expect(computeWoundReduction(1, -2)).toBe(-1);
  });
  it("bonus=4 negates all: -4 becomes 0", () => {
    expect(computeWoundReduction(4, -4)).toBe(0);
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

