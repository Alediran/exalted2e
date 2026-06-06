/**
 * Pure V8-coverage filtering + summarizing for the system modules. No I/O.
 * Input entries are Playwright page.coverage.stopJSCoverage() objects:
 *   { url, source, functions: [{ ranges: [{ startOffset, endOffset, count }] }] }
 */

const DEFAULT_FRAGMENT = "systems/exalted2e/module/";

export function filterSystemCoverage(entries, { systemPathFragment = DEFAULT_FRAGMENT } = {}) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(e => typeof e?.url === "string" && e.url.includes(systemPathFragment));
}

/** Covered byte count = size of the union of all ranges with count > 0. */
function coveredBytes(entry) {
  const len = entry?.source?.length ?? 0;
  if (!len) return { covered: 0, total: 0 };
  const hit = new Uint8Array(len);
  for (const fn of entry.functions ?? []) {
    for (const r of fn.ranges ?? []) {
      if (r.count > 0) {
        const start = Math.max(0, r.startOffset ?? 0);
        const end   = Math.min(len, r.endOffset ?? 0);
        for (let i = start; i < end; i++) hit[i] = 1;
      }
    }
  }
  let covered = 0;
  for (let i = 0; i < len; i++) if (hit[i]) covered++;
  return { covered, total: len };
}

export function summarizeCoverage(filteredEntries) {
  const entries = Array.isArray(filteredEntries) ? filteredEntries : [];
  let totalCovered = 0;
  let totalBytes = 0;

  const perFile = entries.map(e => {
    const { covered, total } = coveredBytes(e);
    totalCovered += covered;
    totalBytes   += total;
    const pct = total === 0 ? 100 : Math.round((covered / total) * 100);
    return { url: e.url, pct, coveredBytes: covered, totalBytes: total };
  });

  const totalPct = totalBytes === 0 ? 100 : Math.round((totalCovered / totalBytes) * 100);
  const uncovered = perFile
    .filter(f => f.pct < 100)
    .sort((a, b) => a.pct - b.pct)
    .map(f => f.url);

  return { perFile, totalPct, uncovered };
}
