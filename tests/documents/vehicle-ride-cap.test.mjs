import { describe, it, expect } from "vitest";
import { computeRideCappedAbility } from "../../module/rolls/mounted-combat.mjs";

describe("computeRideCappedAbility", () => {
  it("returns ability when lower than ride", () => {
    expect(computeRideCappedAbility(2, 4)).toBe(2);
  });

  it("returns ride when lower than ability", () => {
    expect(computeRideCappedAbility(5, 3)).toBe(3);
  });

  it("returns the value when ability equals ride", () => {
    expect(computeRideCappedAbility(3, 3)).toBe(3);
  });

  it("returns 0 when ability is 0", () => {
    expect(computeRideCappedAbility(0, 4)).toBe(0);
  });

  it("treats null as 0", () => {
    expect(computeRideCappedAbility(null, 4)).toBe(0);
    expect(computeRideCappedAbility(3, null)).toBe(0);
  });

  it("treats undefined as 0", () => {
    expect(computeRideCappedAbility(undefined, 3)).toBe(0);
    expect(computeRideCappedAbility(4, undefined)).toBe(0);
  });
});
