#!/usr/bin/env node
/**
 * audit-cost-formulas.mjs
 *
 * For each charm JSON in src/packs/charms/, finds the raw "Cost:" string in
 * docs/_extraction/ book text, normalises it to DSL format, and runs
 * parseCostFormula to check if the parser handles it.
 *
 * Usage:
 *   node scripts/audit-cost-formulas.mjs [--verbose]
 *
 * Output: console report of OK / FAIL / NOTFOUND per charm, plus summary.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Inline parseCostFormula to avoid Foundry globals — just the pure logic.
// (Kept as a minimal copy so the script is self-contained and runnable in Node.)
function _zeroCost() {
  return {
    motes: 0, committed: false, moteVar: null,
    willpower: 0, lethalHealth: 0, bashingHealth: 0, aggravatedHealth: 0,
    xp: 0, permanentEssence: 0, permanentWillpower: 0, promise: 0, surcharge: null,
  };
}
function _resolveQty(q) {
  if (/^\d+$/.test(q)) return parseInt(q, 10);
  return 0;
}
function _splitItems(str) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(str.slice(start, i)); start = i + 1; }
  }
  parts.push(str.slice(start));
  return parts;
}
function _splitOnOr(str) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < str.length - 3; i++) {
    const c = str[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && str.slice(i, i + 4) === ' or ') { parts.push(str.slice(start, i)); start = i + 4; i += 3; }
  }
  parts.push(str.slice(start));
  return parts;
}
function _hasTierSep(str) {
  let depth = 0;
  for (let i = 0; i < str.length - 3; i++) {
    const c = str[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && str.slice(i, i + 4) === ' or ') return true;
  }
  return false;
}
function _parseMoteItem(item, result) {
  if (_hasTierSep(item)) {
    const opts = _splitOnOr(item);
    const tiers = opts.map(o => {
      const m = /^(\d+)m(?:\s*\(([^)]+)\))?$/.exec(o.trim());
      if (!m) return null;
      return { moteCost: parseInt(m[1], 10), label: m[2]?.trim() ?? '' };
    });
    if (tiers.some(t => t === null)) return false;
    result.moteVar = { type: 'tiered', tiers };
    return true;
  }
  const puM = /^(?:(@?\w+)\s*m\s*\+\s*)?(\d+)m\/(\d+\s+)?(\w+(?:[\s\-]\w+)*)(?:\s*\((@?\w[\w.]*)\))?(?:\s*\[committed\])?$/i.exec(item);
  if (puM) {
    const base  = puM[1] ? _resolveQty(puM[1]) : 0;
    const rate  = parseInt(puM[2], 10);
    const rateN = puM[3] ? parseInt(puM[3].trim(), 10) : 1;
    const unit  = puM[4];
    result.motes += base;
    result.moteVar = { type: 'perUnit', rate, rateN, unit, min: 0, maxResolved: null, committed: false };
    return true;
  }
  const oeM = /^(\d+)\s*m\+$/i.exec(item);
  if (oeM) { result.motes += parseInt(oeM[1], 10); result.moteVar = { type: 'openEnded', committed: false }; return true; }
  const fxM = /^(@?\w+|\d+)\s*m(?:\s*\[committed\])?$/i.exec(item);
  if (fxM) { result.motes += _resolveQty(fxM[1]); return true; }
  return false;
}
function _parseItem(item, result) {
  const s = item.trim();
  const wpM = /^(\d+)wp$/i.exec(s);
  if (wpM) { result.willpower += parseInt(wpM[1], 10); return true; }
  const hlM = /^(\d+)(lhl|bhl|ahl|hl)$/i.exec(s);
  if (hlM) {
    const n = parseInt(hlM[1], 10);
    const t = hlM[2].toLowerCase();
    if (t === 'lhl' || t === 'hl') result.lethalHealth += n;
    else if (t === 'bhl') result.bashingHealth += n;
    else result.aggravatedHealth += n;
    return true;
  }
  const xpM = /^(\d+)xp$/i.exec(s);
  if (xpM) { result.xp += parseInt(xpM[1], 10); return true; }
  const promM = /^(\d+)p$/i.exec(s);
  if (promM) { result.promise += parseInt(promM[1], 10); return true; }
  const permM = /^perm\s+(ess|essence|wp|willpower)$/i.exec(s);
  if (permM) {
    const k = permM[1].toLowerCase();
    if (k === 'ess' || k === 'essence') result.permanentEssence++;
    else result.permanentWillpower++;
    return true;
  }
  return _parseMoteItem(s, result);
}
function parseCostFormula(formula) {
  if (!formula || typeof formula !== 'string') return _zeroCost();
  const f = formula.trim();
  if (!f || f === '—') return _zeroCost();
  const surchargeM = /^—\((.+)\)$/.exec(f);
  if (surchargeM) {
    const opts = _splitOnOr(surchargeM[1]).map(opt => {
      opt = opt.trim();
      let relative = false;
      if (opt.startsWith('+')) { relative = true; opt = opt.slice(1).trim(); }
      const inner = _zeroCost();
      for (const it of _splitItems(opt)) _parseItem(it, inner);
      return { label: opt || null, condition: null, conditionMet: false, relative, cost: inner };
    });
    return { ..._zeroCost(), surcharge: opts };
  }
  const result = _zeroCost();
  for (const item of _splitItems(f)) {
    if (!_parseItem(item, result)) return null;
  }
  return result;
}

// ── Extraction file → source label map ───────────────────────────────────────

const EXTRACTION_DIR = join(ROOT, 'docs', '_extraction');

// Read one text file, return as string (or '' if missing).
function readText(filename) {
  try { return readFileSync(join(EXTRACTION_DIR, filename), 'utf8'); }
  catch { return ''; }
}

// ── Build charm-name → raw cost-string map from one extraction file ───────────

const HEADER_RE = /^Cost:\s*([^;]+);\s*Mins:/i;

function isAllCapsName(line) {
  const t = line.trim();
  if (t.length < 3) return false;
  // Allow letters, spaces, hyphens, apostrophes, parentheses — all uppercase
  return /^[A-Z][A-Z\s\-',()]+$/.test(t) && /[A-Z]{2}/.test(t);
}

function isPageNoise(line) {
  const t = line.trim();
  return !t || /^\d{1,4}$/.test(t) || /^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)/i.test(t);
}

/**
 * Scan the text and return a Map of normalised charm name → raw cost string.
 * The book format is:
 *   CHARM NAME           ← one or more ALL-CAPS lines
 *   Cost: X; Mins: ...   ← stat block (may be joined across lines)
 */
