#!/usr/bin/env node
/**
 * extract-charms.mjs
 * Parses Exalted 2e charm entries from extracted book text files and writes
 * Foundry-compatible Item JSON documents ready for `fvtt package pack`.
 *
 * Usage (full pack):
 *   node scripts/extract-charms.mjs \
 *     --file  docs/_extraction/core-rules.txt \
 *     --splat solar \
 *     --out   src/packs/charms-solar \
 *     --source "Core"
 *
 * Usage (general/excellency charms only, expanded per ability/attribute):
 *   node scripts/extract-charms.mjs \
 *     --file    docs/_extraction/core-rules.txt \
 *     --splat   solar \
 *     --out     src/packs/charms-solar \
 *     --source  "Core" \
 *     --section "GENERAL CHARMS"
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ── ID generation ─────────────────────────────────────────────────────────────
function makeId(seed) {
  return createHash('sha256').update(seed).digest('hex').substring(0, 16);
}

// ── Trait lists for General Charm expansion ───────────────────────────────────
const ALL_YOZIS = ['malfeas', 'cecelyne', 'sheWhoLivesInHerName', 'adorjan', 'ebonDragon', 'kimbery'];

const YOZI_DISPLAY = {
  malfeas:              'Malfeas',
  cecelyne:             'Cecelyne',
  sheWhoLivesInHerName: 'She Who Lives In Her Name',
  adorjan:              'Adorjan',
  ebonDragon:           'The Ebon Dragon',
  kimbery:              'Kimbery',
};

const ALL_ABILITIES = [
  'archery', 'athletics', 'awareness', 'bureaucracy', 'craft', 'dodge',
  'integrity', 'investigation', 'larceny', 'linguistics', 'lore', 'martialarts',
  'medicine', 'melee', 'occult', 'performance', 'presence', 'resistance',
  'ride', 'sail', 'socialize', 'stealth', 'survival', 'thrown', 'war',
];

const ALL_ATTRIBUTES = [
  'strength', 'dexterity', 'stamina', 'charisma', 'manipulation',
  'appearance', 'perception', 'intelligence', 'wits',
];

const TRAIT_DISPLAY = {
  archery: 'Archery', athletics: 'Athletics', awareness: 'Awareness',
  bureaucracy: 'Bureaucracy', craft: 'Craft', dodge: 'Dodge',
  integrity: 'Integrity', investigation: 'Investigation', larceny: 'Larceny',
  linguistics: 'Linguistics', lore: 'Lore', martialarts: 'Martial Arts',
  medicine: 'Medicine', melee: 'Melee', occult: 'Occult',
  performance: 'Performance', presence: 'Presence', resistance: 'Resistance',
  ride: 'Ride', sail: 'Sail', socialize: 'Socialize', stealth: 'Stealth',
  survival: 'Survival', thrown: 'Thrown', war: 'War',
  strength: 'Strength', dexterity: 'Dexterity', stamina: 'Stamina',
  charisma: 'Charisma', manipulation: 'Manipulation', appearance: 'Appearance',
  perception: 'Perception', intelligence: 'Intelligence', wits: 'Wits',
};

// ── Ability normalisation ─────────────────────────────────────────────────────
const ABILITY_MAP = {
  'archery': 'archery', 'athletics': 'athletics', 'awareness': 'awareness',
  'bureaucracy': 'bureaucracy', 'craft': 'craft', 'dodge': 'dodge',
  'integrity': 'integrity', 'investigation': 'investigation', 'larceny': 'larceny',
  'linguistics': 'linguistics', 'lore': 'lore',
  'martial arts': 'martialarts', 'martial art': 'martialarts',
  'medicine': 'medicine', 'melee': 'melee', 'occult': 'occult',
  'performance': 'performance', 'presence': 'presence', 'resistance': 'resistance',
  'ride': 'ride', 'sail': 'sail', 'socialize': 'socialize', 'stealth': 'stealth',
  'survival': 'survival', 'thrown': 'thrown', 'war': 'war',
  // Attributes (Lunar / Alchemical)
  'strength': 'strength', 'dexterity': 'dexterity', 'stamina': 'stamina',
  'charisma': 'charisma', 'manipulation': 'manipulation', 'appearance': 'appearance',
  'perception': 'perception', 'intelligence': 'intelligence', 'wits': 'wits',
};

function normalizeAbility(raw) {
  if (!raw) return 'melee';
  const lower = raw.toLowerCase().trim();
  if (ABILITY_MAP[lower]) return ABILITY_MAP[lower];
  for (const [k, v] of Object.entries(ABILITY_MAP)) {
    if (lower.startsWith(k)) return v;
  }
  return lower.replace(/\s+/g, '');
}

// ── Field parsers ─────────────────────────────────────────────────────────────
function parseCost(s) {
  const cost = {
    motes: 0, willpower: 0, bashingHealth: 0, lethalHealth: 0,
    aggravatedHealth: 0, xp: 0, motesLabel: '', resonance: 0, limitTrigger: 0,
  };
  if (!s) return cost;
  const cleaned = s.replace(/^[-–—]+/, '').trim();
  const mote = cleaned.match(/(\d+)\s*m(?!\w)/i);
  if (mote) cost.motes = parseInt(mote[1]);
  const wp = cleaned.match(/(\d+)\s*w(?:p|illpower)?(?!\w)/i);
  if (wp) cost.willpower = parseInt(wp[1]);
  const lhl = cleaned.match(/(\d+)\s*(?:l(?:ethal)?)?hl/i);
  if (lhl && !cleaned.match(/\d+\s*bhl/i)) cost.lethalHealth = parseInt(lhl[1]);
  const bhl = cleaned.match(/(\d+)\s*b(?:ashing)?hl/i);
  if (bhl) cost.bashingHealth = parseInt(bhl[1]);
  return cost;
}

function parseMins(s) {
  if (!s) return { ability: 'melee', minAbility: 1, essence: 1, isTemplate: false, templateType: null };
  const essMatch = s.match(/Essence\s+(\d+)/i);
  const essence = essMatch ? parseInt(essMatch[1]) : 1;
  const abilPart = s.replace(/,?\s*Essence\s+\d+/i, '').trim();

  // Detect (Ability) / (Attribute) placeholders used in General Charms
  if (/^\(Ability\)/i.test(abilPart)) {
    const minMatch = abilPart.match(/\)\s*(\d+)/);
    return { ability: '(ability)', minAbility: minMatch ? parseInt(minMatch[1]) : 1, essence, isTemplate: true, templateType: 'ability' };
  }
  if (/^\(Attribute\)/i.test(abilPart)) {
    const minMatch = abilPart.match(/\)\s*(\d+)/);
    return { ability: '(attribute)', minAbility: minMatch ? parseInt(minMatch[1]) : 1, essence, isTemplate: true, templateType: 'attribute' };
  }

  const abilMatch = abilPart.match(/^([A-Za-z\s]+?)\s+(\d+)/);
  return {
    ability: abilMatch ? normalizeAbility(abilMatch[1].trim()) : 'melee',
    minAbility: abilMatch ? parseInt(abilMatch[2]) : 1,
    essence,
    isTemplate: false,
    templateType: null,
  };
}

function parseType(s) {
  if (!s) return { charmType: 'supplemental', speed: 6, dvPenalty: 0, steps: [] };
  const lower = s.toLowerCase();
  if (lower.includes('extra action') || lower.includes('extra-action')) {
    return { charmType: 'extraaction', speed: 6, dvPenalty: 0, steps: [] };
  }
  if (lower.includes('permanent')) {
    return { charmType: 'permanent', speed: 6, dvPenalty: 0, steps: [] };
  }
  if (lower.includes('reflexive')) {
    const steps = [];
    const stepMatch = s.match(/step[s]?\s+([\d,\s&]+)/i);
    if (stepMatch) {
      stepMatch[1].split(/[\s,&]+/).forEach(n => { const v = parseInt(n); if (!isNaN(v)) steps.push(v); });
    }
    return { charmType: 'reflexive', speed: 6, dvPenalty: 0, steps };
  }
  if (lower.includes('simple')) {
    const speedMatch = s.match(/speed\s+(\d+)/i);
    const dvMatch = s.match(/dv\s*([+-]?\d+)/i);
    return {
      charmType: 'simple',
      speed: speedMatch ? parseInt(speedMatch[1]) : 6,
      dvPenalty: dvMatch ? parseInt(dvMatch[1]) : 0,
      steps: [],
    };
  }
  return { charmType: 'supplemental', speed: 6, dvPenalty: 0, steps: [] };
}

const DURATION_PATTERNS = [
  [/^instant$/i,              'instant'],
  [/^permanent$/i,            'permanent'],
  [/indefinite/i,             'indefinite'],
  [/one scene|^scene$/i,      'scene'],
  [/one story|^story$/i,      'story'],
  [/one day/i,                'one day'],
  [/one week/i,               'one week'],
  [/one month/i,              'one month'],
  [/one tick/i,               'one tick'],
  [/until next action/i,      'until next action'],
  [/until ended/i,            'until ended'],
  [/varies/i,                 'varies'],
];

function parseDuration(s) {
  if (!s) return 'instant';
  const t = s.trim();
  for (const [re, val] of DURATION_PATTERNS) {
    if (re.test(t)) return val;
  }
  return t.toLowerCase();
}

function parseKeywords(s) {
  if (!s || /^none$/i.test(s.trim())) return [];
  return s.split(/,\s*/).map(k => k.trim()).filter(Boolean);
}

function toTitleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Substitute (Ability), (Attribute), or (Yozi) placeholder in a string.
function substituteTraitPlaceholder(str, display) {
  return str
    .replace(/\(Ability\)/gi, display)
    .replace(/\(Attribute\)/gi, display)
    .replace(/\(Yozi\)/gi, display);
}

// ── Charm-header regex ────────────────────────────────────────────────────────
const HEADER_RE =
  /Cost:\s*([^;]+);\s*Mins:\s*([^;]+);\s*Type:\s*(.+?)\s*Keywords:\s*(.+?)\s*Duration:\s*(.+?)\s*Prerequisite Charms?:\s*(.+)/i;

const YOZI_SECTION_RE = [
  [/\bMALFEAS\b/i,               'malfeas'],
  [/\bCECELYNE\b/i,              'cecelyne'],
  [/\bSHE\s+WHO\s+LIVES\b/i,     'sheWhoLivesInHerName'],
  [/\bADORJAN\b/i,               'adorjan'],
  [/\bEBON\s+DRAGON\b/i,         'ebonDragon'],
  [/\bKIMBERY\b/i,               'kimbery'],
];

function isPageNoise(line) {
  const t = line.trim();
  return (
    !t
    || /^\d{1,4}$/.test(t)
    || /^CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)/i.test(t)
    || /^APPENDIX\b/i.test(t)
  );
}

