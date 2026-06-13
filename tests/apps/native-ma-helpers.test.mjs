import { vi, describe, it, expect } from "vitest";
import {
  buildSplatList,
  parseNativeMaFormData,
} from "../../module/apps/_native-ma-helpers.mjs";

// ── buildSplatList ────────────────────────────────────────────────────────────

describe("buildSplatList", () => {
  const EXCLUDED = new Set(["mortal", "spirit", "martialarts"]);
  const localize = key => key;

  const splatTypes = {
    solar:       "EX2E.Solar",
    lunar:       "EX2E.Lunar",
    mortal:      "EX2E.Mortal",
    spirit:      "EX2E.Spirit",
    martialarts: "EX2E.MartialArts",
  };

  it("excludes mortal from the result", () => {
    const result = buildSplatList(splatTypes, {}, EXCLUDED, localize);
    expect(result.map(s => s.key)).not.toContain("mortal");
  });

  it("excludes spirit from the result", () => {
    const result = buildSplatList(splatTypes, {}, EXCLUDED, localize);
    expect(result.map(s => s.key)).not.toContain("spirit");
  });

  it("excludes martialarts from the result", () => {
    const result = buildSplatList(splatTypes, {}, EXCLUDED, localize);
    expect(result.map(s => s.key)).not.toContain("martialarts");
  });

  it("includes solar and lunar (non-excluded)", () => {
    const result = buildSplatList(splatTypes, {}, EXCLUDED, localize);
    const keys = result.map(s => s.key);
    expect(keys).toContain("solar");
    expect(keys).toContain("lunar");
  });

  it("joins saved styles array with newlines", () => {
    const saved = { solar: ["Tiger Style", "Snake Style"] };
    const result = buildSplatList(splatTypes, saved, EXCLUDED, localize);
    expect(result.find(s => s.key === "solar").styles).toBe("Tiger Style\nSnake Style");
  });

  it("uses empty string when no styles are saved for a splat", () => {
    const result = buildSplatList(splatTypes, {}, EXCLUDED, localize);
    expect(result.find(s => s.key === "solar").styles).toBe("");
  });

  it("calls localizeFn with the labelKey and uses result as label", () => {
    const mockLocalize = vi.fn(key => `loc:${key}`);
    const result = buildSplatList({ solar: "EX2E.Solar" }, {}, new Set(), mockLocalize);
    expect(mockLocalize).toHaveBeenCalledWith("EX2E.Solar");
    expect(result[0].label).toBe("loc:EX2E.Solar");
  });

  it("each entry has key, label, and styles", () => {
    const result = buildSplatList({ solar: "EX2E.Solar" }, {}, new Set(), localize);
    expect(result[0]).toHaveProperty("key", "solar");
    expect(result[0]).toHaveProperty("label");
    expect(result[0]).toHaveProperty("styles");
  });

  it("returns empty array when all splats are excluded", () => {
    const result = buildSplatList(splatTypes, {}, new Set(Object.keys(splatTypes)), localize);
    expect(result).toHaveLength(0);
  });
});

// ── parseNativeMaFormData ─────────────────────────────────────────────────────

describe("parseNativeMaFormData", () => {
  it("converts a styles.<splat> key to an array of style names", () => {
    const result = parseNativeMaFormData({ "styles.solar": "Tiger Style\nSnake Style" });
    expect(result.solar).toEqual(["Tiger Style", "Snake Style"]);
  });

  it("trims whitespace from each style name", () => {
    const result = parseNativeMaFormData({ "styles.solar": "  Tiger Style  \n  Snake Style  " });
    expect(result.solar).toEqual(["Tiger Style", "Snake Style"]);
  });

  it("filters out blank lines", () => {
    const result = parseNativeMaFormData({ "styles.solar": "Tiger Style\n\nSnake Style\n" });
    expect(result.solar).toEqual(["Tiger Style", "Snake Style"]);
  });

  it("handles multiple splat keys in one formData", () => {
    const result = parseNativeMaFormData({
      "styles.solar": "Tiger Style",
      "styles.lunar": "Silver Pact Style",
    });
    expect(result.solar).toEqual(["Tiger Style"]);
    expect(result.lunar).toEqual(["Silver Pact Style"]);
  });

  it("ignores keys that do not start with styles.", () => {
    const result = parseNativeMaFormData({ "other.key": "value", "styles.solar": "Tiger Style" });
    expect(Object.keys(result)).toEqual(["solar"]);
  });

  it("handles null value by returning empty array for that splat", () => {
    const result = parseNativeMaFormData({ "styles.solar": null });
    expect(result.solar).toEqual([]);
  });

  it("handles undefined value by returning empty array", () => {
    const result = parseNativeMaFormData({ "styles.solar": undefined });
    expect(result.solar).toEqual([]);
  });

  it("returns empty object for empty input", () => {
    expect(parseNativeMaFormData({})).toEqual({});
  });

  it("handles a single style with no trailing newline", () => {
    const result = parseNativeMaFormData({ "styles.solar": "Tiger Style" });
    expect(result.solar).toEqual(["Tiger Style"]);
  });
});
