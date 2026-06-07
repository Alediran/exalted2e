import { describe, it, expect } from "vitest";
import { normalizeDestinyOption, clampParadox } from "../../module/combat/sidereal-destiny-math.mjs";

const loc = k => `loc:${k}`;

describe("normalizeDestinyOption", () => {
  it("maps a config entry with defaults filled in", () => {
    expect(normalizeDestinyOption("minor", { labelKey: "EX2E.Minor" }, loc)).toEqual({
      key: "minor", label: "loc:EX2E.Minor", paradoxDice: 0, effectPoints: 0, invitesCensure: false,
    });
  });
  it("numeric-string keys become numbers; flags pass through", () => {
    expect(normalizeDestinyOption("2", { labelKey: "EX2E.Two", paradoxDice: 3, effectPoints: 1, invitesCensure: true }, loc))
      .toEqual({ key: 2, label: "loc:EX2E.Two", paradoxDice: 3, effectPoints: 1, invitesCensure: true });
  });
});

describe("clampParadox", () => {
  it("sums current and gained without exceeding max", () => {
    expect(clampParadox(3, 2)).toBe(5);
  });
  it("caps at max when sum exceeds it", () => {
    expect(clampParadox(8, 5)).toBe(10);
  });
});
