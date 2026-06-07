/**
 * Merge two istanbul coverage-final.json files (Vitest pure + Quench in-Foundry)
 * into one combined report. Normalizes file keys so the two runtimes' entries
 * align, prints a text summary + per-file table to stdout, and writes lcov + html
 * to coverage/combined/. Report-only (always exits 0).
 *
 * Usage: node tools/ci/merge-coverage.mjs <vitest-final.json> <quench-final.json>
 */
import { readFileSync } from "node:fs";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import { normalizeCoverageKey } from "./coverage-paths.mjs";
import { evaluateCoverageGate } from "./coverage-gate.mjs";

const { createCoverageMap, createCoverageSummary } = libCoverage;
const { createContext } = libReport;

function loadNormalized(path) {
  if (!path) return {};
  let data;
  try { data = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { console.error(`(coverage) could not read ${path}: ${e.message}`); return {}; }
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    const nk = normalizeCoverageKey(k);
    out[nk] = { ...v, path: nk };
  }
  return out;
}

const [, , vitestPath, quenchPath] = process.argv;

const vitestCov = loadNormalized(vitestPath);
const quenchCov = loadNormalized(quenchPath);
const complete  = Object.keys(vitestCov).length > 0 && Object.keys(quenchCov).length > 0;

const map = createCoverageMap({});
map.merge(createCoverageMap(vitestCov));
map.merge(createCoverageMap(quenchCov));

// Guard the all-empty case: istanbul reports 100% for a zero-total summary,
// which would masquerade as full coverage if both inputs were missing.
if (map.files().length === 0) {
  console.warn("(coverage) no coverage inputs found — both Vitest and Quench coverage were empty/missing.");
  process.exit(0);
}

const total = createCoverageSummary();
const rows = [];
for (const file of map.files()) {
  const s = map.fileCoverageFor(file).toSummary();
  total.merge(s);
  rows.push({ file, pct: s.lines.pct });
}
rows.sort((a, b) => a.pct - b.pct);

console.log(
  `Combined coverage — lines ${total.lines.pct}%, statements ${total.statements.pct}%, ` +
  `functions ${total.functions.pct}%, branches ${total.branches.pct}% (${map.files().length} files)`
);
console.log("Per-file (lines %, worst-first):");
for (const r of rows) console.log(`  ${String(r.pct).padStart(5)}%  ${r.file}`);

try {
  const ctx = createContext({ dir: "coverage/combined", coverageMap: map });
  reports.create("lcovonly").execute(ctx);
  reports.create("html").execute(ctx);
} catch (e) {
  console.error(`(coverage) report write failed: ${e.message}`);
}

const gate = evaluateCoverageGate({
  floor:    process.env.COVERAGE_MIN_LINES,
  linesPct: total.lines.pct,
  complete,
});
console.log(gate.message);
process.exit(gate.exitCode);
