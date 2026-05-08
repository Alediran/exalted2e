#!/usr/bin/env node
// scripts/fix-charm-names.mjs
// Strips erroneous ability/caste/category prefixes from charm names.
//
// Solar/Terrestrial: strips leading ability name when it's not the real charm name
//   e.g. "Dodge Shadow Over Water" → "Shadow Over Water"
//   Exception: "X Essence Flow" keeps the ability prefix (that IS the real name)
//   Exception: "Craft Icon" — "Craft" here is a verb, not the ability
//
// Lunar: strips "Category Charms " prefix
//   e.g. "Fascination Charms Cobra Hypnotic Method" → "Cobra Hypnotic Method"
//
// Usage:
//   node scripts/fix-charm-names.mjs          # dry-run
//   node scripts/fix-charm-names.mjs --write  # apply

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--write');
const BASE = 'src/packs';

const ABILITIES = [
  'Archery','Athletics','Awareness','Brawl','Bureaucracy','Craft',
  'Dodge','Integrity','Investigation','Larceny','Linguistics','Lore',
  'Martial Arts','Medicine','Melee','Occult','Performance','Presence',
  'Resistance','Ride','Sail','Socialize','Stealth','Survival','Thrown','War',
];

const CASTES = [
  'Dawn Caste','Zenith Caste','Twilight Caste','Night Caste','Eclipse Caste',
];

// Names where the leading word IS part of the real name (verb, not ability prefix)
const EXACT_KEEP = new Set([
  'Craft Icon',
]);

function fixSolarTerrestrial(name) {
  if (EXACT_KEEP.has(name)) return name;

  // Strip caste + ability prefix: "Dawn Caste Archery There Is No Wind" → "There Is No Wind"
  for (const caste of CASTES) {
    const casteRx = new RegExp(`^${caste}\\s+\\S+\\s+`, 'i');
    if (casteRx.test(name)) return name.replace(casteRx, '');
  }

  // Strip ability prefix, but keep "X Essence Flow" intact
  for (const ab of ABILITIES) {
    if (name.toLowerCase().startsWith(ab.toLowerCase() + ' ')) {
      const rest = name.slice(ab.length + 1);
      if (/^Essence Flow$/i.test(rest)) return name; // legitimate name
      return rest;
    }
  }

  return name;
}

function fixLunar(name) {
  // "X Charms Y" → Y, where X can be multiple words
  // e.g. "Fascination Charms Cobra Hypnotic Method" → "Cobra Hypnotic Method"
  // e.g. "Defense And Dissembling Charms Mask Of White Jade" → "Mask Of White Jade"
  // e.g. "Dexterity Balance And Grace Charms Graceful Crane Stance" → "Graceful Crane Stance"
  const m = name.match(/^[\w\s-]+ Charms (.+)$/i);
  if (m) return m[1];

  // Also handle attribute-only prefixes without "Charms"
  // e.g. "Appearance Disguise Charms ..." already handled above
  // e.g. "Intelligence Crafting Charms ..." already handled above
  return name;
}

function getFixFn(pack) {
  if (pack === 'lunar') return fixLunar;
  if (pack === 'solar' || pack === 'terrestrial' || pack === 'abyssal' || pack === 'inkmonkeys') return fixSolarTerrestrial;
  return null;
}

let totalChanged = 0;

for (const packDir of readdirSync(BASE).filter(d => d.startsWith('charms-'))) {
  const pack = packDir.replace('charms-', '');
  const fixFn = getFixFn(pack);
  if (!fixFn) continue;

  const dir = join(BASE, packDir);
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const seenNames = new Set();

  for (const file of files) {
    const path = join(dir, file);
    const doc = JSON.parse(readFileSync(path, 'utf-8'));
    if (doc.type !== 'charm') continue;

    const oldName = doc.name;
    const newName = fixFn(oldName);

    if (seenNames.has(newName.toLowerCase())) {
      console.warn(`  ⚠  Conflict: "${newName}" already exists in ${pack}`);
    }
    seenNames.add(newName.toLowerCase());

    if (newName === oldName) continue;

    console.log(`[${pack}] "${oldName}"`);
    console.log(`       → "${newName}"`);

    totalChanged++;

    if (!DRY_RUN) {
      doc.name = newName;
      writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Charms renamed: ${totalChanged}`);
if (DRY_RUN) console.log('\n⚠  DRY RUN — pass --write to apply changes');
