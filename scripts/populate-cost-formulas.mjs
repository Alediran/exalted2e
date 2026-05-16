#!/usr/bin/env node
/**
 * populate-cost-formulas.mjs
 *
 * Updates every charm JSON in src/packs/charms/ with a `formula` field on
 * system.cost.  Removes all old individual cost fields (motes, willpower, etc.).
 *
 * Formula priority:
 *   1. Book cost string found in docs/_extraction/ AND parses OK → use DSL
 *   2. Book cost string found BUT parse fails → keep raw book string as formula
 *      (parser returns null → activation shows it as display-only text)
 *   3. Not found in extraction files → construct formula from old schema fields
 *
 * Usage:
 *   node scripts/populate-cost-formulas.mjs [--dry-run] [--verbose]
 *
 * --dry-run  : print what would change, write nothing
 * --verbose  : print each charm's formula assignment
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Inline parser (same copy as audit-cost-formulas.mjs) ─────────────────────

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

// ── Extraction parsing (same as audit script) ─────────────────────────────────

const EXTRACTION_DIR = join(ROOT, 'docs', '_extraction');
const HEADER_RE = /^Cost:\s*([^;]+);\s*Mins:/i;

function readText(filename) {
  try { return readFileSync(join(EXTRACTION_DIR, filename), 'utf8'); }
  catch { return ''; }
}

function isAllCapsName(line) {
  const t = line.trim();
  if (t.length < 3) return false;
  return /^[A-Z][A-Z\s\-',()]+$/.test(t) && /[A-Z]{2}/.test(t);
}

function isPageNoise(line) {
  const t = line.trim();
  return !t || /^\d{1,4}$/.test(t) || /^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)/i.test(t);
}

function buildCostMap(text) {
  const lines = text.split('\n');
  const map = new Map();
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
    const nameLines = [];
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (isPageNoise(lines[j])) continue;
      if (isAllCapsName(lines[j])) nameLines.unshift(lines[j].trim());
      else break;
    }
    if (nameLines.length === 0) continue;
    const key = normKey(nameLines.join(' '));
    if (!map.has(key)) map.set(key, rawCost);
  }
  return map;
}

function normKey(name) {
  return name.toUpperCase().replace(/\s+/g, ' ').trim();
}

function buildGlobalCostMap() {
  const allFiles = readdirSync(EXTRACTION_DIR).filter(f => f.endsWith('.txt'));
  const global = new Map();
  for (const file of allFiles) {
    const text = readText(file);
    if (!text) continue;
    for (const [k, v] of buildCostMap(text)) {
      if (!global.has(k)) global.set(k, { cost: v, file });
    }
  }
  return global;
}

// ── Book cost string → DSL (same as audit script) ────────────────────────────

function bookCostToDSL(raw) {
  let s = raw.trim();
  s = s.replace(/\s*\[\d+m\]\s*$/i, '');
  s = s.replace(/^(?:--|[–—])\s*\(/, '—(');
  s = s.replace(/^(?:--|[–—]+)$/, '—');
  s = s.replace(/\b(\d+)\s+motes?\b/gi, '$1m');
  s = s.replace(/\b(\d+)\+\s+motes?\b/gi, '$1m+');
  s = s.replace(/\b(\d+)\+m\b/gi, '$1m+');
  s = s.replace(/\b(\d+)\+wp\b/gi, '$1wp');
  s = s.replace(/\b(\d+)\+(bhl|lhl|ahl|hl)\b/gi, '$1$2');
  s = s.replace(/\b(\d+)\s+wp\b/gi, '$1wp');
  s = s.replace(/\b(\d+)\s+(lhl|bhl|ahl|hl)\b/gi, '$1$2');
  s = s.replace(/\b(\d+)w\b(?!p)/gi, '$1wp');
  s = s.replace(/(\d+m)\.\s+/gi, '$1, ');
  s = s.replace(/\s*\((\d+)xp\)/gi, ', $1xp');
  s = s.replace(/^(\d+m)\s*\(or\s+(\d+m)\)$/i, '$1 or $2');
  s = s.replace(/\s*\(optional\)\s*$/i, '');
  if (/^none$/i.test(s)) s = '—';
  s = s.replace(/(\d+m)\s*\+\s*(\d+wp)/gi, '$1, $2');
  s = s.replace(/(\d+m)\s+per\s+(\d+\s+)?(\w+)/gi, (_m, motes, n, unit) =>
    `${motes}/${n ? n.trim() + ' ' : ''}${unit}`);
  s = s.replace(/\s*,\s*/g, ', ').replace(/\s+or\s+/g, ' or ');
  return s.trim();
}

