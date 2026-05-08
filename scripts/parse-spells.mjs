#!/usr/bin/env node
// scripts/parse-spells.mjs
// Parses sorcery-2-white.txt, sorcery-2-black.txt, and mop-alchemicals.txt
// to populate src/packs/spells/ with JSON files.
//
// Usage: node scripts/parse-spells.mjs [--dry-run]

import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const OUT = 'src/packs/spells';
if (!DRY_RUN) mkdirSync(OUT, { recursive: true });

// ── Deterministic ID (FNV-1a 32-bit doubled to 16 hex chars) ─────────────────
function deterministicId(str) {
  let h = 2166136261n;
  for (const c of str) {
    h ^= BigInt(c.charCodeAt(0));
    h = BigInt.asUintN(32, h * 16777619n);
  }
  const lo = h.toString(16).padStart(8, '0');
  let h2 = h ^ 0xdeadbeefn;
  h2 = BigInt.asUintN(32, h2 * 16777619n);
  const hi = h2.toString(16).padStart(8, '0');
  return (hi + lo).slice(0, 16);
}

function stats() {
  return { coreVersion: '13', systemId: 'exalted2e', systemVersion: '1.0.0', createdTime: 0, modifiedTime: 0, lastModifiedBy: null };
}

// ── Folder setup ──────────────────────────────────────────────────────────────

const TRAD_COLORS = { sorcery: '#806020', necromancy: '#503050', weaving: '#304060' };
const CIRCLES = {
  sorcery:   [{ circle: 1, label: 'Terrestrial Circle' }, { circle: 2, label: 'Celestial Circle' }, { circle: 3, label: 'Solar Circle' }],
  necromancy:[{ circle: 1, label: 'Shadowlands Circle' }, { circle: 2, label: 'Labyrinth Circle' }, { circle: 3, label: 'Void Circle' }],
  weaving:   [{ circle: 1, label: 'Man-Machine Protocol' }, { circle: 2, label: 'God-Machine Protocol' }],
};

const tradIds = {};
for (const trad of Object.keys(CIRCLES)) tradIds[trad] = deterministicId(`folder-tradition-${trad}`);

const circleIds = {};
for (const [trad, circles] of Object.entries(CIRCLES)) {
  circleIds[trad] = {};
  for (const { circle, label } of circles) circleIds[trad][circle] = deterministicId(`folder-${trad}-${label}`);
}

// ── Cost parsing ──────────────────────────────────────────────────────────────

function parseCost(costStr) {
  // Attempt to extract motes and willpower from the Cost: field
  const moteMatch = costStr.match(/(\d+)\s*m\b/i);
  const motes = moteMatch ? parseInt(moteMatch[1]) : 0;
  const wpMatch = costStr.match(/(\d+)\s*wp\b|,\s*1wp\b|\s+1wp\b/i);
  const willpower = wpMatch ? 1 : 0;
  const lhlMatch = costStr.match(/(\d+)lhl|,\s*1lhl/i);
  const lethal = lhlMatch ? (parseInt(lhlMatch[1] || '1')) : 0;
  return { motes, willpower, bashingHealth: 0, lethalHealth: lethal, aggravatedHealth: 0, xp: 0 };
}

// ── Duration inference ────────────────────────────────────────────────────────

const DUR_PATTERNS = [
  [/\binstant\b/i,                           'instant'],
  [/\bone\s+scene\b/i,                        'one scene'],
  [/\buntil\s+(?:the\s+)?(?:next\s+)?(?:dawn|dusk|sunrise|sunset)\b/i, 'one day'],
  [/\bone\s+full?\s+day\b|\bone\s+day\b/i,   'one day'],
  [/\bone\s+month\b/i,                        'one month'],
  [/\bone\s+year\b|\byear\s+and\s+a\s+day\b/i,'one year'],
  [/\bpermanent\b/i,                          'permanent'],
  [/\bcommit(?:ted)?\b/i,                     'indefinite (committed)'],
  [/\bindefinite\b/i,                         'indefinite'],
  [/\bone\s+hour\b/i,                         'one hour'],
  [/\bone\s+day\s+or\s+until\b/i,            'one day'],
];

function inferDuration(desc) {
  for (const [re, label] of DUR_PATTERNS) {
    if (re.test(desc)) return label;
  }
  return '';
}

// ── Target extraction from cost line ─────────────────────────────────────────

function parseTarget(costLine) {
  const m = costLine.match(/Target:\s*(.+?)(?:\s+Minimum Clarity|$)/i);
  return m ? m[1].trim() : '';
}

// ── Minimum Clarity extraction ────────────────────────────────────────────────

