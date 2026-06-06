import { describe, it, expect } from "vitest";
import { filterSystemCoverage, summarizeCoverage } from "../../tools/ci/coverage-report.mjs";

const entry = (url, source, ranges) => ({
  url, source,
  functions: [{ ranges, isBlockCoverage: true }],
});

describe("filterSystemCoverage", () => {
  it("keeps only system module URLs", () => {
    const entries = [
      entry("http://x/systems/exalted2e/module/combat/mass-guard.mjs", "abcdefghij", []),
      entry("http://x/scripts/foundry.js", "xxxxxxxxxx", []),
      entry("http://x/modules/quench/quench.js", "yyyy", []),
    ];
    const r = filterSystemCoverage(entries);
    expect(r.map(e => e.url)).toEqual(["http://x/systems/exalted2e/module/combat/mass-guard.mjs"]);
  });

  it("honors a custom path fragment", () => {
    const entries = [entry("http://x/foo/bar.mjs", "abc", [])];
    expect(filterSystemCoverage(entries, { systemPathFragment: "foo/" })).toHaveLength(1);
  });
});

describe("summarizeCoverage", () => {
  it("100% when whole source is covered", () => {
    const e = entry("http://x/systems/exalted2e/module/a.mjs", "0123456789",
      [{ startOffset: 0, endOffset: 10, count: 1 }]);
    const s = summarizeCoverage([e]);
    expect(s.perFile[0].pct).toBe(100);
    expect(s.totalPct).toBe(100);
    expect(s.uncovered).toEqual([]);
  });

  it("50% when half the source is covered", () => {
    const e = entry("http://x/systems/exalted2e/module/a.mjs", "0123456789",
      [{ startOffset: 0, endOffset: 5, count: 1 }, { startOffset: 5, endOffset: 10, count: 0 }]);
    const s = summarizeCoverage([e]);
    expect(s.perFile[0].pct).toBe(50);
    expect(s.uncovered).toContain("http://x/systems/exalted2e/module/a.mjs");
  });

  it("orders uncovered worst-first and aggregates totalPct across files", () => {
    const good = entry("http://x/systems/exalted2e/module/good.mjs", "0123456789",
      [{ startOffset: 0, endOffset: 9, count: 1 }, { startOffset: 9, endOffset: 10, count: 0 }]); // 90%
    const bad = entry("http://x/systems/exalted2e/module/bad.mjs", "0123456789",
      [{ startOffset: 0, endOffset: 1, count: 1 }, { startOffset: 1, endOffset: 10, count: 0 }]); // 10%
    const s = summarizeCoverage([good, bad]);
    expect(s.uncovered[0]).toContain("bad.mjs"); // worst first
    expect(s.totalPct).toBe(50); // (9+1) covered of 20 total
  });

  it("empty input → 100% total, no files", () => {
    const s = summarizeCoverage([]);
    expect(s.perFile).toEqual([]);
    expect(s.totalPct).toBe(100);
    expect(s.uncovered).toEqual([]);
  });
});
