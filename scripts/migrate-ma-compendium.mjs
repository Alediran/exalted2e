#!/usr/bin/env node
// scripts/migrate-ma-compendium.mjs
// Moves all MA charms from src/packs/charms/ → src/packs/martialarts/
// grouped by martialArtsStyleName (or "[Splat] Martial Arts" fallback).
// Run: node scripts/migrate-ma-compendium.mjs [--write]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const WRITE   = process.argv.includes('--write');
const SRC     = 'src/packs/charms';
const OUT     = 'src/packs/martialarts';
const STATS   = { coreVersion: "13", systemId: "exalted2e", systemVersion: "1.0.0",
                   createdTime: 0, modifiedTime: 0, lastModifiedBy: null };

// Palette for auto-assigned folder colors
const SPLAT_COLORS = {
  solar: '#c08020', lunar: '#a0a8b8', sidereal: '#6060a0',
  terrestrial: '#408040', abyssal: '#404058', infernal: '#803030',
  alchemical: '#305080', inkmonkeys: '#806040'
};

function deterministicId(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  // Produce a 16-char hex string in Foundry's document-ID format
  const part1 = h.toString(16).padStart(8, '0');
  const part2 = (h ^ 0xdeadbeef).toString(16).padStart(8, '0');
  return (part1 + part2).slice(0, 16);
}

function write(path, obj) {
  if (WRITE) writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
  else process.stdout.write(`  [dry] ${path}\n`);
}

// ── Collect MA charms ─────────────────────────────────────────────────────────
const files = readdirSync(SRC).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const maCharms = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(join(SRC, f), 'utf8'));
  if (data.type !== 'charm' || data.system.ability !== 'martialarts') continue;
  const splat  = f.split('-')[0];
  const style  = data.system.martialArtsStyleName || '';
  const folder = style || `${splat.charAt(0).toUpperCase() + splat.slice(1)} Martial Arts`;
  maCharms.push({ file: f, data, splat, style, folder });
}

// ── Build folder index ────────────────────────────────────────────────────────
const folderMap = new Map(); // folderName → { id, color }
for (const { folder, splat } of maCharms) {
  if (!folderMap.has(folder)) {
    folderMap.set(folder, { id: deterministicId(folder), color: SPLAT_COLORS[splat] ?? '#606060' });
  }
}

console.log(`\nMA charms to migrate: ${maCharms.length}`);
console.log(`Style folders to create: ${folderMap.size}`);
for (const [name, { id }] of folderMap) console.log(`  ${id}  "${name}"`);

if (WRITE) mkdirSync(OUT, { recursive: true });

// ── Write folder docs ─────────────────────────────────────────────────────────
for (const [name, { id, color }] of folderMap) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  write(join(OUT, `_folder-${slug}.json`), {
    _id: id, _key: `!folders!${id}`, _stats: STATS,
    name, type: 'Item', description: '', folder: null,
    sorting: 'a', sort: 0, color, flags: {}
  });
}

// ── Detect filename collisions ────────────────────────────────────────────────
const strippedNames = maCharms.map(({ file }) => file.replace(/^[^-]+-/, ''));
const collidingStripped = new Set(
  strippedNames.filter((f, i) => strippedNames.indexOf(f) !== i)
);
if (collidingStripped.size > 0) {
  console.log(`\nCollision detected — keeping splat prefix for ${collidingStripped.size} name(s):`);
  for (const name of collidingStripped) console.log(`  ${name}`);
}

// ── Write charm docs + delete from charms pack ────────────────────────────────
let written = 0;
for (const { file, data, folder } of maCharms) {
  const { id: folderId } = folderMap.get(folder);
  // Strip splat prefix unless it would collide with another file
  const stripped = file.replace(/^[^-]+-/, '');
  const newFile = collidingStripped.has(stripped) ? file : stripped;
  write(join(OUT, newFile), { ...data, folder: folderId });
  if (WRITE) rmSync(join(SRC, file));
  written++;
}

// ── Remove orphaned MA ability folder docs from charms pack ──────────────────
const MA_FOLDER_SLUGS = new Set(
  Object.keys(SPLAT_COLORS).map(sp => `_folder-${sp}-martial-arts.json`)
);
const maFolderFiles = readdirSync(SRC).filter(f => MA_FOLDER_SLUGS.has(f));
for (const f of maFolderFiles) {
  if (WRITE) {
    rmSync(join(SRC, f));
    console.log(`  removed folder doc: ${f}`);
  } else {
    process.stdout.write(`  [dry] remove ${join(SRC, f)}\n`);
  }
}

console.log(`\n✓ ${written} charms written to ${OUT}`);
console.log(`  Folder docs: ${folderMap.size}`);
if (!WRITE) console.log('\nRun with --write to apply.');