function buildCostMap(text) {
  const lines = text.split('\n');
  const map = new Map();

  // Pre-process: join partial header lines (Cost: ... Type: ... split across lines)
  const PARTIAL_RE = /^Cost:\s*[^;]+;\s*Mins:\s*[^;]+;\s*Type:/i;
  for (let i = 0; i < lines.length; i++) {
    if (PARTIAL_RE.test(lines[i]) && !HEADER_RE.test(lines[i])) {
      let j = i + 1;
      while (j < Math.min(i + 8, lines.length)) {
        const next = lines[j].trim();
        if (!next || /^\d+$/.test(next)) { j++; continue; }
        lines[i] = lines[i].trimEnd() + ' ' + next;
        lines[j] = '';
        if (HEADER_RE.test(lines[i])) break;
        j++;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADER_RE);
    if (!m) continue;
    const rawCost = m[1].trim();

    // Collect ALL-CAPS name lines immediately before this cost line.
    const nameLines = [];
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (isPageNoise(lines[j])) continue;
      if (isAllCapsName(lines[j])) {
        nameLines.unshift(lines[j].trim());
      } else {
        break;
      }
    }
    if (nameLines.length === 0) continue;
    const rawName = nameLines.join(' ');
    const key = normKey(rawName);
    if (!map.has(key)) map.set(key, rawCost);
  }

  return map;
}

function normKey(name) {
  return name.toUpperCase().replace(/\s+/g, ' ').trim();
}

// ── Build global cost map from all extraction files ───────────────────────────

function buildGlobalCostMap() {
  const allFiles = readdirSync(EXTRACTION_DIR).filter(f => f.endsWith('.txt'));
  const global = new Map();
  for (const file of allFiles) {
    const text = readText(file);
    if (!text) continue;
    const local = buildCostMap(text);
    for (const [k, v] of local) {
      if (!global.has(k)) global.set(k, { cost: v, file });
    }
  }
  return global;
}

// ── Normalise raw book cost string → DSL format ───────────────────────────────

