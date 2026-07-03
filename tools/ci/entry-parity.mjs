/**
 * Entry-split parity harness. Two checks across module/exalted2e.mjs +
 * module/setup/ + module/hooks/:
 *   1. Hook multiset: Hooks.on/once("event"...) counts per event.
 *   2. Dangling helpers: every bare `_fn(` call in a file is defined or imported there.
 * Usage:
 *   node tools/ci/entry-parity.mjs baseline   # writes tools/ci/.entry-baseline.json
 *   node tools/ci/entry-parity.mjs check      # compares current vs baseline, exits 1 on drift
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES = [];
function collect(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p);
    else if (e.name.endsWith(".mjs")) FILES.push(p);
  }
}
collect(path.join(ROOT, "module", "setup"));
collect(path.join(ROOT, "module", "hooks"));
FILES.push(path.join(ROOT, "module", "exalted2e.mjs"));

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function hookMultiset() {
  const counts = {};
  for (const f of FILES) {
    if (!fs.existsSync(f)) continue;
    const txt = strip(fs.readFileSync(f, "utf8"));
    for (const m of txt.matchAll(/Hooks\.(?:on|once)\(\s*["'`]([^"'`]+)["'`]/g)) {
      counts[m[1]] = (counts[m[1]] || 0) + 1;
    }
  }
  return counts;
}

function danglingHelpers() {
  const offenders = [];
  for (const f of FILES) {
    if (!fs.existsSync(f)) continue;
    const txt = strip(fs.readFileSync(f, "utf8"));
    const defined = new Set([
      ...[...txt.matchAll(/function\s+(_[A-Za-z]\w*)/g)].map(m => m[1]),
      ...[...txt.matchAll(/(?:const|let|var)\s+(_[A-Za-z]\w*)\s*=/g)].map(m => m[1]),
    ]);
    const imported = new Set();
    // static imports `import { a, b } from ...` AND dynamic destructured
    // `const { a, b } = await import(...)`
    for (const m of txt.matchAll(/(?:import\s*\{|(?:const|let|var)\s*\{)([^}]*)\}/g)) {
      for (const n of m[1].split(",")) { const nm = n.trim().split(/[:\s]+as\s+|\s*:\s*/).pop().trim(); if (nm) imported.add(nm); }
    }
    for (const m of txt.matchAll(/(?<![.\w])(_[A-Za-z]\w*)\s*\(/g)) {
      const name = m[1];
      if (!defined.has(name) && !imported.has(name)) offenders.push(`${path.relative(ROOT, f)}: ${name}() not defined or imported`);
    }
  }
  return [...new Set(offenders)];
}

const BASE = path.join(ROOT, "tools", "ci", ".entry-baseline.json");
const mode = process.argv[2];
const current = { hooks: hookMultiset() };
if (mode === "baseline") {
  fs.writeFileSync(BASE, JSON.stringify(current, null, 2));
  console.log("baseline written:", Object.keys(current.hooks).length, "events,", Object.values(current.hooks).reduce((a, b) => a + b, 0), "registrations");
} else {
  const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
  const drift = [];
  const events = new Set([...Object.keys(base.hooks), ...Object.keys(current.hooks)]);
  for (const ev of events) if ((base.hooks[ev] || 0) !== (current.hooks[ev] || 0)) drift.push(`${ev}: baseline ${base.hooks[ev] || 0} -> now ${current.hooks[ev] || 0}`);
  const dangling = danglingHelpers();
  if (drift.length) console.error("HOOK DRIFT:\n  " + drift.join("\n  "));
  if (dangling.length) console.error("DANGLING HELPERS:\n  " + dangling.join("\n  "));
  if (drift.length || dangling.length) process.exit(1);
  console.log("parity OK:", Object.values(current.hooks).reduce((a, b) => a + b, 0), "hook registrations, no dangling helpers");
}
