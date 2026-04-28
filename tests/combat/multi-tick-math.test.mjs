import { describe, it, expect } from "vitest";
import { advanceTickState } from "../../module/combat/multi-tick-math.mjs";

describe("advanceTickState", () => {
  it("bumps ticksElapsed by 1 mid-cycle", () => {
    expect(advanceTickState({ ticksElapsed: 0, totalTicks: 3, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 1, cycleCount: 0, completedCycle: false });
  });

  it("bumps ticksElapsed by 1 mid-cycle (deeper)", () => {
    expect(advanceTickState({ ticksElapsed: 1, totalTicks: 3, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 2, cycleCount: 0, completedCycle: false });
  });

  it("on the boundary tick, sets completedCycle true and bumps cycleCount", () => {
    expect(advanceTickState({ ticksElapsed: 2, totalTicks: 3, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 3, cycleCount: 1, completedCycle: true });
  });

  it("clamps at totalTicks once already completed; no double-fire", () => {
    expect(advanceTickState({ ticksElapsed: 3, totalTicks: 3, cycleCount: 1 }))
      .toEqual({ ticksElapsed: 3, cycleCount: 1, completedCycle: false });
  });

  it("clamp is idempotent for higher cycleCount", () => {
    expect(advanceTickState({ ticksElapsed: 3, totalTicks: 3, cycleCount: 5 }))
      .toEqual({ ticksElapsed: 3, cycleCount: 5, completedCycle: false });
  });

  it("clamps corrupt over-cap state without re-firing", () => {
    expect(advanceTickState({ ticksElapsed: 7, totalTicks: 3, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 3, cycleCount: 0, completedCycle: false });
  });

  it("totalTicks <= 0 is degenerate; passes through unchanged", () => {
    expect(advanceTickState({ ticksElapsed: 0, totalTicks: 0, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 0, cycleCount: 0, completedCycle: false });
  });

  it("clamps low side; negative ticksElapsed becomes 0 (not -1+1=0 boundary)", () => {
    expect(advanceTickState({ ticksElapsed: -1, totalTicks: 3, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 0, cycleCount: 0, completedCycle: false });
  });

  it("single-tick total fires completion immediately", () => {
    expect(advanceTickState({ ticksElapsed: 0, totalTicks: 1, cycleCount: 0 }))
      .toEqual({ ticksElapsed: 1, cycleCount: 1, completedCycle: true });
  });

  it("missing fields default safely", () => {
    expect(advanceTickState({}))
      .toEqual({ ticksElapsed: 0, cycleCount: 0, completedCycle: false });
  });
});