function isAllCaps(line) {
  const t = line.trim();
  if (t.length < 3) return false;
  return /^[A-Z][A-Z\s\-'THE ]+$/.test(t) && /[A-Z]{2}/.test(t);
}

// ── Main extraction ───────────────────────────────────────────────────────────
function extractCharms(text, splat, sourceLabel, sectionHeader, stopSection) {
  const lines = text.split('\n');
  const charms = [];
  const warnings = [];

  // Preprocess: some charm headers are split across multiple lines.
  // Join any line matching Cost/Mins/Type with subsequent Duration: and Prerequisite Charms: lines.
  const PARTIAL_HEADER_RE = /Cost:\s*[^;]+;\s*Mins:\s*[^;]+;\s*Type:/i;
  for (let i = 0; i < lines.length; i++) {
    if (PARTIAL_HEADER_RE.test(lines[i]) && !HEADER_RE.test(lines[i])) {
      let combined = lines[i].trimEnd();
      let j = i + 1;
      while (j < Math.min(i + 6, lines.length)) {
        const next = lines[j].trim();
        if (!next || /^\d+$/.test(next)) { j++; continue; }
        if (/^(Duration:|Prerequisite Charms?:)/i.test(next)) {
          combined = combined + ' ' + next;
          lines[j] = '';
          j++;
          if (HEADER_RE.test(combined)) break;
        } else {
          break;
        }
      }
      lines[i] = combined;
    }
  }

  // Find the section start/stop line indices if specified
  const sectionStartIdx = sectionHeader
    ? lines.findIndex(l => l.trim() === sectionHeader)
    : -1;
  const stopSectionSearchFrom = sectionStartIdx !== -1 ? sectionStartIdx + 1 : 0;
  const stopSectionRel = stopSection
    ? lines.slice(stopSectionSearchFrom).findIndex(l => l.trim() === stopSection)
    : -1;
  const stopSectionIdx = stopSectionRel === -1 ? -1 : stopSectionSearchFrom + stopSectionRel;

  if (sectionHeader && sectionStartIdx === -1) {
    console.warn(`  Warning: section "${sectionHeader}" not found in file.`);
  } else if (sectionHeader) {
    console.log(`  Section "${sectionHeader}" starts at line ${sectionStartIdx + 1}.`);
  }
  if (stopSection && stopSectionIdx === -1) {
    console.warn(`  Warning: stop section "${stopSection}" not found in file.`);
  } else if (stopSection) {
    console.log(`  Stop section "${stopSection}" at line ${stopSectionIdx + 1}.`);
  }

  // Pass 1: find all header line indices and build a per-line yozi context map.
  const headerIdx = [];
  const yoziAtLine = new Array(lines.length).fill(null);
  let currentYozi = '';
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (HEADER_RE.test(t)) {
      // In section mode, skip headers before the section start or at/after stop section
      if (sectionHeader && i <= sectionStartIdx) continue;
      if (stopSectionIdx !== -1 && i >= stopSectionIdx) continue;
      headerIdx.push(i);
      yoziAtLine[i] = currentYozi;
    }
    if (splat === 'infernal') {
      for (const [re, patron] of YOZI_SECTION_RE) {
        if (re.test(t) && isAllCaps(t)) { currentYozi = patron; break; }
      }
    }
  }

  console.log(`  Found ${headerIdx.length} header lines${sectionHeader ? ' in section' : ''}.`);

  for (let hi = 0; hi < headerIdx.length; hi++) {
    const hl = headerIdx[hi];
    const nextHl = headerIdx[hi + 1] ?? lines.length;

    const match = lines[hl].match(HEADER_RE);
    if (!match) continue;

    const [, costRaw, minsRaw, typeRaw, kwRaw, durRaw, prereqRaw] = match;

    const mins = parseMins(minsRaw.trim());

    // ── Name lookup ──────────────────────────────────────────────────────────
    // Collect contiguous ALL CAPS lines immediately before the header.
    const nameParts = [];
    let firstCapLine = -1;
    for (let k = hl - 1; k >= Math.max(0, hl - 8); k--) {
      const t = lines[k].trim();
      if (isPageNoise(t)) continue;
      if (isAllCaps(t)) {
        nameParts.unshift(t);
        firstCapLine = k;
      } else {
        break;
      }
    }

    // If we collected all-caps lines, look one step further back for a
    // "(Ability)"/"(Attribute)" prefix line (e.g. "FIRST (ABILITY) EXCELLENCY--"
    // split across two lines in Core).
    if (firstCapLine > 0 && nameParts.length > 0) {
      for (let k = firstCapLine - 1; k >= Math.max(0, firstCapLine - 3); k--) {
        const t = lines[k].trim();
        if (!t || isPageNoise(t)) continue;
        if (/\(Ability\)|\(Attribute\)/i.test(t) && t.length < 100) {
          nameParts.unshift(t);
        }
        break;
      }
    }

    const rawName = nameParts.join(' ').trim();

    // Fallback: single-line name before the header (Ink Monkeys / some book formats).
    let fallbackName = '';
    if (!rawName) {
      for (let k = hl - 1; k >= Math.max(0, hl - 4); k--) {
        const t = lines[k].trim();
        if (!t || isPageNoise(t)) continue;
        if (
          t.length < 120 &&
          !/^Cost:|^Mins:|^Type:|^Keywords:|^Duration:|^Prerequisite/i.test(t) &&
          !/^CHAPTER|^EXALTED|^MAN.MACHINE/i.test(t) &&
          !/^\d{1,4}$/.test(t)
        ) {
          fallbackName = t;
          break;
        }
      }
    }

    const resolvedName = rawName || fallbackName;
    if (!resolvedName) {
      warnings.push(`Line ${hl + 1}: no name found before header — skipped`);
      continue;
    }

    // Detect (Yozi) templates from charm name (Infernal Excellencies — Mins only says "Essence N")
    if (!mins.isTemplate && /\(Yozi\)/i.test(resolvedName)) {
      mins.isTemplate = true;
      mins.templateType = 'yozi';
    }

    // In section mode, only process template charms
    if (sectionHeader && !mins.isTemplate) continue;

    const cost     = parseCost(costRaw.trim());
    const typeInfo = parseType(typeRaw.trim());

    // Excellency detection: applies to all template charms (ability, attribute, yozi)
    const isExcellencyTemplate = mins.isTemplate;
    function detectExcellency(name) {
      const lc = name.toLowerCase();
      if (/\bfirst\b|1st/.test(lc))  return 'first';
      if (/\bsecond\b|2nd/.test(lc)) return 'second';
      if (/\bthird\b|3rd/.test(lc))  return 'third';
      return '';
    }
    const baseExcellency = isExcellencyTemplate ? detectExcellency(resolvedName) : '';

    // ── Description ──────────────────────────────────────────────────────────
    const descRaw = [];
    for (let k = hl + 1; k < nextHl; k++) {
      const t = lines[k].trim();
      if (isPageNoise(t)) {
        if (descRaw.length > 0) descRaw.push('');
        continue;
      }
      descRaw.push(t);
    }
    while (descRaw.length > 0) {
      const last = descRaw[descRaw.length - 1];
      if (isAllCaps(last) || isPageNoise(last) || /^CHAPTER\b/i.test(last)) {
        descRaw.pop();
      } else {
        break;
      }
    }
    while (descRaw.length > 0 && !descRaw[descRaw.length - 1]) descRaw.pop();

    const descText = descRaw.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const descHtml = descText
      ? '<p>' + descText.replace(/\n\n+/g, '</p><p>').replace(/\n/g, ' ') + '</p>'
      : '';

    // ── Emit charms ──────────────────────────────────────────────────────────
    if (mins.isTemplate) {
      // Expand to one charm per ability / attribute / yozi
      let traits, displayMap;
      if (mins.templateType === 'yozi') {
        traits = ALL_YOZIS;
        displayMap = YOZI_DISPLAY;
      } else if (mins.templateType === 'attribute') {
        traits = ALL_ATTRIBUTES;
        displayMap = TRAIT_DISPLAY;
      } else {
        traits = ALL_ABILITIES;
        displayMap = TRAIT_DISPLAY;
      }

      for (const trait of traits) {
        const display = displayMap[trait];
        const expandedRawName = substituteTraitPlaceholder(resolvedName, display);
        const expandedName    = toTitleCase(expandedRawName);
        const expandedPrereq  = substituteTraitPlaceholder(prereqRaw.trim(), display);
        const expandedDesc    = substituteTraitPlaceholder(descHtml, display);
        const id = makeId(`${splat}:${trait}:${resolvedName.toLowerCase()}`);
        const yoziPatron = mins.templateType === 'yozi' ? trait : (yoziAtLine[hl] ?? '');

        charms.push({
          _id:   id,
          _key:  `!items!${id}`,
          _stats: {
            coreVersion:    '13',
            systemId:       'exalted2e',
            systemVersion:  '1.0.0',
            createdTime:    0,
            modifiedTime:   0,
            lastModifiedBy: null,
          },
          name:   expandedName,
          type:   'charm',
          img:    'icons/magic/light/beam-rays-yellow.webp',
          system: {
            exaltType:            splat,
            ability:              mins.templateType === 'yozi' ? '' : trait,
            essence:              mins.essence,
            minAbility:           mins.minAbility,
            charmType:            typeInfo.charmType,
            duration:             parseDuration(durRaw.trim()),
            speed:                typeInfo.speed,
            dvPenalty:            typeInfo.dvPenalty,
            steps:                typeInfo.steps,
            keywords:             parseKeywords(kwRaw.trim()),
            cost,
            description:          expandedDesc,
            source:               sourceLabel,
            yoziPatron,
            martialArtsTier:      '',
            martialArtsStyleName: '',
            maidenAffiliation:    '',
            mirrorCharmRef:       '',
            durationFormula:      '',
            stackCount:           0,
            umiCost:              1,
            cooperationBonusDice: 0,
            excellency:           baseExcellency,
            perfectDefenseType:   '',
            active:               false,
            prereqs:              [],
            prereqText:           expandedPrereq,
          },
          folder:    null,
          sort:      0,
          ownership: { default: 0 },
          flags:     {},
          effects:   [],
        });
      }
    } else {
      // Non-template charm: emit as-is (original behaviour)
      const excellency = detectExcellency(resolvedName);
      const id = makeId(`${splat}:${resolvedName.toLowerCase()}`);
      charms.push({
        _id:   id,
        _key:  `!items!${id}`,
        _stats: {
          coreVersion:    '13',
          systemId:       'exalted2e',
          systemVersion:  '1.0.0',
          createdTime:    0,
          modifiedTime:   0,
          lastModifiedBy: null,
        },
        name:   toTitleCase(resolvedName),
        type:   'charm',
        img:    'icons/magic/light/beam-rays-yellow.webp',
        system: {
          exaltType:            splat,
          ability:              mins.ability,
          essence:              mins.essence,
          minAbility:           mins.minAbility,
          charmType:            typeInfo.charmType,
          duration:             parseDuration(durRaw.trim()),
          speed:                typeInfo.speed,
          dvPenalty:            typeInfo.dvPenalty,
          steps:                typeInfo.steps,
          keywords:             parseKeywords(kwRaw.trim()),
          cost,
          description:          descHtml,
          source:               sourceLabel,
          yoziPatron:           yoziAtLine[hl] ?? '',
          martialArtsTier:      '',
          martialArtsStyleName: '',
          maidenAffiliation:    '',
          mirrorCharmRef:       '',
          durationFormula:      '',
          stackCount:           0,
          umiCost:              1,
          cooperationBonusDice: 0,
          excellency,
          perfectDefenseType:   '',
          active:               false,
          prereqs:              [],
          prereqText:           prereqRaw.trim(),
        },
        folder:    null,
        sort:      0,
        ownership: { default: 0 },
        flags:     {},
        effects:   [],
      });
    }
  }

  return { charms, warnings };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const file        = get('--file');
const splat       = get('--splat') ?? 'solar';
const out         = get('--out');
const source      = get('--source') ?? 'Unknown';
const section     = get('--section');      // e.g. "GENERAL CHARMS"
const stopSection = get('--stopSection'); // e.g. "MALFEAS"

if (!file || !out) {
  console.error('Usage: node scripts/extract-charms.mjs --file <path> --splat <solar> --out <dir> --source "Core" [--section "GENERAL CHARMS"] [--stopSection "MALFEAS"]');
  process.exit(1);
}

const text = readFileSync(file, 'utf-8');
console.log(`Parsing ${file} (${(text.length / 1024).toFixed(0)} KB) for splat="${splat}"${section ? ` section="${section}"` : ''}${stopSection ? ` stop="${stopSection}"` : ''}...`);

const { charms, warnings } = extractCharms(text, splat, source, section, stopSection);

if (warnings.length > 0) {
  console.warn(`\nWarnings (${warnings.length}):`);
  warnings.slice(0, 30).forEach(w => console.warn(' ', w));
  if (warnings.length > 30) console.warn(`  ... and ${warnings.length - 30} more`);
}

console.log(`\nExtracted ${charms.length} charms.`);

mkdirSync(out, { recursive: true });

let written = 0;
for (const charm of charms) {
  const safeName = charm.name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 80);
  const filename = join(out, `${safeName}.json`);
  writeFileSync(filename, JSON.stringify(charm, null, 2), 'utf-8');
  written++;
}

console.log(`✓ Written ${written} JSON files to ${out}\n`);
