import { describe, it, expect } from "vitest";
import { scaleTmfxParams, makeFilterParamsKey } from "../../module/helpers/anima-fx-math.mjs";

describe("scaleTmfxParams", () => {
  it("scales strength fields and rounds padding; leaves others untouched", () => {
    const input = [{ outerStrength: 2, innerStrength: 1, auraIntensity: 4, subAuraIntensity: 3, padding: 10, color: 0xff0000 }];
    const out = scaleTmfxParams(input, 1.5);
    expect(out[0]).toEqual({ outerStrength: 3, innerStrength: 1.5, auraIntensity: 6, subAuraIntensity: 4.5, padding: 15, color: 0xff0000 });
  });
  it("omits fields that are absent on the source param", () => {
    const out = scaleTmfxParams([{ outerStrength: 2 }], 2);
    expect(out[0]).toEqual({ outerStrength: 4 });
  });
  it("does not mutate the input", () => {
    const input = [{ outerStrength: 2 }];
    scaleTmfxParams(input, 2);
    expect(input[0].outerStrength).toBe(2);
  });
});

describe("makeFilterParamsKey", () => {
  it("is order-independent and excludes the given keys + filterId", () => {
    const exclude = new Set(["tmFilterInternalId", "filterId"]);
    const a = makeFilterParamsKey({ b: 2, a: 1, tmFilterInternalId: "x", filterId: "f1" }, exclude);
    const b = makeFilterParamsKey({ a: 1, b: 2, tmFilterInternalId: "y", filterId: "f2" }, exclude);
    expect(a).toBe(b);
  });
});
