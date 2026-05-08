#!/usr/bin/env node
// scripts/fix-ma-folder-ids.mjs
// One-off script: re-syncs folder _id values in src/packs/martialarts/ to the
// deterministic IDs produced by deterministicId() and updates all charm JSON
// files whose `folder` field referenced the old sequential IDs.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = 'src/packs/martialarts';

function deterministicId(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const part1 = h.toString(16).padStart(8, '0');
  const part2 = (h ^ 0xdeadbeef).toString(16).padStart(8, '0');
  return (part1 + part2).slice(0, 16);
}

const allFiles = readdirSync(DIR);
const folderFiles = allFiles.filter(f => f.startsWith('_folder-') && f.endsWith('.json'));
const charmFiles  = allFiles.filter(f => !f.startsWith('_') && f.endsWith('.json'));

// Build old → new ID map from existing folder docs
const idMap = new Map(); // oldId → newId
for (const f of folderFiles) {
  const path = join(DIR, f);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  const newId = deterministicId(doc.name);
  if (doc._id !== newId) {
    idMap.set(doc._id, newId);
    console.log(`folder "${doc.name}": ${doc._id} → ${newId}`);
  }
}

if (idMap.size === 0) {
  console.log('All folder IDs already match deterministic values. Nothing to do.');
  process.exit(0);
}

// Rewrite folder docs with new IDs
let folderUpdated = 0;
for (const f of folderFiles) {
  const path = join(DIR, f);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  const newId = idMap.get(doc._id);
  if (newId) {
    doc._id = newId;
    doc._key = `!folders!${newId}`;
    writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
    folderUpdated++;
  }
}

// Rewrite charm docs whose folder field is in the old-ID map
let charmUpdated = 0;
for (const f of charmFiles) {
  const path = join(DIR, f);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  const newFolderId = idMap.get(doc.folder);
  if (newFolderId) {
    doc.folder = newFolderId;
    writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
    charmUpdated++;
  }
}

console.log(`\nDone. Updated ${folderUpdated} folder docs, ${charmUpdated} charm docs.`);
