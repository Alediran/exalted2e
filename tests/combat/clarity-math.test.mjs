import { describe, it, expect } from "vitest";
import { getClarityBand, computeTotalClarity, computePermanentClarity, CLARITY_BANDS }
  from "../../module/combat/clarity-math.mjs";

describe("getClarityBand", () => {
  it("returns band 0-2 for clarity 0", () => {
    expect(getClarityBand(0).socialPenalty).toBe(0);
  });
  it("returns band 0-2 for clarity 2", () => {
    expect(getClarityBand(2).socialPenalty).toBe(0);
  });
  it("returns band 3-4 for clarity 3", () => {
    const b = getClarityBand(3);
    expect(b.socialPenalty).toBe(1);
    expect(b.compassionPenalty).toBe(1);
    expect(b.mentalBonus).toBe(0);
    expect(b.compassionAutoFail).toBe(false);
  });
  it("returns band 3-4 for clarity 4", () => {
    expect(getClarityBand(4).socialPenalty).toBe(1);
  });
  it("returns band 5-7 for clarity 5", () => {
    expect(getClarityBand(5).socialPenalty).toBe(2);
  });
  it("returns band 5-7 for clarity 7", () => {
    expect(getClarityBand(7).socialPenalty).toBe(2);
  });
  it("returns band 8-9 for clarity 8", () => {
    const b = getClarityBand(8);
    expect(b.socialPenalty).toBe(3);
    expect(b.mentalBonus).toBe(1);
    expect(b.compassionAutoFail).toBe(false);
  });
  it("returns band 8-9 for clarity 9", () => {
    expect(getClarityBand(9).mentalBonus).toBe(1);
  });
  it("returns band 10 for clarity 10", () => {
    const b = getClarityBand(10);
    expect(b.socialPenalty).toBe(4);
    expect(b.mentalBonus).toBe(3);
    expect(b.compassionAutoFail).toBe(true);
  });
  it("defaults to band 0-2 for out-of-range values", () => {
    expect(getClarityBand(-1).socialPenalty).toBe(0);
    expect(getClarityBand(11).socialPenalty).toBe(0);
  });
});

describe("computeTotalClarity", () => {
  it("sums permanent and temporary", () => {
    expect(computeTotalClarity(3, 4)).toBe(7);
  });
  it("caps at 10", () => {
    expect(computeTotalClarity(6, 7)).toBe(10);
    expect(computeTotalClarity(10, 10)).toBe(10);
  });
  it("handles zero values", () => {
    expect(computeTotalClarity(0, 0)).toBe(0);
  });
});

describe("computePermanentClarity", () => {
  it("returns 0 when Essence is 5", () => {
    expect(computePermanentClarity(5, 0)).toBe(0);
  });
  it("returns 0 when Essence is below 5", () => {
    expect(computePermanentClarity(3, 0)).toBe(0);
  });
  it("returns 1 when Essence is 6", () => {
    expect(computePermanentClarity(6, 0)).toBe(1);
  });
  it("adds Exemplar count on top of Essence contribution", () => {
    expect(computePermanentClarity(7, 2)).toBe(4);
  });
  it("Exemplar count alone when Essence <= 5", () => {
    expect(computePermanentClarity(4, 3)).toBe(3);
  });
  it("Essence exactly 5 with Exemplars contributes only exemplar count", () => {
    expect(computePermanentClarity(5, 3)).toBe(3);
  });
});

describe("CLARITY_BANDS", () => {
  it("exports exactly 5 bands", () => {
    expect(CLARITY_BANDS.length).toBe(5);
  });
});
