/**
 * Transform a Quench/mocha JSON report into a CI-friendly summary + exit code.
 * Pure — no I/O, no globals. The orchestrator reads quench-report.json and
 * passes the parsed object here.
 *
 * Treats null/empty/malformed input and zero-tests-run as FAILURE so a broken
 * Foundry boot can never pass CI silently.
 *
 * @param {object|null} raw  Parsed mocha JSON report.
 * @returns {{ total:number, passes:number, pending:number, failures:number,
 *            failedTests:{title:string,error:string}[], summary:string, exitCode:number }}
 */
export function parseQuenchResults(raw) {
  const stats = raw?.stats ?? {};
  const total    = Number.isFinite(stats.tests)    ? stats.tests    : 0;
  const passes   = Number.isFinite(stats.passes)   ? stats.passes   : 0;
  const pending  = Number.isFinite(stats.pending)  ? stats.pending  : 0;
  const failures = Number.isFinite(stats.failures) ? stats.failures : 0;

  const failedTests = Array.isArray(raw?.failures)
    ? raw.failures.map(f => ({
        title: f.fullTitle ?? f.title ?? "(unknown)",
        error: f.err?.message ?? "",
      }))
    : [];

  const ranSomething = total > 0;
  const exitCode = (!ranSomething || failures > 0) ? 1 : 0;

  const summary =
    `Quench: ${passes} passed, ${failures} failed, ${pending} pending ` +
    `(of ${total} tests)` +
    (failedTests.length
      ? "\n" + failedTests.map(t => `  ✗ ${t.title}${t.error ? ` — ${t.error}` : ""}`).join("\n")
      : "");

  return { total, passes, pending, failures, failedTests, summary, exitCode };
}