function parseClarity(costLine) {
  const m = costLine.match(/Minimum Clarity:\s*(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

// ── Spell name → UID ──────────────────────────────────────────────────────────

function toUid(tradition, circle, name) {
  const circleLabel = CIRCLES[tradition][circle - 1].label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${circleLabel}-${slug}`;
}

// ── Text → clean HTML ─────────────────────────────────────────────────────────

function toHtml(text) {
  // Clean up PDF artifacts: double-letter words like CCHHAAPPTTEERR
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();
  // Split into paragraphs at double newlines (already collapsed)
  // Since we already collapsed spaces, split on sentence-ish breaks
  const paras = cleaned.split(/\n\n/).filter(p => p.trim().length > 10);
  if (paras.length === 0 && cleaned.length > 0) return `<p>${cleaned}</p>`;
  return paras.map(p => `<p>${p.trim().replace(/\n/g, ' ')}</p>`).join('\n');
}

// ── Generic spell block parser ────────────────────────────────────────────────
// Returns spells with their costLineIdx so callers can assign circles correctly.

function parseSpellBlocks(text, requireClarity = false) {
  const lines = text.split('\n');
  const spells = [];

  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s.startsWith('Cost:')) continue;
    if (!s.includes('Target:')) continue;
    if (requireClarity && !s.includes('Minimum Clarity')) continue;
    if (!requireClarity && s.includes('Minimum Clarity')) continue;

    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j--;
    if (j < 0) continue;
    const nameLine = lines[j].trim();
    if (nameLine.length > 120) continue;
    if (!/^[A-Z0-9][A-Z0-9'\s\-,'.()]+$/.test(nameLine)) continue;

    const costLine = s;
    const costLineIdx = i;

    // Find end of description: next spell boundary
    let endIdx = lines.length;
    for (let m = i + 1; m < lines.length; m++) {
      const ms = lines[m].trim();
      if (!ms.startsWith('Cost:') || !ms.includes('Target:')) continue;
      if (requireClarity && !ms.includes('Minimum Clarity')) continue;
      if (!requireClarity && ms.includes('Minimum Clarity')) continue;
      let n = m - 1;
      while (n >= 0 && !lines[n].trim()) n--;
      if (n < 0) continue;
      const nl = lines[n].trim();
      if (nl.length < 120 && /^[A-Z0-9][A-Z0-9'\s\-,'.()]+$/.test(nl)) {
        endIdx = n;
        break;
      }
    }

    const descLines = [];
    for (let m = i + 1; m < endIdx; m++) {
      const ml = lines[m].trim();
      if (/^\d+$/.test(ml)) continue;
      if (/^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|\d+)/i.test(ml)) continue;
      descLines.push(lines[m]);
    }

    const descText = descLines.join('\n').trim();
    spells.push({ name: nameLine, costLine, costLineIdx, descText });
  }

  return spells;
}

// ── Parse White Treatise (sorcery) ───────────────────────────────────────────

function parseWhiteTreatise() {
  const text = readFileSync('docs/_extraction/sorcery-2-white.txt', 'utf-8');
  const lines = text.split('\n');

  const boundaries = [{ circle: 1, start: 0 }];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (/^THE CELESTIAL CIRCLE OF SAPPHIRE$/i.test(s)) boundaries.push({ circle: 2, start: i });
    else if (/^THE SOLAR CIRCLE OF ADAMANT$/i.test(s)) boundaries.push({ circle: 3, start: i });
  }

  const blocks = parseSpellBlocks(text, false);
  const spells = [];
  for (const { name, costLine, costLineIdx, descText } of blocks) {
    let circle = 1;
    for (const b of boundaries) {
      if (costLineIdx >= b.start) circle = b.circle;
    }
    spells.push({
      uid: toUid('sorcery', circle, name),
      name: toTitleCase(name), tradition: 'sorcery', circle,
      minimumClarity: 0, cost: parseCost(costLine),
      target: parseTarget(costLine), duration: inferDuration(descText),
      description: toHtml(descText),
    });
  }
  return spells;
}

// ── Parse Black Treatise (necromancy) ────────────────────────────────────────

function parseBlackTreatise() {
  const text = readFileSync('docs/_extraction/sorcery-2-black.txt', 'utf-8');
  const lines = text.split('\n');

  const boundaries = [{ circle: 1, start: 0 }];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (/^THE LABYRINTH CIRCLE OF ONYX$/i.test(s)) boundaries.push({ circle: 2, start: i });
    else if (/^THE VOID CIRCLE OF OBSIDIAN$/i.test(s)) boundaries.push({ circle: 3, start: i });
  }

  const blocks = parseSpellBlocks(text, false);
  const spells = [];
  for (const { name, costLine, costLineIdx, descText } of blocks) {
    let circle = 1;
    for (const b of boundaries) {
      if (costLineIdx >= b.start) circle = b.circle;
    }
    spells.push({
      uid: toUid('necromancy', circle, name),
      name: toTitleCase(name), tradition: 'necromancy', circle,
      minimumClarity: 0, cost: parseCost(costLine),
      target: parseTarget(costLine), duration: inferDuration(descText),
      description: toHtml(descText),
    });
  }
  return spells;
}

// ── Parse Alchemicals MoP (weaving protocols) ─────────────────────────────────

function parseAlchemicals() {
  const text = readFileSync('docs/_extraction/mop-alchemicals.txt', 'utf-8');
  const lines = text.split('\n');

  const boundaries = [{ circle: 0, start: 0 }];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (/^MAN-MACHINE PROTOCOLS\b/i.test(s)) boundaries.push({ circle: 1, start: i });
    else if (/^GOD-MACHINE PROTOCOLS\b/i.test(s)) boundaries.push({ circle: 2, start: i });
  }

  const blocks = parseSpellBlocks(text, true); // requireClarity = true
  const spells = [];
  for (const { name, costLine, costLineIdx, descText } of blocks) {
    let circle = 0;
    for (const b of boundaries) {
      if (costLineIdx >= b.start) circle = b.circle;
    }
    if (circle === 0) continue;
    spells.push({
      uid: toUid('weaving', circle, name),
      name: toTitleCase(name), tradition: 'weaving', circle,
      minimumClarity: parseClarity(costLine), cost: parseCost(costLine),
      target: parseTarget(costLine), duration: inferDuration(descText),
      description: toHtml(descText),
    });
  }
  return spells;
}

// ── Title case ────────────────────────────────────────────────────────────────

const SMALL = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as']);
function toTitleCase(str) {
  return str.toLowerCase().split(' ').map((w, i) => {
    if (i === 0 || !SMALL.has(w)) return w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  }).join(' ');
}

// ── Write output ──────────────────────────────────────────────────────────────

function buildDoc(spell) {
  const folderId = circleIds[spell.tradition]?.[spell.circle];
  const id = deterministicId(`spell-${spell.uid}`);
  return {
    _id: id,
    _key: `!items!${id}`,
    _stats: stats(),
    name: spell.name,
    type: 'spell',
    img: '',
    system: {
      spellUid: spell.uid,
      tradition: spell.tradition,
      circle: spell.circle,
      minimumClarity: spell.minimumClarity,
      cost: spell.cost,
      duration: spell.duration,
      target: spell.target,
      description: spell.description,
    },
    folder: folderId ?? null,
    ownership: { default: 0 },
    flags: {},
  };
}

function writeFolders() {
  for (const [trad, tradId] of Object.entries(tradIds)) {
    const label = trad.charAt(0).toUpperCase() + trad.slice(1);
    const doc = { _id: tradId, _key: `!folders!${tradId}`, _stats: stats(), name: label, type: 'Item', folder: null, sorting: 'a', color: TRAD_COLORS[trad], flags: {} };
    if (!DRY_RUN) writeFileSync(join(OUT, `_folder-${trad}.json`), JSON.stringify(doc, null, 2), 'utf-8');
  }
  for (const [trad, circles] of Object.entries(CIRCLES)) {
    for (const { circle, label } of circles) {
      const id = circleIds[trad][circle];
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const doc = { _id: id, _key: `!folders!${id}`, _stats: stats(), name: label, type: 'Item', folder: tradIds[trad], sorting: 'a', color: TRAD_COLORS[trad], flags: {} };
      if (!DRY_RUN) writeFileSync(join(OUT, `_folder-${trad}-${slug}.json`), JSON.stringify(doc, null, 2), 'utf-8');
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const allSpells = [
  ...parseWhiteTreatise(),
  ...parseBlackTreatise(),
  ...parseAlchemicals(),
];

// Deduplicate by UID (keep first occurrence)
const seen = new Set();
const deduped = allSpells.filter(s => {
  if (seen.has(s.uid)) return false;
  seen.add(s.uid);
  return true;
});

if (DRY_RUN) {
  console.log(`\nDRY RUN — would write ${deduped.length} spells:\n`);
  const byCat = {};
  for (const s of deduped) {
    const key = `${s.tradition} ${s.circle}`;
    if (!byCat[key]) byCat[key] = [];
    byCat[key].push(s.name);
  }
  for (const [cat, names] of Object.entries(byCat)) {
    console.log(`  [${cat}] (${names.length})`);
    for (const n of names) console.log(`    - ${n}`);
  }
} else {
  // Wipe existing spell JSONs (not folder docs)
  for (const f of readdirSync(OUT).filter(f => !f.startsWith('_') && f.endsWith('.json'))) {
    unlinkSync(join(OUT, f));
  }
  writeFolders();
  let written = 0;
  for (const spell of deduped) {
    const doc = buildDoc(spell);
    writeFileSync(join(OUT, `${spell.uid}.json`), JSON.stringify(doc, null, 2), 'utf-8');
    written++;
  }
  console.log(`Written ${written} spells + folder docs to ${OUT}/`);
  const byCat = {};
  for (const s of deduped) {
    const key = `${s.tradition} circle ${s.circle}`;
    byCat[key] = (byCat[key] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCat)) console.log(`  ${cat}: ${count}`);
}
