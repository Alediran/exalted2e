import { describe, it, expect } from "vitest";
import { computeFoiSurcharge } from "../../module/helpers/foi-helpers.mjs";

const makeCharm = (keywords = [], flaws = []) => ({
  system: { keywords, flawsOfInvulnerability: flaws }
});

describe("computeFoiSurcharge", () => {
  it("returns 0 when no Form-type charm present", () => {
    const charms = [makeCharm([], [{ type: "custom", label: "X" }])];
    expect(computeFoiSurcharge(charms)).toBe(0);
  });

  it("returns 0 when no FoI charm present", () => {
    const charms = [makeCharm(["Form-type"], [])];
    expect(computeFoiSurcharge(charms)).toBe(0);
  });

  it("returns 2 when Form-type and FoI charm both present", () => {
    const charms = [
      makeCharm(["Form-type"], []),
      makeCharm([], [{ type: "custom", label: "X" }])
    ];
    expect(computeFoiSurcharge(charms)).toBe(2);
  });

  it("returns 0 when FoI array is empty even with Form-type", () => {
    const charms = [
      makeCharm(["Form-type"], []),
      makeCharm([], [])
    ];
    expect(computeFoiSurcharge(charms)).toBe(0);
  });

  it("single charm with both Form-type and FoI flaws counts", () => {
    const charms = [makeCharm(["Form-type"], [{ type: "t", label: "L" }])];
    expect(computeFoiSurcharge(charms)).toBe(2);
  });
});
