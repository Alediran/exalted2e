import { describe, it, expect } from "vitest";
import { computeShapeshiftCost } from "../../module/combat/shapeshift-math.mjs";

describe("computeShapeshiftCost", () => {
  it("charges 1 mote for shifting to human guise (empty target)", () => {
    expect(computeShapeshiftCost({ targetFormId: "", spiritShapeFormId: "abc" })).toBe(1);
  });

  it("charges 1 mote when target matches the spirit shape", () => {
    expect(computeShapeshiftCost({ targetFormId: "abc", spiritShapeFormId: "abc" })).toBe(1);
  });

  it("charges 3 motes for any other Heart's Blood form", () => {
    expect(computeShapeshiftCost({ targetFormId: "xyz", spiritShapeFormId: "abc" })).toBe(3);
  });

  it("charges 3 motes when targeting a Heart's Blood form even with no spirit shape set", () => {
    expect(computeShapeshiftCost({ targetFormId: "xyz", spiritShapeFormId: "" })).toBe(3);
  });

  it("charges 1 mote for human guise even when spirit shape is unset", () => {
    expect(computeShapeshiftCost({ targetFormId: "" })).toBe(1);
  });
});
