import { describe, it, expect, vi } from "vitest";
import { evaluateCharmFormula } from "../../module/documents/item.mjs";

describe("evaluateCharmFormula", () => {
  it("plain number passes through (Math.floor applied)", () => {
    expect(evaluateCharmFormula(5, {})).toBe(5);
    expect(evaluateCharmFormula(3.7, {})).toBe(3);                // floored
  });

  it("integer string parses to a number", () => {
    expect(evaluateCharmFormula("8", {})).toBe(8);
    expect(evaluateCharmFormula("  4  ", {})).toBe(4);             // trimmed
  });

  it("empty/null/undefined formula returns the fallback", () => {
    expect(evaluateCharmFormula("",        {}, 7)).toBe(7);
    expect(evaluateCharmFormula(null,      {}, 7)).toBe(7);
    expect(evaluateCharmFormula(undefined, {}, 7)).toBe(7);
  });

  it("formula substitutes rollData and returns a floored integer", () => {
    const rollData = { str: 4, ess: 3 };
    expect(evaluateCharmFormula("@str + @ess",     rollData)).toBe(7);
    expect(evaluateCharmFormula("@str + @ess / 2", rollData)).toBe(5);    // floor(4 + 1.5)
  });

  it("eval failure (malformed expression) returns the fallback and logs a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Bare characters that won't parse — Roll.safeEval throws under strict.
      expect(evaluateCharmFormula("@@@", {}, 99)).toBe(99);
      // A lone comma is also an unparseable expression (not "empty").
      expect(evaluateCharmFormula(",",   {}, 7)).toBe(7);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
