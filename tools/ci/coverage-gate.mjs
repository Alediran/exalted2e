/**
 * Pure decision for the combined-coverage regression gate. Lines-only floor.
 *
 * @param {object} args
 * @param {string|number|undefined|null} args.floor  COVERAGE_MIN_LINES (string env); empty/non-numeric → gate off
 * @param {number}  args.linesPct                     combined line coverage percentage
 * @param {boolean} args.complete                     true only when BOTH coverage inputs had files
 * @returns {{ status: "off"|"skip"|"pass"|"fail", exitCode: 0|1, message: string }}
 */
export function evaluateCoverageGate({ floor, linesPct, complete } = {}) {
  const f = Number(floor);
  if (floor === undefined || floor === null || floor === "" || Number.isNaN(f)) {
    return { status: "off", exitCode: 0, message: "(coverage gate) off — set COVERAGE_MIN_LINES to enforce a line-coverage floor." };
  }
  if (!complete) {
    return { status: "skip", exitCode: 0, message: `(coverage gate) skipped — a source job's coverage was missing; not enforcing the ${f}% line floor.` };
  }
  if (linesPct < f) {
    return { status: "fail", exitCode: 1, message: `(coverage gate) ✗ regression: lines ${linesPct}% < floor ${f}%` };
  }
  return { status: "pass", exitCode: 0, message: `(coverage gate) ✓ lines ${linesPct}% >= floor ${f}%` };
}
