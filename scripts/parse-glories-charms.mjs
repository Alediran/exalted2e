#!/usr/bin/env node
// scripts/parse-glories-charms.mjs
// Parses Glories of the Most High text extractions into charm / MA JSON files.
// Reads docs/_extraction/glories-{luna,maidens,unconquered-sun}.txt
// Writes to src/packs/charms/ and src/packs/martialarts/
// Run: node scripts/parse-glories-charms.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ── Deterministic ID ────────────────────────────────────────────────────────
function deterministicId(str) {
  let h = 2166136261n;
  for (const c of str) { h ^= BigInt(c.charCodeAt(0)); h = BigInt.asUintN(32, h * 16777619n); }
  const lo = h.toString(16).padStart(8, '0');
  let h2 = h ^ 0xdeadbeefn; h2 = BigInt.asUintN(32, h2 * 16777619n);
  const hi = h2.toString(16).padStart(8, '0');
  return (hi + lo).slice(0, 16);
}

function stats() {
  return { coreVersion: '13', systemId: 'exalted2e', systemVersion: '1.0.0', createdTime: 0, modifiedTime: 0, lastModifiedBy: null };
}

// ── Folder IDs ──────────────────────────────────────────────────────────────

// Lunar attribute folders (src/packs/charms/)
const LUNAR_FOLDERS = {
  strength: 'aba1efe8ad0bef8a',
  dexterity: '6d3aed86fa48b120',
  stamina: '956290ccde1dea72',
  charisma: '4e63ba1bd67a09e3',
  manipulation: '7e56afbcd2643f32',
  appearance: '8313b495b23ed35c',
  perception: 'fa2edda343cdd2b0',
  intelligence: '8b05ba7cc3e236b8',
  wits: '03a1efbef258d84f',
};

// Solar ability folders (src/packs/charms/)
const SOLAR_FOLDERS = {
  archery: 'e842a3a532908d8d',
  athletics: '481b58529581316b',
  awareness: '97d4d497443373f8',
  bureaucracy: 'd5862da5783b00ab',
  craft: '461821c707bbdbb0',
  dodge: 'b4b556393b53edae',
  integrity: 'b0a1d89a8f7c4cdb',
  investigation: '404dccadf2c8e04a',
  larceny: 'e2cfe49eaa1f7c53',
  linguistics: '13c99c0e197877e7',
  lore: '5b0108cbcf2feaf4',
  medicine: '05ee3760b1dfb04f',
  melee: 'fd05b302be1cc260',
  occult: '9f789a9f97cf7e28',
  performance: 'e38c83836f199624',
  presence: 'e6b3f42bab7e5717',
  resistance: 'f05b544008eaceb0',
  ride: 'edcc4814a971a872',
  sail: 'dca02b4134c59583',
  socialize: '5da24482e38ff9ae',
  stealth: '07815dca7bd3d3d3',
  survival: '82dbbb60bb2b2c18',
  thrown: 'a5a30fa2e730ff58',
  war: 'd517bd826bc73b9e',
  martialarts: deterministicId('folder-solar-martialarts'),
};

// Sidereal college folder (new, src/packs/charms/)
const SIDEREAL_COLLEGE_FOLDER_ID = deterministicId('folder-sidereal-college');

// MA style folders (src/packs/martialarts/) – crane already exists
const MA_FOLDERS = {
  'White Reaper Style':               deterministicId('folder-ma-white-reaper-style'),
  'Crane Style':                       'c67a8c5f18d732b0',
  'Crystal Chameleon Style':           deterministicId('folder-ma-crystal-chameleon-style'),
  'Sapphire Veil of Passion Style':    deterministicId('folder-ma-sapphire-veil-style'),
  'Arms of the Unconquered Sun Style': deterministicId('folder-ma-arms-unconquered-sun-style'),
};

// MA style exalt type
const MA_EXALT_TYPE = {
  'White Reaper Style':               'lunar',
  'Crane Style':                       'sidereal',
  'Crystal Chameleon Style':           'sidereal',
  'Sapphire Veil of Passion Style':    'sidereal',
  'Arms of the Unconquered Sun Style': 'solar',
};