// ── Construct formula from old structured fields ──────────────────────────────

function legacyCostToFormula(cost) {
  if (!cost) return '';
  const parts = [];
  const m = Number(cost.motes) || 0;
  const wp = Number(cost.willpower) || 0;
  const lhl = Number(cost.lethalHealth) || 0;
  const bhl = Number(cost.bashingHealth) || 0;
  const ahl = Number(cost.aggravatedHealth) || 0;
  const xp = Number(cost.xp) || 0;
  if (m > 0) parts.push(`${m}m`);
  if (wp > 0) parts.push(`${wp}wp`);
  if (lhl > 0) parts.push(`${lhl}lhl`);
  if (bhl > 0) parts.push(`${bhl}bhl`);
  if (ahl > 0) parts.push(`${ahl}ahl`);
  if (xp > 0) parts.push(`${xp}xp`);
  return parts.join(', ');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const CHARMS_DIR = join(ROOT, 'src', 'packs', 'charms');
const DRY_RUN  = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

function run() {
  console.log('Building cost map from extraction files...');
  const costMap = buildGlobalCostMap();
  console.log(`  ${costMap.size} cost entries found.\n`);

  const files = readdirSync(CHARMS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_folder'))
    .sort();

  console.log(`Processing ${files.length} charm JSON files${DRY_RUN ? ' [DRY RUN — no writes]' : ''}...\n`);

  const stats = {
    fromBook:   0,   // DSL from extraction (parsed OK)
    bookRaw:    0,   // DSL from extraction but parse failed; stored as raw display string
    fromLegacy: 0,   // formula built from old fields
    empty:      0,   // no cost at all → ""
    written:    0,
    errors:     0,
  };

  for (const file of files) {
    const filePath = join(CHARMS_DIR, file);
    let doc;
    try { doc = JSON.parse(readFileSync(filePath, 'utf8')); }
    catch (e) { console.error(`  ERROR reading ${file}: ${e.message}`); stats.errors++; continue; }

    const oldCost = doc.system?.cost ?? {};
    const name    = doc.name ?? file;
    const key     = normKey(name);
    const entry   = costMap.get(key);

    let formula;
    let source;

    if (entry) {
      const dsl    = bookCostToDSL(entry.cost);
      const parsed = parseCostFormula(dsl);
      if (parsed !== null) {
        formula = dsl;
        source  = 'book';
        stats.fromBook++;
      } else {
        // Parser can't handle this formula — store the raw book string as the
        // formula so it displays correctly as plain text during activation.
        formula = dsl;
        source  = 'book-raw';
        stats.bookRaw++;
      }
    } else {
      formula = legacyCostToFormula(oldCost);
      source  = formula ? 'legacy' : 'empty';
      if (formula) stats.fromLegacy++;
      else stats.empty++;
    }

    // Build new cost object: keep resonance and limitTrigger, drop everything else.
    const newCost = {
      formula,
      resonance:    oldCost.resonance    ?? 0,
      limitTrigger: oldCost.limitTrigger ?? 0,
    };

    if (VERBOSE) {
      const tag = source.padEnd(9);
      console.log(`  [${tag}] ${name}  →  "${formula}"`);
    }

    if (!DRY_RUN) {
      doc.system.cost = newCost;
      try {
        writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
        stats.written++;
      } catch (e) {
        console.error(`  ERROR writing ${file}: ${e.message}`);
        stats.errors++;
      }
    } else {
      stats.written++;
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`SUMMARY${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total files:          ${files.length}`);
  console.log(`  From book (parsed):   ${stats.fromBook}`);
  console.log(`  From book (raw text): ${stats.bookRaw}`);
  console.log(`  From legacy fields:   ${stats.fromLegacy}`);
  console.log(`  Empty (no cost):      ${stats.empty}`);
  console.log(`  Written:              ${stats.written}`);
  if (stats.errors > 0) console.log(`  Errors:               ${stats.errors}`);
  if (DRY_RUN) console.log('\n  (No files were modified — re-run without --dry-run to apply changes)');
}

run();
