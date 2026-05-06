#!/usr/bin/env node
/**
 * add-compendium-folders.mjs
 * Groups charms in a pack source directory into Foundry compendium folders
 * organised by ability / attribute / Yozi patron, then re-packs.
 *
 * Usage:
 *   node scripts/add-compendium-folders.mjs --dir src/packs/charms-solar   --group ability
 *   node scripts/add-compendium-folders.mjs --dir src/packs/charms-infernal --group yozi
 *   node scripts/add-compendium-folders.mjs --dir src/packs/charms-lunar    --group ability
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

function makeId(seed) {
  return createHash('sha256').update('folder:' + seed).digest('hex').substring(0, 16);
}

// ── Display names ─────────────────────────────────────────────────────────────
const ABILITY_LABELS = {
  archery:        'Archery',
  athletics:      'Athletics',
  awareness:      'Awareness',
  bureaucracy:    'Bureaucracy',
  craft:          'Craft',
  dodge:          'Dodge',
  integrity:      'Integrity',
  investigation:  'Investigation',
  larceny:        'Larceny',
  linguistics:    'Linguistics',
  lore:           'Lore',
  martialarts:    'Martial Arts',
  medicine:       'Medicine',
  melee:          'Melee',
  occult:         'Occult',
  performance:    'Performance',
  presence:       'Presence',
  resistance:     'Resistance',
  ride:           'Ride',
  sail:           'Sail',
  socialize:      'Socialize',
  stealth:        'Stealth',
  survival:       'Survival',
  thrown:         'Thrown',
  war:            'War',
  // Attributes (Lunar / Alchemical)
  strength:       'Strength',
  dexterity:      'Dexterity',
  stamina:        'Stamina',
  charisma:       'Charisma',
  manipulation:   'Manipulation',
  appearance:     'Appearance',
  perception:     'Perception',
  intelligence:   'Intelligence',
  wits:           'Wits',
};

const YOZI_LABELS = {
  malfeas:              'Malfeas, the Demon City',
  cecelyne:             'Cecelyne, the Endless Desert',
  sheWhoLivesInHerName: 'She Who Lives in Her Name',
  adorjan:              'Adorjan, the Silent Wind',
  ebonDragon:           'The Ebon Dragon',
  kimbery:              'Kimbery, the Sea That Marched Against the Flame',
  '':                   '(Unassigned)',
};

// Dragon-Blooded aspect colours (just for aesthetics — optional)
const DB_ASPECT_COLORS = {
  Archery:      '#c05020', Fire:         '#c05020',
  Athletics:    '#c05020',
  Awareness:    '#305090', Air:          '#305090',
  Bureaucracy:  '#208090', Water:        '#208090',
  Craft:        '#407030', Wood:         '#407030',
  Dodge:        '#305090',
  Integrity:    '#806030', Earth:        '#806030',
  Investigation:'#208090',
  Larceny:      '#208090',
  Linguistics:  '#305090',
  Lore:         '#407030',
  'Martial Arts':'#c05020',
  Medicine:     '#407030',
  Melee:        '#c05020',
  Occult:       '#407030',
  Performance:  '#305090',
  Presence:     '#305090',
  Resistance:   '#806030',
  Ride:         '#c05020',
  Sail:         '#208090',
  Socialize:    '#208090',
  Stealth:      '#208090',
  Survival:     '#407030',
  Thrown:       '#c05020',
  War:          '#305090',
};

function folderColor(label, group) {
  if (group === 'ability') return DB_ASPECT_COLORS[label] ?? null;
  return null;
}

// ── Folder document factory ───────────────────────────────────────────────────
function makeFolder(label, group, sort) {
  const id = makeId(label);
  return {
    _id:   id,
    _key:  `!folders!${id}`,
    _stats: {
      coreVersion:    '13',
      systemId:       'exalted2e',
      systemVersion:  '1.0.0',
      createdTime:    0,
      modifiedTime:   0,
      lastModifiedBy: null,
    },
    name:        label,
    type:        'Item',
    description: '',
    folder:      null,
    sorting:     'a',
    sort,
    color:       folderColor(label, group),
    flags:       {},
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const get   = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const dir   = get('--dir');
const group = get('--group') ?? 'ability'; // 'ability' | 'yozi'

if (!dir) {
  console.error('Usage: node scripts/add-compendium-folders.mjs --dir <src/packs/pack-name> [--group ability|yozi]');
  process.exit(1);
}

// ── Read existing JSON files ──────────────────────────────────────────────────
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const charms = files.map(f => ({
  filename: f,
  path:     join(dir, f),
  doc:      JSON.parse(readFileSync(join(dir, f), 'utf-8')),
}));

// Remove existing folder files so we start clean
const folderFiles = charms.filter(c => c.doc._key?.startsWith('!folders!'));
for (const ff of folderFiles) {
  unlinkSync(ff.path);
  console.log(`  Removed old folder file: ${ff.filename}`);
}
const items = charms.filter(c => !c.doc._key?.startsWith('!folders!'));

// ── Derive group key per charm ────────────────────────────────────────────────
function groupKeyFor(doc) {
  if (group === 'yozi') {
    return doc.system?.yoziPatron ?? '';
  }
  return doc.system?.ability ?? 'melee';
}

function labelFor(key) {
  if (group === 'yozi')    return YOZI_LABELS[key]  ?? key;
  return ABILITY_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}

// ── Build folder set ──────────────────────────────────────────────────────────
const groupKeys = [...new Set(items.map(c => groupKeyFor(c.doc)))].sort();
const folderDocs = new Map(); // key → folder doc
let sortIdx = 0;
for (const key of groupKeys) {
  const label = labelFor(key);
  const fd = makeFolder(label, group, sortIdx++ * 100);
  folderDocs.set(key, fd);
}

// ── Update each charm's folder field ─────────────────────────────────────────
for (const item of items) {
  const key = groupKeyFor(item.doc);
  item.doc.folder = folderDocs.get(key)?._id ?? null;
  writeFileSync(item.path, JSON.stringify(item.doc, null, 2), 'utf-8');
}

// ── Write folder JSON files ───────────────────────────────────────────────────
for (const [key, fd] of folderDocs) {
  const safeName = fd.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  const fPath = join(dir, `_folder-${safeName}.json`);
  writeFileSync(fPath, JSON.stringify(fd, null, 2), 'utf-8');
  console.log(`  Folder: ${fd.name} (${items.filter(c => groupKeyFor(c.doc) === key).length} charms)`);
}

console.log(`\n✓ ${folderDocs.size} folders written, ${items.length} charms updated in ${dir}`);
