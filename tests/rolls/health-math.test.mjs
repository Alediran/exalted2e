import { describe, it, expect } from "vitest";
import { computeWoundPenalty, clampDamage, healInOrder } from "../../module/rolls/health-math.mjs";

// ── computeWoundPenalty ──────────────────────────────────────────────
describe("computeWoundPenalty", () => {
  // Default level counts: 1 × -0, 2 × -1, 2 × -2, 1 × -4, 1 × Incap = 7 boxes
  const lc = { zero: 1, one: 2, two: 2 };

  it("returns 0 when no box is filled", () => {
    expect(computeWoundPenalty(0, lc)).toBe(0);
  });

  it("returns -1 when the -1 row has at least one filled box (filled = 2, zero=1)", () => {
    expect(computeWoundPenalty(2, lc)).toBe(-1);
  });

  it("returns -2 when the -2 row has at least one filled box (filled = 4)", () => {
    expect(computeWoundPenalty(4, lc)).toBe(-2);
  });

  it("returns -4 when the -4 box is filled (filled = 6)", () => {
    expect(computeWoundPenalty(6, lc)).toBe(-4);
  });

  it("returns null (incapacitated) when filled is at the Incap box (filled = 7)", () => {
    expect(computeWoundPenalty(7, lc)).toBe(null);
  });

  it("honors bonus boxes that widen the -0 row (zero=3, filled=3 still reads as -0)", () => {
    const wide = { zero: 3, one: 2, two: 2 };
    expect(computeWoundPenalty(3, wide)).toBe(0);                  // last -0 box
    expect(computeWoundPenalty(4, wide)).toBe(-1);                 // first -1 box
  });
});

// ── clampDamage ──────────────────────────────────────────────────────
describe("clampDamage", () => {
  it("adds damage below the cap without mutating the source", () => {
    const src = { bashing: 1, lethal: 1, aggravated: 0, bonus: { zero: 0, one: 0, two: 0 } };
    const out = clampDamage(src, "bashing", 2, 7);
    expect(out.bashing).toBe(3);
    expect(out.lethal).toBe(1);
    expect(out.aggravated).toBe(0);
    expect(src.bashing).toBe(1);                                   // source unchanged
    expect(out).not.toBe(src);                                     // fresh reference
  });

  it("clamps total damage at totalBoxes by subtracting excess from the damage type", () => {
    // 7 boxes, already 6 damage (3L + 3B). Add 5 bashing → total would be 11, excess 4.
    const src = { bashing: 3, lethal: 3, aggravated: 0 };
    const out = clampDamage(src, "bashing", 5, 7);
    expect(out.bashing).toBe(4);                                   // 3 + 5 - 4 excess = 4
    expect(out.lethal).toBe(3);                                    // untouched
    expect((out.bashing + out.lethal + out.aggravated)).toBe(7);   // total caps at 7
  });

  it("negative `amount` floors the column at zero (e.g., un-damage past empty)", () => {
    const src = { bashing: 2, lethal: 0, aggravated: 0 };
    const out = clampDamage(src, "bashing", -5, 7);
    expect(out.bashing).toBe(0);                                   // floored at 0, not -3
  });
});

// ── healInOrder ──────────────────────────────────────────────────────
describe("healInOrder", () => {
  it("heals bashing first without touching lethal/aggravated", () => {
    const src = { bashing: 3, lethal: 2, aggravated: 1 };
    const out = healInOrder(src, 2);
    expect(out).toEqual({ bashing: 1, lethal: 2, aggravated: 1 });
    expect(src.bashing).toBe(3);                                   // source unchanged
  });

  it("cascades into lethal, then aggravated, as earlier columns empty", () => {
    const src = { bashing: 2, lethal: 2, aggravated: 1 };
    const out = healInOrder(src, 4);                                // heal 2B, 2L, 0A remaining
    expect(out).toEqual({ bashing: 0, lethal: 0, aggravated: 1 });
  });

  it("stops when `amount` is exhausted even if damage remains", () => {
    const src = { bashing: 5, lethal: 3, aggravated: 2 };
    const out = healInOrder(src, 0);
    expect(out).toEqual({ bashing: 5, lethal: 3, aggravated: 2 }); // no-op
  });
});
