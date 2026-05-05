import { describe, it, expect } from "vitest";
import { computeVentUpdate } from "../../module/helpers/resonance-vent.mjs";

describe("computeVentUpdate", () => {
  it("3 successes from limit 5 → limit 2, bankedResonance +3", () => {
    const result = computeVentUpdate(5, 0, 3);
    expect(result.limit).toBe(2);
    expect(result.bankedResonance).toBe(3);
  });

  it("7 successes from limit 3 → limit 0 (floor), bankedResonance +7", () => {
    const result = computeVentUpdate(3, 0, 7);
    expect(result.limit).toBe(0);
    expect(result.bankedResonance).toBe(7);
  });

  it("0 successes from limit 5 → limit 6", () => {
    const result = computeVentUpdate(5, 0, 0);
    expect(result.limit).toBe(6);
    expect(result.bankedResonance).toBe(0);
  });

  it("0 successes from limit 10 → limit stays 10 (cap)", () => {
    const result = computeVentUpdate(10, 0, 0);
    expect(result.limit).toBe(10);
    expect(result.bankedResonance).toBe(0);
  });

  it("bankedResonance accumulates on top of existing balance", () => {
    const result = computeVentUpdate(5, 4, 3);
    expect(result.limit).toBe(2);
    expect(result.bankedResonance).toBe(7);
  });

  it("0 successes preserves existing bankedResonance balance", () => {
    expect(computeVentUpdate(5, 3, 0).bankedResonance).toBe(3);
  });
});
