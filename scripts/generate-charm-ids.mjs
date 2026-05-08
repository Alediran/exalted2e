#!/usr/bin/env node
// scripts/generate-charm-ids.mjs
// Populates system.charmUid for every charm source JSON (= doc._id)
// and wires prerequisite alternatives[].charmUid to the target charm's _id.
//
// Lookup priority when resolving a prereq name from charm C (exaltType E, ability A):
//   1. norm(name) + "|" + norm(E) + "|" + norm(abilityKey)   [full match, if abilityKey set]
//   2. norm(name) + "|" + norm(E)                             [same-splat match]
//   3. norm(name)                                              [first-wins fallback]
//
// Usage:
//   node scripts/generate-charm-ids.mjs          # dry-run
//   node scripts/generate-charm-ids.mjs --write  # apply

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const BASE = 'src/packs';

const norm = s => String(s ?? '').trim().toLowerCase();

// ── Phase 1: load all charms, build lookup maps ───────────────────────────────

const allDocs = [];
// fullKey:  norm(name)|norm(exaltType)|norm(ability) → _id  (most specific)
// splatKey: norm(name)|norm(exaltType)               → _id  (first per splat)
// nameKey:  norm(name)                               → _id  (first overall)
const fullKeyToId = new Map();
const splatKeyToId = new Map();
const nameKeyToId = new Map();
const duplicates = [];

for (const packDir of readdirSync(BASE).filter(d => d.startsWith('charms-'))) {
  const dir = join(BASE, packDir);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const filePath = join(dir, file);
    const doc = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (doc.type !== 'charm') continue;
    allDocs.push({ path: filePath, doc });

    if (!doc._id) continue;
    const nameNorm = norm(doc.name);
    if (!nameNorm) continue;

    const exaltNorm = norm(doc.system?.exaltType);
    const abilityNorm = norm(doc.system?.ability);

    const fullKey = `${nameNorm}|${exaltNorm}|${abilityNorm}`;
    const splatKey = `${nameNorm}|${exaltNorm}`;

    if (fullKeyToId.has(fullKey)) {
      duplicates.push(`"${doc.name}" [${doc.system?.exaltType}/${doc.system?.ability}] in ${filePath} (conflicts with id ${fullKeyToId.get(fullKey)})`);
    } else {
      fullKeyToId.set(fullKey, doc._id);
    }
    if (!splatKeyToId.has(splatKey)) splatKeyToId.set(splatKey, doc._id);
    if (!nameKeyToId.has(nameNorm)) nameKeyToId.set(nameNorm, doc._id);
  }
}

console.log(`Loaded ${allDocs.length} charms`);
console.log(`  fullKey entries:  ${fullKeyToId.size}`);
console.log(`  splatKey entries: ${splatKeyToId.size}`);
console.log(`  nameKey entries:  ${nameKeyToId.size}`);
if (duplicates.length) {
  console.log(`\nDuplicate charms (same name+exaltType+ability, first wins):`);
  duplicates.forEach(d => console.log('  ' + d));
}

// ── Phase 2: set charmUid + wire prereq references ───────────────────────────

let charmUidAdded = 0;
let prereqLinked = 0;
let prereqNotFound = 0;
let filesChanged = 0;
const unresolved = [];

for (const { path: filePath, doc } of allDocs) {
  let changed = false;

  // Set system.charmUid = _id if missing or blank
  if (!doc.system.charmUid) {
    doc.system.charmUid = doc._id;
    charmUidAdded++;
    changed = true;
  }

  const sourceExaltNorm = norm(doc.system?.exaltType);

  // Wire prerequisite charmUid references
  for (const group of (doc.system.prereqGroups ?? [])) {
    for (const alt of (group.alternatives ?? [])) {
      if (alt.type !== 'charm') continue;
      if (alt.charmUid) continue; // already wired
      const cn = norm(alt.charmName ?? '');
      if (!cn) continue;

      // Priority 1: same exalt + specified abilityKey
      const altAbilityNorm = norm(alt.abilityKey);
      let targetId = null;
      if (altAbilityNorm) {
        targetId = fullKeyToId.get(`${cn}|${sourceExaltNorm}|${altAbilityNorm}`);
      }
      // Priority 2: same exalt, any ability
      if (!targetId) {
        targetId = splatKeyToId.get(`${cn}|${sourceExaltNorm}`);
      }
      // Priority 3: first-wins across all packs
      if (!targetId) {
        targetId = nameKeyToId.get(cn);
      }

      if (targetId) {
        alt.charmUid = targetId;
        prereqLinked++;
        changed = true;
      } else {
        prereqNotFound++;
        unresolved.push(`"${String(alt.charmName ?? '').trim()}" (in ${filePath.split(/[\\/]/).pop()})`);
      }
    }
  }

  if (changed) {
    filesChanged++;
    if (!DRY_RUN) {
      writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
    }
  }
}

console.log(`\ncharmUid populated:    ${charmUidAdded} charms`);
console.log(`Prereq refs linked:    ${prereqLinked}`);
console.log(`Prereq refs unresolved: ${prereqNotFound}`);
console.log(`Files to be changed:   ${filesChanged}`);

if (unresolved.length) {
  console.log(`\nUnresolved prereq refs (no charm with that name):`);
  unresolved.forEach(r => console.log('  ' + r));
}

console.log(`\n${'─'.repeat(60)}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply changes');
else console.log('Done.');
