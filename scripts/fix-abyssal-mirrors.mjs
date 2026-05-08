#!/usr/bin/env node
// scripts/fix-abyssal-mirrors.mjs
//
// For every Abyssal charm that has a Mirror (or Mirror (Name; ...)) keyword:
//   1. Extract the Solar charm name from the keyword where present
//   2. Look up the Solar charm's charmUid in all non-Abyssal packs
//   3. Set system.mirrorId to that charmUid
//   4. Replace any "Mirror (...)" verbose keyword with just "Mirror"
//
// Usage:
//   node scripts/fix-abyssal-mirrors.mjs          # dry-run
//   node scripts/fix-abyssal-mirrors.mjs --write  # apply

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const BASE = 'src/packs';
const norm = s => String(s ?? '').trim().toLowerCase();

// ── Hardcoded fallback map for plain "Mirror" charms (no name in keyword) ─────
// Keys are norm(abyssalCharmName), values are Solar charm names (looked up below).
const PLAIN_MIRROR_MAP = {
  // High confidence
  'ox-body technique':                    'Ox-Body Technique',
  'blade-summoning gesture':              'Call The Blade',           // Melee version
  'death-deflecting technique':           'Heavenly Guardian Defense',
  'deception-piercing stare':             'Judge\'s Ear Technique',
  'crouching gargoyle stance':            'Spider-Foot Style',
  'corpse-might surge':                   'Increasing Strength Exercise',
  'corpus-rending blow':                  'Spirit-Cutting Attack',
  'elegant flowing deflection':           'Dipping Swallow Defense',
  'atrocity without witness':             'Vanishing From Mind\'s Eye Method',
  'banished bow arsenal':                 'Summoning The Loyal Bow',
  'bone graft technique':                 'Wholeness-Restoring Meditation',
  'burrowing bone maggot':                'Joint-Wounding Attack',
  'crypt bolt attack':                    'Blazing Solar Bolt',
  'exquisite relic bow':                  'Immaculate Golden Bow',
  'flitting shadow form':                 'Flow Like Blood',
  'falling scythe attack':                'Thunderbolt Attack Prana',
  'earth-forsaking stance':               'Soaring Crane Leap',
  'ebon lightning prana':                 'Iron Raptor Technique',
  'effortless unnatural grace':           'Feather-Foot Style',
  'enduring dead dreams':                 'Chaos-Repelling Pattern',
  'essence-draining touch':               'Essence-Lending Method',
  'essence engorgement technique':        'Immanent Solar Glory',
  'eternal enmity approach':              'Righteous Lion Defense',
  // Best-guess matches
  'allied in hate discernment':           'Heroism-Encouraging Presence',
  'arise and slaughter':                  'Tiger Warrior Training Technique',
  'artful maiming onslaught':             'Hungry Tiger Technique',
  'broken heart triumph':                 'Irresistible Salesman Spirit',
  'caustic hatred diatribe':              'Foul Air Of Argument Technique',
  'chaining the weak':                    'Worshipful Lackey Acquisition',
  'chains cannot hold':                   'Lock-Opening Touch',
  'cunning subversion style':             'Indolent Official Charm',
  "day athletics raiton's nimble perch":  'Graceful Crane Stance',
  'deck-striding phantom':                'Salty Dog Method',
  'dread lord\'s demeanor':              'Authority-Radiating Stance',
  'dusk archery pulse of the prey':       'There Is No Wind',
  'eloquent example inspiration':         'Speed The Wheels',
  'entropic awakening of (sense)':        'Unsurpassed (Sense) Discipline',
  'eye of the tempest':                   'Ready In Eight Directions Stance',
  'eyes like daggers glance':             'Cascade Of Cutting Terror',
  'divinity-banishing contempt':          'Spirit-Repelling Diagram',
  // Newly resolved — Solar charms added to pack
  'daybreak craft systematic demolition exercise':   'Shattering Grasp',
  'five birds, one stone':                           'Wind Full of Knives',
  'headstones flung like pebbles':                   'Hill-Hurling Might',
  'honey-tongued serpent attack':                    'Heartfelt Honorific Opportunity',
  'inescapable massacre technique':                  'Face the Light',
  'language-absorbing method':                       "Excellent Emissary's Tongue",
  'lightning clutch of the raptor':                  'Deft Hands Deflection',
  'lurking malice insinuation':                      'Minds Yield to Glory',
  'mystique-spoiling guess':                         "Discerning Savant's Eye",
  'primal terror spurs':                             'Wind-Racing Essence Infusion',
  'restless as the dead':                            'Tireless Sentinel Technique',
  'ruthless captain efficiency':                     'Crew-Inspiring Charisma',
  'exquisite etiquette style':                       'Mastery of Small Manners',
  'solar impersonation style':                       'Vile Anathema Shroud',
  'soul-numbing prowess':                            'Legendary Warrior Curriculum',
  'spirit-chaining doom':                            'Demon-Binding Redemption',
  'virtue-devouring hunger':                         'Virtue-Donating Grace',
  'withering phantasmagoria':                        'Demon-Wracking Glory',
  'world-slaying arsenal epiphany':                  'Wonder-Forging Genius',
};

