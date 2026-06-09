import { describe, it, expect } from "vitest";
import { localizedDescription } from "../../module/helpers/localize-description.mjs";

describe("localizedDescription", () => {
  it("returns the override when present and non-empty", () => {
    expect(localizedDescription("<p>en</p>", { es: "<p>es</p>" }, "es")).toBe("<p>es</p>");
  });
  it("falls back to default when override missing", () => {
    expect(localizedDescription("<p>en</p>", { es: "<p>es</p>" }, "fr")).toBe("<p>en</p>");
  });
  it("falls back when override is empty/whitespace", () => {
    expect(localizedDescription("<p>en</p>", { es: "   " }, "es")).toBe("<p>en</p>");
  });
  it("handles missing map", () => {
    expect(localizedDescription("<p>en</p>", undefined, "es")).toBe("<p>en</p>");
  });
  it("returns '' when default missing and no override", () => {
    expect(localizedDescription(undefined, {}, "es")).toBe("");
  });
});