// ── Attribute / ability name → key ─────────────────────────────────────────
const ATTR_MAP = {
  'Strength':'strength','Dexterity':'dexterity','Stamina':'stamina',
  'Charisma':'charisma','Manipulation':'manipulation','Appearance':'appearance',
  'Perception':'perception','Intelligence':'intelligence','Wits':'wits',
};
const ABILITY_MAP = {
  'Archery':'archery','Athletics':'athletics','Awareness':'awareness',
  'Bureaucracy':'bureaucracy','Craft':'craft','Dodge':'dodge',
  'Integrity':'integrity','Investigation':'investigation','Larceny':'larceny',
  'Linguistics':'linguistics','Lore':'lore','Medicine':'medicine',
  'Melee':'melee','Occult':'occult','Performance':'performance',
  'Presence':'presence','Resistance':'resistance','Ride':'ride',
  'Sail':'sail','Socialize':'socialize','Stealth':'stealth',
  'Survival':'survival','Thrown':'thrown','War':'war',
  'Martial Arts':'martialarts',
};

// ── Parsing helpers ─────────────────────────────────────────────────────────

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Small words that stay lowercase in title case (unless first word)
const LOWERCASE_WORDS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as','is']);

function toTitleCase(str) {
  // Lower-case the whole string first, then capitalize each space-word's first alpha char
  // Also capitalize after hyphens and opening parentheses within a word
  return str.toLowerCase().trim().split(/\s+/).map((word, i) => {
    if (!word) return '';
    const base = word.replace(/[^a-z]/g, '');
    if (i > 0 && LOWERCASE_WORDS.has(base)) return word;
    // Capitalize first letter and any letter immediately following a hyphen or '('
    return word.replace(/(^|[-(\[])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
  }).join(' ');
}

function parseCost(costStr) {
  const result = { motes: 0, willpower: 0, bashingHealth: 0, lethalHealth: 0, aggravatedHealth: 0, xp: 0 };
  const moteMatch = costStr.match(/(\d+)m/);
  if (moteMatch) result.motes = parseInt(moteMatch[1]);
  const wpMatch = costStr.match(/(\d+)wp/);
  if (wpMatch) result.willpower = parseInt(wpMatch[1]);
  const hlMatch = costStr.match(/(\d+)hl/);
  if (hlMatch) result.lethalHealth = parseInt(hlMatch[1]);
  return result;
}

function parseCharmType(typeStr) {
  const t = typeStr.toLowerCase();
  if (t.includes('extra action')) return 'extraaction';
  if (t.includes('supplemental')) return 'supplemental';
  if (t.includes('reflexive')) return 'reflexive';
  if (t.includes('simple')) return 'simple';
  if (t.includes('permanent')) return 'permanent';
  return 'simple';
}

function parseSteps(typeStr) {
  const m = typeStr.match(/Step[s]?\s+(\d+)/gi);
  if (!m) return [];
  return m.map(s => parseInt(s.match(/\d+/)[0]));
}

function parseDuration(durStr) {
  const d = (durStr || '').toLowerCase().trim();
  if (d.includes('permanent')) return 'permanent';
  if (d.includes('instant')) return 'instant';
  if (d.includes('indefinite')) return 'indefinite';
  if (d.includes('scene')) return 'scene';
  if (d.includes('tick')) return 'tick';
  if (d.includes('action')) return 'action';
  if (d.includes('day')) return 'day';
  if (d.includes('week')) return 'week';
  if (d.includes('month')) return 'month';
  if (d.includes('year')) return 'year';
  if (d.includes('season') || d.includes('calibration')) return 'season';
  return 'varies';
}

function parseKeywords(kwStr) {
  if (!kwStr || kwStr.toLowerCase().trim() === 'none') return [];
  return kwStr.split(',').map(k => k.trim()).filter(k => k && k.toLowerCase() !== 'none');
}

function isCharmNameLine(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (!/^[A-Z]/.test(t)) return false;
  if (!/^[A-Z0-9][A-Z0-9\s''\-(),:\.!]+$/.test(t)) return false;
  const capitals = (t.match(/[A-Z]/g) || []).length;
  if (capitals < 2) return false;
  return true;
}

// Extract charm name from an ALL CAPS line (handles "FOR REFERENCE: NAME" → "NAME")
function extractCharmName(line) {
  const t = line.trim();
  const colonIdx = t.indexOf(': ');
  if (colonIdx > 0 && colonIdx < t.length - 2) {
    // e.g. "FOR REFERENCE: FROZEN RIPPLE LAIR"
    const before = t.slice(0, colonIdx);
    // If 'before' part looks like a meta-label (all caps, short phrase), take the after part
    if (/^[A-Z\s]+$/.test(before) && before.split(' ').length <= 4) {
      return t.slice(colonIdx + 2).trim();
    }
  }
  return t;
}

// Parse a joined stat block string into structured fields
function parseStatBlock(text) {
  const costM = text.match(/Cost:\s*([^;]+?)(?=;\s*Mins:|$)/);
  const minsM = text.match(/Mins:\s*([^;]+?)(?=;\s*Type:|$)/);
  const typeM = text.match(/Type:\s*(.+?)(?=\s*Keywords:|$)/);
  const kwM   = text.match(/Keywords:\s*(.+?)(?=\s*Duration:|$)/);
  const durM  = text.match(/Duration:\s*(.+?)(?=\s*Prerequisite|$)/);
  const preM  = text.match(/Prerequisite Charms:\s*(.+)/);

  const costStr  = costM ? costM[1].trim() : '--';
  const minsStr  = minsM ? minsM[1].trim() : '';
  const typeStr  = typeM ? typeM[1].trim() : '';
  const kwStr    = kwM   ? kwM[1].trim()   : 'None';
  const durStr   = durM  ? durM[1].trim()  : '';
  let   prereqStr = preM  ? preM[1].trim()  : 'None';

  // Strip any description that leaked into the prereq field (starts after prose words)
  // Prereqs are always title-case charm names separated by commas.
  // Prose starts at the first period in the prereq string (if any).
  const periodIdx = prereqStr.indexOf('.');
  if (periodIdx > 0) prereqStr = prereqStr.slice(0, periodIdx).trim();

  // Parse Mins: "Strength 3, Essence 2" | "Martial Arts 4, Essence 2" | "The Gull 4, Essence 4"
  const minsMatch = minsStr.match(/^(.+?)\s+(\d+),\s*Essence\s+(\d+)/);
  const abilityName = minsMatch ? minsMatch[1].trim() : '';
  const minAbility  = minsMatch ? parseInt(minsMatch[2]) : 0;
  const minEssence  = minsMatch ? parseInt(minsMatch[3]) : 0;

  const cost      = parseCost(costStr);
  const charmType = parseCharmType(typeStr);
  const steps     = parseSteps(typeStr);
  const duration  = parseDuration(durStr);
  const keywords  = parseKeywords(kwStr);

  const speedM = typeStr.match(/Speed\s+(\d+)/i);
  const speed  = speedM ? parseInt(speedM[1]) : 6;
  const dvM    = typeStr.match(/DV\s+([-+]?\d+)/i);
  const dvPenalty = dvM ? parseInt(dvM[1]) : 0;

  // Parse prerequisite charms into groups
  const prereqGroups = [];
  if (prereqStr && prereqStr.toLowerCase() !== 'none') {
    // Split by comma for simple lists
    const names = prereqStr.split(',').map(n => n.trim()).filter(n => n && n.toLowerCase() !== 'none');
    for (const charmName of names) {
      if (!charmName) continue;
      prereqGroups.push({
        alternatives: [{
          type: 'charm',
          charmUid: deterministicId(`charm-${charmName.toLowerCase()}`),
          charmName,
          abilityKey: '',
          virtueKey: 'valor',
          virtueMin: 1,
        }],
      });
    }
  }

  return { abilityName, minAbility, minEssence, cost, charmType, steps, duration, keywords, speed, dvPenalty, prereqGroups };
}

// Build charm JSON document
function buildCharm({ name, charmUid, exaltType, ability, folderId, source, maStyleName, sb, description }) {
  const id = deterministicId(`glories-charm-${charmUid}`);
  return {
    _id: id,
    _key: `!items!${id}`,
    _stats: stats(),
    name,
    type: 'charm',
    img: 'icons/magic/light/beam-rays-yellow.webp',
    system: {
      exaltType,
      ability,
      essence: sb.minEssence,
      minAbility: sb.minAbility,
      charmType: sb.charmType,
      duration: sb.duration,
      speed: sb.speed,
      dvPenalty: sb.dvPenalty,
      steps: sb.steps,
      keywords: sb.keywords,
      cost: { ...sb.cost, motesLabel: '', resonance: 0, limitTrigger: 0 },
      description: `<p>${description.replace(/\n\n+/g, '</p><p>').replace(/\s+/g, ' ')}</p>`,
      source,
      yoziPatron: '',
      martialArtsTier: '',
      martialArtsStyleName: maStyleName || '',
      maidenAffiliation: '',
      mirrorCharmRef: '',
      durationFormula: '',
      stackCount: 0,
      umiCost: 1,
      cooperationBonusDice: 0,
      excellency: '',
      perfectDefenseType: '',
      active: false,
      prereqGroups: sb.prereqGroups,
      charmUid: id,
    },
    folder: folderId,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    effects: [],
  };
}

// Build folder JSON document
function buildFolder({ id, name, parentId, color }) {
  return {
    _id: id,
    _key: `!folders!${id}`,
    _stats: stats(),
    name,
    type: 'Item',
    description: '',
    folder: parentId || null,
    sorting: 'a',
    sort: 0,
    color: color || null,
    flags: {},
  };
}

// ── Main parsing function ───────────────────────────────────────────────────

function parseFile(filePath, { defaultExaltType, maStyleSections, stopAfterLine, source }) {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const charms = [];

  let pendingName = null;
  let currentStyle = null; // current MA style (if in an MA section)

  // Build a map: line number (1-indexed) → style name
  const styleStarts = {};
  for (const [lineNumStr, styleName] of Object.entries(maStyleSections || {})) {
    styleStarts[Number(lineNumStr)] = styleName;
  }
  const stopLine = stopAfterLine || Infinity;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (lineNum > stopLine) break;

    const raw = lines[i];
    const line = raw.trim();

    // Update current MA style if we hit a style section line
    if (styleStarts[lineNum] !== undefined) {
      currentStyle = styleStarts[lineNum];
    }

    // Update pending charm name for any ALL CAPS line
    if (isCharmNameLine(line)) {
      pendingName = extractCharmName(line);
      continue;
    }

    // Detect cost line (charm stat block start)
    if (!line.startsWith('Cost:')) continue;
    // Reject spells (have "Target:" not "Mins:")
    if (line.includes('Target:') && !line.includes('Mins:')) continue;
    // Must have Mins: or semicolon to indicate a charm
    if (!line.includes('Mins:') && !line.includes(';')) continue;

    if (!pendingName) continue;

    // ── Collect stat block lines ────────────────────────────────────────────
    const statLines = [line];
    let j = i + 1;

    // If line is incomplete (missing Duration:), collect continuation lines
    if (!line.includes('Duration:')) {
      while (j < lines.length) {
        const nl = lines[j].trim();
        j++;
        if (!nl || /^\d+$/.test(nl)) continue; // blank or page number
        statLines.push(nl);
        if (nl.includes('Duration:')) break;
        // If line starts a new paragraph that isn't a stat continuation, stop
        if (!nl.startsWith('Keywords:') && !nl.startsWith('Type:') && !nl.startsWith('Prerequisite Charms:')) break;
      }
    }
    // If we have Duration but no Prerequisite Charms, check next line
    const joined1 = statLines.join(' ');
    if (joined1.includes('Duration:') && !joined1.includes('Prerequisite Charms:')) {
      let k = j;
      while (k < lines.length) {
        const nl = lines[k].trim();
        k++;
        if (!nl || /^\d+$/.test(nl)) continue;
        if (nl.startsWith('Prerequisite Charms:')) {
          statLines.push(nl);
          j = k;
        }
        break;
      }
    }

    const statText = statLines.join(' ');

    // Must have Mins: in the joined stat block
    if (!statText.includes('Mins:')) { pendingName = null; continue; }

    const sb = parseStatBlock(statText);
    if (!sb.abilityName) { pendingName = null; continue; }

    // ── Determine ability key, exalt type, folder ───────────────────────────
    const abilityName = sb.abilityName;
    let ability, folderId, exaltType, maStyleName, pack;

    if (abilityName === 'Martial Arts') {
      // Skip MA charms with no active style — they're pre-existing charms referenced in the text
      if (!currentStyle) { pendingName = null; continue; }
      const style = currentStyle;
      maStyleName = style;
      ability = 'martialarts';
      folderId = MA_FOLDERS[style] || deterministicId(`folder-ma-${toSlug(style)}`);
      exaltType = MA_EXALT_TYPE[style] || defaultExaltType;
      pack = 'martialarts';
    } else if (abilityName.startsWith('The ')) {
      // Sidereal College charm
      ability = 'college';
      folderId = SIDEREAL_COLLEGE_FOLDER_ID;
      exaltType = 'sidereal';
      maStyleName = '';
      pack = 'charms';
    } else if (ATTR_MAP[abilityName]) {
      // Lunar attribute charm
      ability = ATTR_MAP[abilityName];
      folderId = LUNAR_FOLDERS[ability] || '';
      exaltType = 'lunar';
      maStyleName = '';
      pack = 'charms';
    } else if (ABILITY_MAP[abilityName]) {
      // Solar / Sidereal ability charm
      ability = ABILITY_MAP[abilityName];
      folderId = SOLAR_FOLDERS[ability] || '';
      exaltType = defaultExaltType;
      maStyleName = '';
      pack = 'charms';
    } else {
      // Unknown
      console.warn(`  Unknown ability: "${abilityName}" in charm "${pendingName}"`);
      pendingName = null;
      continue;
    }

    // ── Collect description ─────────────────────────────────────────────────
    let descStart = j;
    while (descStart < lines.length && !lines[descStart].trim()) descStart++;

    const descParts = [];
    for (let k = descStart; k < lines.length; k++) {
      const dl = lines[k].trim();
      if (!dl) { descParts.push(''); continue; }
      if (/^\d+$/.test(dl)) continue; // page number
      // Book title page headers — skip, don't include in description
      if (/^LUNA$|^THE MAIDENS OF DESTINY$|^THE UNCONQUERED SUN$/.test(dl)) continue;
      if (dl.startsWith('Cost:') && dl.includes('Mins:')) break;
      if (isCharmNameLine(dl)) {
        // Check if next non-empty, non-page-number line is a Cost line (charm header)
        let ni = k + 1;
        while (ni < lines.length && (!lines[ni].trim() || /^\d+$/.test(lines[ni].trim()))) ni++;
        if (ni < lines.length && lines[ni].trim().startsWith('Cost:')) break;
      }
      // Stop at known section terminations
      if (/^SECRETS OF\b/i.test(dl)) break;
      if (/^GREATER ARTS\b/i.test(dl)) break;
      if (/^SACRED RITES\b/i.test(dl)) break;
      if (/^WINGS OF THE ARCHON\b/i.test(dl)) break;
      if (/^INFINITE CATALEPSIS\b/i.test(dl)) break;
      descParts.push(dl);
    }

    // Trim trailing blank lines
    while (descParts.length && !descParts[descParts.length - 1]) descParts.pop();

    const description = descParts.join(' ').replace(/\s+/g, ' ').trim();
    const charmName = toTitleCase(pendingName);
    const charmUid = `${toSlug(exaltType)}-${toSlug(ability)}-${toSlug(charmName)}`;

    charms.push({ name: charmName, charmUid, exaltType, ability, folderId, source, maStyleName, sb, description, pack });
    pendingName = null;
    i = j - 1; // resume after the stat block
  }

  return charms;
}

// ── Write helpers ───────────────────────────────────────────────────────────

const CHARM_OUT    = 'src/packs/charms';
const MA_OUT       = 'src/packs/martialarts';

function writeCharm(charm) {
  const doc  = buildCharm(charm);
  const slug = `${toSlug(charm.exaltType)}-${toSlug(charm.ability)}-${toSlug(charm.name)}`;
  const out  = charm.pack === 'martialarts' ? MA_OUT : CHARM_OUT;
  const file = join(out, `${slug}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 2), 'utf-8');
  return file;
}

// ── Create new folder docs ──────────────────────────────────────────────────

function createFolderDocs() {
  const written = [];

  // White Reaper Style
  const wrFolder = buildFolder({
    id: MA_FOLDERS['White Reaper Style'],
    name: 'White Reaper Style',
    parentId: null,
    color: '#b0a0c0',
  });
  const wrFile = join(MA_OUT, '_folder-white-reaper-style.json');
  writeFileSync(wrFile, JSON.stringify(wrFolder, null, 2), 'utf-8');
  written.push(wrFile);

  // Crystal Chameleon Style
  const ccFolder = buildFolder({
    id: MA_FOLDERS['Crystal Chameleon Style'],
    name: 'Crystal Chameleon Style',
    parentId: null,
    color: '#40c0c0',
  });
  const ccFile = join(MA_OUT, '_folder-crystal-chameleon-style.json');
  writeFileSync(ccFile, JSON.stringify(ccFolder, null, 2), 'utf-8');
  written.push(ccFile);

  // Sapphire Veil of Passion Style
  const svFolder = buildFolder({
    id: MA_FOLDERS['Sapphire Veil of Passion Style'],
    name: 'Sapphire Veil of Passion Style',
    parentId: null,
    color: '#4060c0',
  });
  const svFile = join(MA_OUT, '_folder-sapphire-veil-of-passion-style.json');
  writeFileSync(svFile, JSON.stringify(svFolder, null, 2), 'utf-8');
  written.push(svFile);

  // Arms of the Unconquered Sun Style
  const armsFolder = buildFolder({
    id: MA_FOLDERS['Arms of the Unconquered Sun Style'],
    name: 'Arms of the Unconquered Sun Style',
    parentId: null,
    color: '#c0a020',
  });
  const armsFile = join(MA_OUT, '_folder-arms-of-the-unconquered-sun-style.json');
  writeFileSync(armsFile, JSON.stringify(armsFolder, null, 2), 'utf-8');
  written.push(armsFile);

  // Sidereal College folder (src/packs/charms/)
  const sideFolder = buildFolder({
    id: SIDEREAL_COLLEGE_FOLDER_ID,
    name: 'College',
    parentId: 'a1b2c3d4e5f60003', // Sidereal Exalted top-level folder
    color: '#6060a0',
  });
  const sideFile = join(CHARM_OUT, '_folder-sidereal-college.json');
  writeFileSync(sideFile, JSON.stringify(sideFolder, null, 2), 'utf-8');
  written.push(sideFile);

  return written;
}

// ── Main ────────────────────────────────────────────────────────────────────

const EXT = 'docs/_extraction';

// Parse Glories Luna
const lunaCharms = parseFile(join(EXT, 'glories-luna.txt'), {
  defaultExaltType: 'lunar',
  maStyleSections: {
    455: 'White Reaper Style',
  },
  stopAfterLine: 501, // Stop before "SECRETS OF LUNA" knacks section
  source: 'Glories of the Most High: Luna',
});

// Parse Glories Maidens
const maidensCharms = parseFile(join(EXT, 'glories-maidens.txt'), {
  defaultExaltType: 'sidereal',
  maStyleSections: {
    253: 'Crane Style',
    313: 'Crystal Chameleon Style',
    364: 'Sapphire Veil of Passion Style',
  },
  stopAfterLine: Infinity,
  source: 'Glories of the Most High: Maidens of Destiny',
});

// Parse Glories Unconquered Sun
const sunCharms = parseFile(join(EXT, 'glories-unconquered-sun.txt'), {
  defaultExaltType: 'solar',
  maStyleSections: {
    475: 'Arms of the Unconquered Sun Style',
  },
  stopAfterLine: Infinity,
  source: 'Glories of the Most High: Unconquered Sun',
});

const allCharms = [...lunaCharms, ...maidensCharms, ...sunCharms];

// Create new folder docs
const folderFiles = createFolderDocs();
console.log(`Written ${folderFiles.length} folder docs`);

// Write charm JSON files
let count = 0;
const byPack = { charms: [], martialarts: [] };
for (const charm of allCharms) {
  const file = writeCharm(charm);
  byPack[charm.pack].push(charm.name);
  count++;
  console.log(`  ${charm.exaltType}/${charm.ability} → ${charm.pack}: ${charm.name}`);
}

console.log(`\nWritten ${count} charms total`);
console.log(`  Charms pack:      ${byPack.charms.length}`);
console.log(`  Martial Arts pack: ${byPack.martialarts.length}`);
console.log(`\nBreakdown:`);
const lunaMA = lunaCharms.filter(c => c.pack === 'martialarts').length;
const lunaC  = lunaCharms.filter(c => c.pack === 'charms').length;
console.log(`  Luna:    ${lunaC} charms, ${lunaMA} MA`);
const maidensMA = maidensCharms.filter(c => c.pack === 'martialarts').length;
const maidensC  = maidensCharms.filter(c => c.pack === 'charms').length;
console.log(`  Maidens: ${maidensC} charms, ${maidensMA} MA`);
const sunMA = sunCharms.filter(c => c.pack === 'martialarts').length;
const sunC  = sunCharms.filter(c => c.pack === 'charms').length;
console.log(`  Sun:     ${sunC} charms, ${sunMA} MA`);
