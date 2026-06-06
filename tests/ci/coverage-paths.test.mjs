import { describe, it, expect } from "vitest";
import { normalizeCoverageKey } from "../../tools/ci/coverage-paths.mjs";

describe("normalizeCoverageKey", () => {
  it("strips a Quench URL prefix to a repo-relative module path", () => {
    expect(normalizeCoverageKey("http://localhost:30000/systems/exalted2e/module/rolls/dice-math.mjs"))
      .toBe("module/rolls/dice-math.mjs");
  });
  it("strips an absolute workspace prefix", () => {
    expect(normalizeCoverageKey("/home/runner/work/exalted2e/exalted2e/module/rolls/dice-math.mjs"))
      .toBe("module/rolls/dice-math.mjs");
  });
  it("leaves an already-relative module path unchanged", () => {
    expect(normalizeCoverageKey("module/rolls/dice-math.mjs")).toBe("module/rolls/dice-math.mjs");
  });
  it("drops query and hash suffixes", () => {
    expect(normalizeCoverageKey("http://x/systems/exalted2e/module/a.mjs?v=123#h")).toBe("module/a.mjs");
  });
  it("normalizes windows separators", () => {
    expect(normalizeCoverageKey("C:\\repo\\module\\a.mjs")).toBe("module/a.mjs");
  });
  it("returns non-module input unchanged", () => {
    expect(normalizeCoverageKey("http://x/scripts/foundry.js")).toBe("http://x/scripts/foundry.js");
  });
  it("leaves a non-module input with a query string unchanged", () => {
    expect(normalizeCoverageKey("http://x/scripts/foundry.js?v=123")).toBe("http://x/scripts/foundry.js?v=123");
  });
  it("passes through non-string input", () => {
    expect(normalizeCoverageKey(null)).toBe(null);
  });
});
