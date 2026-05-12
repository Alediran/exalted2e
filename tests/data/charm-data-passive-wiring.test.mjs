// These tests verify the arithmetic the _prepareHealthData / _prepareMoteMaxima
// wiring relies on. Full end-to-end wiring is covered by Quench integration tests.
import { describe, it, expect } from "vitest";
import {
  computeHealthGrantBonus,
  computeWoundReduction,
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


