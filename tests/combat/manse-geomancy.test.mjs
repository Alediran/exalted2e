import { describe, it, expect } from "vitest";
import { manseBudgetState } from "../../module/helpers/manse-geomancy.mjs";

describe("manseBudgetState", () => {
  it("base = rating x 2 with no drawbacks", () => {
    const s = manseBudgetState({}, 3);
    expect(s.base).toBe(6);
    expect(s.total).toBe(6);
    expect(s.used).toBe(0);
    expect(s.over).toBe(false);
    expect(s.effectiveHearthstone).toBe(3);
  });

  it("sums drawback points (maint x1, frag x2, habit x1)", () => {
    const s = manseBudgetState({ maintenance: 2, fragility: 1, habitabilityReduction: 1 }, 3);
    expect(s.drawbackPoints).toBe(5);
    expect(s.total).toBe(11);
  });

  it("hearthstone sacrifice points + effective level, clamped", () => {
    const a = manseBudgetState({ hearthstoneReduction: 2 }, 4);
    expect(a.sacrificePoints).toBe(2);
    expect(a.effectiveHearthstone).toBe(2);
    const b = manseBudgetState({ hearthstoneReduction: 6 }, 4);
    expect(b.sacrificePoints).toBe(4);
    expect(b.effectiveHearthstone).toBe(0);
  });

  it("Design Beyond Limit grants +10 only at rating 5", () => {
    expect(manseBudgetState({ designBeyondLimit: true }, 5).dblPoints).toBe(10);
    expect(manseBudgetState({ designBeyondLimit: true }, 4).dblPoints).toBe(0);
  });

  it("used / over from power costs", () => {
    const s = manseBudgetState({ powers: [{ cost: 4 }, { cost: 3 }] }, 3);
    expect(s.used).toBe(7);
    expect(s.total).toBe(6);
    expect(s.over).toBe(true);
  });

  it("flags powers whose cost exceeds rating unless material", () => {
    const s = manseBudgetState({ powers: [{ cost: 4 }, { cost: 4, isMaterial: true }, { cost: 2 }] }, 3);
    expect(s.violations).toEqual([0]);
  });

  it("hearthstoneTooHigh when linked stone exceeds the cap", () => {
    const hi = manseBudgetState({ hearthstoneReduction: 2 }, 5, { linkedHearthstoneRating: 4 });
    expect(hi.effectiveHearthstone).toBe(3);
    expect(hi.hearthstoneTooHigh).toBe(true);
    const ok = manseBudgetState({ hearthstoneReduction: 2 }, 5, { linkedHearthstoneRating: 3 });
    expect(ok.hearthstoneTooHigh).toBe(false);
  });
});