function bookCostToDSL(raw) {
  let s = raw.trim();

  // 1. Strip Alchemical maintenance cost bracket [Xm] at end of string FIRST
  //    so that "-- [1m]" → "--" before dash normalization runs.
  s = s.replace(/\s*\[\d+m\]\s*$/i, '');

  // 2. Collapse unicode dashes / double-hyphens
  s = s.replace(/^(?:--|[–—])\s*\(/, '—(');   // --(X) → —(X)
  s = s.replace(/^(?:--|[–—]+)$/, '—');         // -- or — alone → —

  // 3. Spelled-out "motes": "X motes" or "X mote" → "Xm"
  s = s.replace(/\b(\d+)\s+motes?\b/gi, '$1m');

  // 4. "3+ motes" (open-ended spelled out) → "3m+"
  s = s.replace(/\b(\d+)\+\s+motes?\b/gi, '$1m+');

  // 5. Reversed open-ended: "3+m" → "3m+"
  s = s.replace(/\b(\d+)\+m\b/gi, '$1m+');

  // 6. Reversed willpower: "1+wp" → "1wp"
  s = s.replace(/\b(\d+)\+wp\b/gi, '$1wp');

  // 7. Reversed health: "2+bhl" / "2+lhl" / "2+ahl" → "2bhl" etc.
  s = s.replace(/\b(\d+)\+(bhl|lhl|ahl|hl)\b/gi, '$1$2');

  // 8. Space before "wp": "1 wp" → "1wp"
  s = s.replace(/\b(\d+)\s+wp\b/gi, '$1wp');

  // 9. Space before health abbreviation: "1 hl" → "1hl", "1 lhl" → "1lhl" etc.
  s = s.replace(/\b(\d+)\s+(lhl|bhl|ahl|hl)\b/gi, '$1$2');

  // 10. Standalone "w" for willpower (book abbreviation): "1w" → "1wp"
  //     Only at a word boundary, not already followed by "p".
  s = s.replace(/\b(\d+)w\b(?!p)/gi, '$1wp');

  // 11. Period as compound separator: "5m. 1wp" → "5m, 1wp"
  s = s.replace(/(\d+m)\.\s+/gi, '$1, ');

  // 12. XP cost in parens: "3m (2xp)" → "3m, 2xp"
  s = s.replace(/\s*\((\d+)xp\)/gi, ', $1xp');

  // 13. Optional tiered in parens — ONLY when it's the whole formula: "3m (or 6m)" → "3m or 6m"
  //     Anchored so "15m, 1wp (or 2m)" is NOT changed (compound with embedded optional).
  s = s.replace(/^(\d+m)\s*\(or\s+(\d+m)\)$/i, '$1 or $2');

  // 14. Strip trailing "(optional)" annotation: "4m, 1wp (optional)" → "4m, 1wp"
  s = s.replace(/\s*\(optional\)\s*$/i, '');

  // 15. "None" (literal no-cost keyword) → "—"
  if (/^none$/i.test(s)) s = '—';

  // 16. "Xm + Ywp" (compound with + separator) → "Xm, Ywp"
  //     Only when the right side is a bare willpower cost (not a per-unit).
  s = s.replace(/(\d+m)\s*\+\s*(\d+wp)/gi, '$1, $2');

  // 15. "Xm per [N ]unit" → "Xm/[N ]unit"
  s = s.replace(/(\d+m)\s+per\s+(\d+\s+)?(\w+)/gi, (_m, motes, n, unit) =>
    `${motes}/${n ? n.trim() + ' ' : ''}${unit}`);

  // 16. Normalise whitespace
  s = s.replace(/\s*,\s*/g, ', ').replace(/\s+or\s+/g, ' or ');

  return s.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const CHARMS_DIR = join(ROOT, 'src', 'packs', 'charms');
const verbose = process.argv.includes('--verbose');

function run() {
  console.log('Building cost map from extraction files...');
  const costMap = buildGlobalCostMap();
  console.log(`  Found ${costMap.size} cost entries across all extraction files.\n`);

  const files = readdirSync(CHARMS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_folder'));
  console.log(`Scanning ${files.length} charm JSON files...\n`);

  const results = { ok: [], fail: [], notFound: [] };

  for (const file of files.sort()) {
    let doc;
    try { doc = JSON.parse(readFileSync(join(CHARMS_DIR, file), 'utf8')); }
    catch { console.error(`  ERROR: could not parse ${file}`); continue; }

    const name     = doc.name ?? '';
    const source   = doc.system?.source ?? '';
    const key      = normKey(name);
    const entry    = costMap.get(key);

    if (!entry) {
      results.notFound.push({ file, name, source });
      if (verbose) console.log(`  NOTFOUND  ${name}  (${file})`);
      continue;
    }

    const dsl    = bookCostToDSL(entry.cost);
    const parsed = parseCostFormula(dsl);
    const rec    = { file, name, source, rawCost: entry.cost, dsl, extractionFile: entry.file };

    if (parsed !== null) {
      results.ok.push(rec);
      if (verbose) console.log(`  OK        ${name}  →  "${dsl}"`);
    } else {
      results.fail.push(rec);
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════════════════════');
  console.log('PARSE FAILURES  (formulas the parser cannot handle)');
  console.log('══════════════════════════════════════════════════════════════');
  if (results.fail.length === 0) {
    console.log('  (none)');
  } else {
    // Group by unique (rawCost, dsl) pair to surface distinct grammar gaps
    const uniquePatterns = new Map();
    for (const r of results.fail) {
      const key = r.dsl;
      if (!uniquePatterns.has(key)) uniquePatterns.set(key, []);
      uniquePatterns.get(key).push(r.name);
    }
    for (const [dsl, names] of [...uniquePatterns].sort()) {
      console.log(`\n  DSL:   "${dsl}"`);
      console.log(`  Names: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` (+${names.length - 5} more)` : ''}`);
    }
    console.log();
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('NOT FOUND IN EXTRACTION FILES');
  console.log('══════════════════════════════════════════════════════════════');
  if (results.notFound.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of results.notFound) {
      console.log(`  ${r.name}  [${r.source}]  (${r.file})`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  const total = results.ok.length + results.fail.length + results.notFound.length;
  console.log(`  Total charms:   ${total}`);
  console.log(`  Parse OK:       ${results.ok.length}`);
  console.log(`  Parse FAIL:     ${results.fail.length}`);
  console.log(`  Not in books:   ${results.notFound.length}`);

  if (results.fail.length > 0) {
    process.exitCode = 1;
  }
}

run();
