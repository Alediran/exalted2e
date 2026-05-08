#!/usr/bin/env node
// Cleans up verbose Mirror keywords in the Inkmonkeys charm pack.
// For each charm with "Mirror (CharmName)" or "Mirror (CharmName) ExtraKw":
//   1. Reconstructs fragmented keywords (split by commas inside the paren)
//   2. Extracts the counterpart charm name
//   3. Looks it up across all packs and sets system.mirrorId
//   4. Replaces the verbose keyword with plain "Mirror"
//   5. Extracts any keyword text appended after the closing paren (e.g. "Obvious")
//
// Usage:
//   node scripts/fix-inkmonkeys-mirrors.mjs          # dry-run
//   node scripts/fix-inkmonkeys-mirrors.mjs --write  # apply

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const BASE = 'src/packs';
const INKMONKEYS_DIR = join(BASE, 'charms-inkmonkeys');
// Normalize: lowercase, strip apostrophes, collapse hyphens/spaces for fuzzy matching
const norm = s => String(s ?? '').toLowerCase().replace(/[''']/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

// ── Build name→uid lookup across ALL packs (inkmonkeys first so intra-pack wins) ──
const nameToUid = new Map();
const packDirs = readdirSync(BASE).filter(d => d.startsWith('charms-'));
// Process inkmonkeys first so intra-pack mirrors take priority
const orderedPacks = ['charms-inkmonkeys', ...packDirs.filter(d => d !== 'charms-inkmonkeys')];
for (const packDir of orderedPacks) {
  for (const file of readdirSync(join(BASE, packDir)).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const doc = JSON.parse(readFileSync(join(BASE, packDir, file), 'utf-8'));
    if (doc.type !== 'charm' || !doc._id) continue;
    const key = norm(doc.name);
    if (key && !nameToUid.has(key)) {
      nameToUid.set(key, doc.system?.charmUid || doc._id);
    }
  }
}
console.log(`Built lookup map with ${nameToUid.size} charm names`);

// ── Process Inkmonkeys charms ──────────────────────────────────────────────────
let resolved = 0, unresolved = 0, cleaned = 0, filesChanged = 0;
const unresolvedList = [];

for (const file of readdirSync(INKMONKEYS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const filePath = join(INKMONKEYS_DIR, file);
  const doc = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (doc.type !== 'charm') continue;

  const kw = doc.system.keywords ?? [];
  const hasVerboseMirror = kw.some(k => /mirror\s*\(/i.test(k));
  if (!hasVerboseMirror) continue;

  let changed = false;
  let newKw = [...kw];

  // Step 1: Reconstruct fragmented Mirror keyword (same logic as fix-abyssal-mirrors)
  const reconstructed = [];
  let pending = null;
  for (const k of newKw) {
    if (pending !== null) {
      pending += ', ' + k;
      if (k.trim().endsWith(')') || !k.includes('(')) {
        reconstructed.push(pending);
        pending = null;
      }
      continue;
    }
    if (/^Mirror\s*\(/i.test(k) && !k.trim().endsWith(')')) {
      // Check if there's also content after a closing paren (e.g. "Mirror (Name) Obvious")
      const afterParen = k.match(/^Mirror\s*\([^)]*\)\s*(.+)/i);
      if (afterParen) {
        // It's complete but has trailing keyword text — handle below
        reconstructed.push(k);
      } else {
        pending = k;
      }
    } else {
      reconstructed.push(k);
    }
  }
  if (pending !== null) reconstructed.push(pending);
  if (JSON.stringify(reconstructed) !== JSON.stringify(newKw)) changed = true;
  newKw = reconstructed;

  // Step 2: For each verbose Mirror keyword, clean it up
  const finalKw = [];
  for (const k of newKw) {
    if (!/^Mirror\s*\(/i.test(k)) {
      finalKw.push(k);
      continue;
    }

    // Extract charm name from "Mirror (CharmName; ...)" — take up to the semicolon or closing paren
    const nameMatch = k.match(/^Mirror\s*\(([^;)]+)/i);
    const solarName = nameMatch ? nameMatch[1].trim() : null;

    // Extract any keyword text after the closing paren: "Mirror (Name) Obvious" → "Obvious"
    const trailingMatch = k.match(/\)\s+([A-Za-z].*)/);
    const trailingKeywords = trailingMatch
      ? trailingMatch[1].split(/\s+/).map(s => s.trim()).filter(Boolean)
      : [];

    // Replace with plain "Mirror"
    finalKw.push('Mirror');
    cleaned++;
    changed = true;

    // Add any trailing keywords (e.g. "Obvious") if not already present
    for (const tk of trailingKeywords) {
      if (!finalKw.includes(tk) && !newKw.includes(tk)) {
        finalKw.push(tk);
      }
    }

    // Set mirrorId
    if (!doc.system.mirrorId && solarName) {
      const uid = nameToUid.get(norm(solarName));
      if (uid) {
        doc.system.mirrorId = uid;
        resolved++;
        changed = true;
      } else {
        unresolvedList.push(`"${doc.name}" (${file}) — counterpart not found: "${solarName}"`);
        unresolved++;
      }
    } else if (!doc.system.mirrorId && !solarName) {
      unresolvedList.push(`"${doc.name}" (${file}) — no name extracted`);
      unresolved++;
    }
  }

  // Also remove orphan page-reference fragments left from previous partial cleanup
  const cleanedKw = finalKw.filter(k => !/^\s*p\.\s*\d+\)\s*$/.test(k));
  if (JSON.stringify(cleanedKw) !== JSON.stringify(finalKw)) changed = true;

  if (changed) {
    doc.system.keywords = cleanedKw;
    filesChanged++;
    if (!DRY_RUN) {
      writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
    }
  }
}

console.log(`\nMirror refs resolved:  ${resolved}`);
console.log(`Mirror refs unresolved: ${unresolved}`);
console.log(`Keywords cleaned:      ${cleaned}`);
console.log(`Files to be changed:   ${filesChanged}`);

if (unresolvedList.length) {
  console.log(`\nUnresolved (counterpart charm not in any pack):`);
  unresolvedList.forEach(r => console.log('  ' + r));
}

console.log(`\n${'─'.repeat(60)}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply changes');
else console.log('Done.');
