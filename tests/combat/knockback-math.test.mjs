import { describe, it, expect } from "vitest";
import {
  computeKnockback,
  computeKnockdownTrigger,
  computeStunTrigger
} from "../../module/combat/knockback-math.mjs";

// ── computeKnockback ──────────────────────────────────────────────────
describe("computeKnockback", () => {
  it("below threshold → no fire, no distance", () => {
    expect(computeKnockback({ effectivePool: 4, sta: 2, res: 3 }))
      .toEqual({ fired: false, distance: 0 });
  });

  it("equal to threshold → no fire (must exceed)", () => {
    expect(computeKnockback({ effectivePool: 5, sta: 2, res: 3 }))
      .toEqual({ fired: false, distance: 0 });
  });

  it("one over threshold → fires, distance = floor(dice/3)", () => {
    expect(computeKnockback({ effectivePool: 6, sta: 2, res: 3 }))
      .toEqual({ fired: true, distance: 2 });
  });

  it("floor rounding: 8/3 = 2.67 → 2 yards", () => {
    expect(computeKnockback({ effectivePool: 8, sta: 2, res: 3 }))
      .toEqual({ fired: true, distance: 2 });
  });

  it("zero/negative inputs → no fire, no distance", () => {
    expect(computeKnockback({ effectivePool: 0, sta: -1, res: -1 }))
      .toEqual({ fired: false, distance: 0 });
  });
});

// ── computeKnockdownTrigger ───────────────────────────────────────────
describe("computeKnockdownTrigger", () => {
  it("distance ≤ mobility → not triggered", () => {
    expect(computeKnockdownTrigger({ distance: 2, dex: 2, ath: 3 }))
      .toEqual({ triggered: false, mobility: 5 });
  });

  it("distance > mobility → triggered", () => {
    expect(computeKnockdownTrigger({ distance: 4, dex: 1, ath: 2 }))
      .toEqual({ triggered: true, mobility: 3 });
  });

  it("zero distance (knockback didn't fire) → not triggered", () => {
    expect(computeKnockdownTrigger({ distance: 0, dex: 2, ath: 2 }))
      .toEqual({ triggered: false, mobility: 4 });
  });
});

// ── computeStunTrigger ────────────────────────────────────────────────
describe("computeStunTrigger", () => {
  it("inflicted < stamina → not triggered", () => {
    expect(computeStunTrigger({ inflictedDamage: 2, sta: 4 }))
      .toEqual({ triggered: false, threshold: 4 });
  });

  it("inflicted > stamina → triggered", () => {
    expect(computeStunTrigger({ inflictedDamage: 5, sta: 3 }))
      .toEqual({ triggered: true, threshold: 3 });
  });

  it("inflicted == stamina → not triggered (must exceed)", () => {
    expect(computeStunTrigger({ inflictedDamage: 3, sta: 3 }))
      .toEqual({ triggered: false, threshold: 3 });
  });

  it("zero inflicted damage → not triggered", () => {
    expect(computeStunTrigger({ inflictedDamage: 0, sta: 3 }))
      .toEqual({ triggered: false, threshold: 3 });
  });
});
