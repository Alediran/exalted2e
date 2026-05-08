#!/usr/bin/env node
// Removes orphan "p. NNN)" keyword fragments left by the previous mirror cleanup pass.
// Usage:
//   node scripts/fix-abyssal-orphan-keywords.mjs          # dry-run
//   node scripts/fix-abyssal-orphan-keywords.mjs --write  # apply

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const ABYSSAL_DIR = 'src/packs/charms-abyssal';

// Matches orphan page-reference fragments like "p. 197)", "p. 204)", etc.
const ORPHAN_PAGE_RE = /^\s*p\.\s*\d+\)\s*$/;
// Matches charm-name citation fragments like "Element-Resisting Prana; Exalted"
// (the charm name part from a split "Mirror (CharmName; Exalted, p. XXX)" keyword)
const ORPHAN_CITE_RE = /;\s*(Exalted|MoEP|BoS|RotSE)\b/i;

const isOrphan = k => ORPHAN_PAGE_RE.test(k) || ORPHAN_CITE_RE.test(k);

let filesChanged = 0, fragmentsRemoved = 0;

for (const file of readdirSync(ABYSSAL_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const filePath = join(ABYSSAL_DIR, file);
  const doc = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (doc.type !== 'charm') continue;

  const kw = doc.system.keywords ?? [];
  const cleaned = kw.filter(k => !isOrphan(k));
  if (cleaned.length === kw.length) continue;

  const removed = kw.length - cleaned.length;
  fragmentsRemoved += removed;
  filesChanged++;
  console.log(`${file}: removed ${removed} fragment(s) — was [${kw.join(', ')}]`);

  if (!DRY_RUN) {
    doc.system.keywords = cleaned;
    writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
  }
}

console.log(`\nFragments removed: ${fragmentsRemoved}`);
console.log(`Files changed:     ${filesChanged}`);
console.log(`\n${'─'.repeat(60)}`);
if (DRY_RUN) console.log('⚠  DRY RUN — pass --write to apply changes');
else console.log('Done.');