// ── Phase 1: build name→uid map from all non-Abyssal packs ───────────────────
const nameToUid = new Map();  // norm(name) → charmUid (first wins)
// Prefer Solar pack; process it first
for (const packDir of readdirSync(BASE)
    .filter(d => d.startsWith('charms-') && !d.includes('abyssal'))
    .sort((a, b) => (a.includes('solar') ? -1 : b.includes('solar') ? 1 : 0))) {
  const dir = join(BASE, packDir);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    if (doc.type !== 'charm' || !doc._id) continue;
    const key = norm(doc.name);
    if (key && !nameToUid.has(key)) {
      nameToUid.set(key, doc.system?.charmUid || doc._id);
    }
  }
}
console.log(`Built lookup map with ${nameToUid.size} non-Abyssal charm names`);

// ── Phase 2: process Abyssal charms ──────────────────────────────────────────
const abyssalDir = join(BASE, 'charms-abyssal');
let resolved = 0, unresolved = 0, keywordCleaned = 0, filesChanged = 0;
const unresolvedList = [];

for (const file of readdirSync(abyssalDir).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const filePath = join(abyssalDir, file);
  const doc = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (doc.type !== 'charm') continue;

  const kw = doc.system.keywords ?? [];
  const mirrorKwIdxs = kw.map((k, i) => /mirror/i.test(k) ? i : -1).filter(i => i >= 0);
  if (!mirrorKwIdxs.length) continue;

  let changed = false;

  // First pass: reconstruct any Mirror keyword that was split by commas.
  // e.g. ["Mirror (Call the Blade; Exalted", "p. 197)", "Obvious"]
  // becomes ["Mirror (Call the Blade; Exalted, p. 197)", "Obvious"]
  const reconstructed = [];
  let pending = null;
  for (const k of kw) {
    if (pending !== null) {
      pending += ', ' + k;
      if (k.trim().endsWith(')')) {
        reconstructed.push(pending);
        pending = null;
      }
      // else keep accumulating
      continue;
    }
    if (/^Mirror\s*\(/i.test(k) && !k.trim().endsWith(')')) {
      pending = k;
    } else {
      reconstructed.push(k);
    }
  }
  if (pending !== null) reconstructed.push(pending); // unclosed fragment

  // Check if reconstruction changed anything
  if (JSON.stringify(reconstructed) !== JSON.stringify(kw)) changed = true;

  const newKw = [...reconstructed];

  // Recompute mirrorKwIdxs after reconstruction
  const mirrorIdxs = newKw.map((k, i) => /mirror/i.test(k) ? i : -1).filter(i => i >= 0);

  for (const idx of mirrorIdxs) {
    const rawKw = newKw[idx];
    const isVerbose = rawKw.trim().toLowerCase() !== 'mirror';

    // Clean keyword to plain "Mirror"
    if (isVerbose) {
      newKw[idx] = 'Mirror';
      keywordCleaned++;
      changed = true;
    }

    // Skip if mirrorId already set
    if (doc.system.mirrorId) continue;

    // Extract solar charm name from "Mirror (CharmName; ...)" format
    let solarName = null;
    if (isVerbose) {
      const m = rawKw.match(/^Mirror\s*\(([^;]+)/i);
      if (m) {
        // Normalize bracket styles [X] → (X) and fix run-together words
        solarName = m[1].trim()
          .replace(/\[/g, '(').replace(/\]/g, ')')
          .replace(/([a-z])([A-Z])/g, '$1-$2'); // "TemptationResisting" → "Temptation-Resisting"
      }
    }

    // Fall back to hardcoded plain-mirror map
    if (!solarName) {
      const fallback = PLAIN_MIRROR_MAP[norm(doc.name)];
      if (fallback) solarName = fallback;
    }

    if (!solarName) {
      unresolvedList.push(`"${doc.name}" (${file}) — no name found`);
      unresolved++;
      continue;
    }

    // Try exact name, then with "Technique" appended (handles abbreviated references)
    let uid = nameToUid.get(norm(solarName))
           ?? nameToUid.get(norm(solarName + ' Technique'));
    if (uid) {
      doc.system.mirrorId = uid;
      resolved++;
      changed = true;
    } else {
      unresolvedList.push(`"${doc.name}" (${file}) — Solar charm not found: "${solarName}"`);
      unresolved++;
    }
  }

  if (changed) {
    doc.system.keywords = newKw;
    filesChanged++;
    if (!DRY_RUN) {
      writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
    }
  }
}

console.log(`\nMirror refs resolved:  ${resolved}`);
console.log(`Mirror refs unresolved: ${unresolved}`);
console.log(`Keywords cleaned:      ${keywordCleaned}`);
console.log(`Files to be changed:   ${filesChanged}`);

if (unresolvedList.length) {
  console.log(`\nUnresolved:`);
  unresolvedList.forEach(r => console.log('  ' + r));
}

console.log(`\n${'─'.repeat(60)}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply changes');
else console.log('Done.');
