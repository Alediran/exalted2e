#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE    = 'src/packs';
const OUT_DIR = 'docs/charm-effects-input';
mkdirSync(OUT_DIR, { recursive: true });

function strip(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

// Wide net — any charm whose description contains terms relevant to M1-M13 effects
const BROAD_RE = /health level|soak|wound penalt|mote|peripheral|personal pool|dodge dv|parry dv|defense value|\bspeed\b|accuracy|damage dice|crippling|poison|sickness|knockback|healing|\bheal\b/i;

const packs = readdirSync(BASE).filter(d => d.startsWith('charms-'));
for (const pack of packs) {
  const dir = join(BASE, pack);
  const records = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const filePath = join(dir, f).replace(/\\/g, '/');
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    if (doc.type !== 'charm') continue;
    const desc = strip(doc.system?.description ?? '');
    if (!BROAD_RE.test(desc)) continue;
    records.push({
      file:      filePath,
      name:      doc.name,
      ability:   doc.system?.ability   ?? '',
      exaltType: doc.system?.exaltType ?? '',
      charmType: doc.system?.charmType ?? '',
      duration:  doc.system?.duration  ?? '',
      desc,
    });
  }
  const outPath = join(OUT_DIR, pack + '.json');
  writeFileSync(outPath, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`${pack}: ${records.length} candidates → ${outPath}`);
}
