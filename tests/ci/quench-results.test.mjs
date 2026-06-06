import { describe, it, expect } from "vitest";
import { parseQuenchResults } from "../../tools/ci/quench-results.mjs";

const passReport = {
  stats: { tests: 3, passes: 3, pending: 0, failures: 0, duration: 12 },
  failures: [],
};
const failReport = {
  stats: { tests: 3, passes: 1, pending: 1, failures: 1, duration: 9 },
  failures: [
    { title: "does X", fullTitle: "Batch A does X", err: { message: "boom" } },
  ],
};

describe("parseQuenchResults", () => {
  it("all-pass → exitCode 0 and correct counts", () => {
    const r = parseQuenchResults(passReport);
    expect(r.total).toBe(3);
    expect(r.passes).toBe(3);
    expect(r.failures).toBe(0);
    expect(r.exitCode).toBe(0);
    expect(r.failedTests).toEqual([]);
  });

  it("some-fail → exitCode 1 and failedTests populated", () => {
    const r = parseQuenchResults(failReport);
    expect(r.failures).toBe(1);
    expect(r.pending).toBe(1);
    expect(r.exitCode).toBe(1);
    expect(r.failedTests).toEqual([{ title: "Batch A does X", error: "boom" }]);
  });

  it("includes a human-readable summary string", () => {
    expect(parseQuenchResults(passReport).summary).toContain("3 passed");
    expect(parseQuenchResults(failReport).summary).toContain("1 failed");
  });

  it("null / empty / missing-stats → exitCode 1 (treat as failure)", () => {
    expect(parseQuenchResults(null).exitCode).toBe(1);
    expect(parseQuenchResults({}).exitCode).toBe(1);
    expect(parseQuenchResults({ stats: {} }).exitCode).toBe(1);
  });

  it("zero tests run → exitCode 1 (broken boot must not pass)", () => {
    const r = parseQuenchResults({ stats: { tests: 0, passes: 0, pending: 0, failures: 0 }, failures: [] });
    expect(r.exitCode).toBe(1);
  });

  it("failure with missing err message → empty error string, still counted", () => {
    const r = parseQuenchResults({ stats: { tests: 1, passes: 0, pending: 0, failures: 1 }, failures: [{ fullTitle: "B t" }] });
    expect(r.failedTests).toEqual([{ title: "B t", error: "" }]);
    expect(r.exitCode).toBe(1);
  });
});
