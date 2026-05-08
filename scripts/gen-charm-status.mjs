#!/usr/bin/env node
// scripts/gen-charm-status.mjs
// Generates docs/charm-functionality.md by analysing enabled effect fields
// across all src/packs/charms/ JSON files (merged single-pack layout).
//
// Usage: node scripts/gen-charm-status.mjs

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const strip = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100_000);

const EFFECT_FIELDS = [
  'attack', 'healthGrant', 'soakBonus', 'woundReduction', 'statBoost',
  'moteRecovery', 'healingRoll', 'statusApply', 'motePoolBonus', 'extraActions',
  'dvBonus', 'targetPenalty', 'attackBonus', 'speedModifier', 'rateBonus', 'willpowerRecovery',
  'targetEffect',
];

const EFFECT_LABELS = {
  attack: 'weapon attack',
  healthGrant: 'health levels',
  soakBonus: 'soak bonus',
  woundReduction: 'wound reduction',
  statBoost: 'stat boost',
  moteRecovery: 'mote recovery',
  healingRoll: 'healing roll',
  statusApply: 'status effect',
  motePoolBonus: 'mote pool +',
  extraActions: 'extra actions',
  dvBonus: 'DV bonus',
  targetPenalty: 'target penalty',
  attackBonus: 'attack bonus',
  speedModifier: 'speed modifier',
  rateBonus: 'rate bonus',
  willpowerRecovery: 'WP recovery',
  targetEffect: 'target AE',
};

// Regex patterns that suggest implementable (non-narrative) mechanics in description text.
// Order matters: first match wins the "could have" classification.
const COULD_HAVE_PATTERNS = [
  /\b(?:adds?|grants?|gives?)\s+(?:one|two|three|four|five|\d+)\s+dice\s+to\s+(?:attack|accuracy|damage|soak|defense|parry|dodge)/i,
  /\b(?:soak|hardness|parry\s+(?:dv|defense)|dodge\s+(?:dv|defense))\b.{0,60}(?:adds?|bonus|increase|\+\d+)|(?:adds?|bonus|increase|\+\d+).{0,60}\b(?:soak|hardness|parry\s+dv|dodge\s+dv)\b/i,
  /(?:^|\s)-\d+\s+(?:internal\s+)?penalt(?:y|ies)|internal\s+penalt(?:y|ies)/i,
  /\b(?:wound\s+penalt(?:y|ies)|ignores?\s+(?:all\s+)?wound|negates?\s+(?:all\s+)?wound)/i,
  /\b(?:additional|extra)\s+-(?:0|1|2|4)\s+health\s+levels?/i,
  /\breduces?\s+(?:the\s+)?speed\s+by|speed\s+(?:of|by)\s+(?:one|two|\d+)\s+(?:tick|action)/i,
  /\b(?:regains?|recovers?|respires?)\s+(?:one|two|three|\d+)\s+motes?\s+(?:of\s+essence\s+)?(?:when|each\s+time|whenever|per)/i,
  /\b(?:extra|additional)\s+attacks?\b|\bmakes?\s+(?:up\s+to\s+)?(?:one|two|three|\d+)\s+additional\s+attacks?\b/i,
  /\bperfect\s+(?:parry|dodge|soak|defense)\b/i,
  /\bcrippl(?:ing|ed)\b|\bknockback\b|\bpoisoned?\b|\bsickness\b|\bblinded?\b/i,
  /\b(?:accuracy|damage)\s+(?:increases?|improves?|adds?|\+\d+)|(?:\+\d+)\s+(?:to\s+)?(?:accuracy|damage)\b/i,
  /\bwillpower\b.{0,80}(?:regains?|recovers?|gains?)|(?:regains?|recovers?|gains?).{0,80}\bwillpower\b/i,
  /\bhealing\s+(?:roll|action|rate)|heals?\s+(?:one|two|three|\d+)\s+(?:levels?\s+of\s+)?(?:bashing|lethal|aggravated)/i,
  /\b(?:dodge|parry)\s+(?:dv|defense)\s+(?:by|of)\s+(?:one|two|three|\d+)/i,
];

// Charms whose descriptions match COULD_HAVE_PATTERNS but are actually narrative.
// Forced to 'narrative' regardless of pattern match.
const EXPLICIT_NARRATIVE = new Set([
  // Abyssal — social / organizational / Resonance-mechanic
  'Eloquent Example Inspiration',
  "Faithful Killer's Reprieve",
  'Hate-Sowing Bitterness',
  'Iron Tyrant Reign',
  'Regime-Toppling Lord Of Misrule',
  'Soul-Numbing Prowess',

  // Alchemical — perception / nutrition / mutation / social
  'Abstract Abacus Implant',
  'Mobile Sensory Drone',
  'Sustenance Replication Engine',
  'Transorganic Desecration Cyst',
  'Unobtrusive Repartee Baffles',

  // Infernal — social / charm-cost-reduction / prayer
  'Despair-Choked Spirit Maiming',
  'Hateful Wretched Noise',
  "Kalmanka's Grace",
  'Penitents Like Scattered Grains',

  // Inkmonkeys — perception / social bond / narrative
  'Eyes As Moonbeams Method',
  'Silver And Gold Span The Heavens',
  'Voice-Drinking Kiss',
  'Want Becomes Need',

  // Lunar — illusory defense / counter-influence / social / research
  'Butterfly Eyes Defense',
  'Commanded To Fly',
  'Inevitable Genius Insight',
  'Irresistible Silver Spirit',
  'Perfect Fear Scent',
  'Subtle Silver Command',
  'Terrifying Lust Infliction',

  // Sidereal — Arcane Fate / social / narrative death
  'Gift Of A Broken Mask',
  'Impose Motivation',
  "Lover's Oath",
  'Peaceable Conclusion',
  'Sidereal Shell Games',

  // Solar — medical / animal training / organization / perception / social
  'Ailment-Rectifying Method',
  'Bestial Traits Technique',
  'Bureau-Rectifying Method',
  'Element-Resisting Prana',
  'Foul Air Of Argument Technique',
  'Keen (Sense) Technique',
  'Legendary Warrior Curriculum',
  'Sun King Radiance',
  'Tireless Sentinel Technique',
  'Venomous Whispers Technique',
  'Wholeness-Restoring Meditation',

  // Terrestrial — armor-type conditional / movement / mount / ship
  'Armor-Hardening Concentration',
  'Dancing Ember Stride',
  'Five-Dragon Horseman Prana',
  'Sturdy Bulkhead Concentration',
]);

function getEnabledEffects(s) {
  return EFFECT_FIELDS.filter(f => s[f]?.enabled);
}

function classify(doc) {
  const s = doc.system;
  const effects = getEnabledEffects(s);
  const isExcellency = s.excellency !== '';
  const isPerfDef = s.perfectDefenseType !== '';

  if (isExcellency || isPerfDef || effects.length >= 2) {
    return { cat: 'fully', effects, isExcellency, isPerfDef };
  }

  if (effects.length === 1) {
    const ef = effects[0];
    const type = s.charmType;

    // Effect fully covers the charm's purpose:
    const fullyCovers =
      ['moteRecovery', 'willpowerRecovery', 'statusApply', 'healingRoll'].includes(ef) ||
      (type === 'extraaction' && ef === 'extraActions') ||
      ((type === 'reflexive' || type === 'simple') && ef === 'dvBonus') ||
      ef === 'speedModifier' ||
      ef === 'woundReduction' ||
      ef === 'rateBonus' ||
      ['soakBonus', 'dvBonus', 'woundReduction', 'rateBonus'].includes(ef) ||
      (ef === 'healthGrant') ||
      (ef === 'motePoolBonus') ||
      (ef === 'attackBonus' && type === 'supplemental') ||
      (ef === 'targetPenalty' && type !== 'supplemental') ||
      ef === 'attack';

    if (fullyCovers) return { cat: 'fully', effects, isExcellency: false, isPerfDef: false };
    return { cat: 'partial', effects, isExcellency: false, isPerfDef: false };
  }

  // 0 effects — check explicit narrative override first
  if (EXPLICIT_NARRATIVE.has(doc.name)) return { cat: 'narrative', effects: [] };

  // then check for implementable patterns in description
  const desc = strip(s.description ?? '');
  for (const re of COULD_HAVE_PATTERNS) {
    if (re.test(desc)) return { cat: 'could', effects: [] };
  }
  return { cat: 'narrative', effects: [] };
}

// ── Load all charms ──────────────────────────────────────────────────────────
// Charms are stored in src/packs/charms/ with splat-prefixed filenames,
// e.g. solar-accuracy-without-distance.json, inkmonkeys-wind-born-stride.json.
// The splat group is the filename prefix before the first hyphen.

const BASE = 'src/packs/charms';
const byPack = {};
for (const f of readdirSync(BASE).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
  const doc = JSON.parse(readFileSync(join(BASE, f), 'utf-8'));
  if (doc.type !== 'charm') continue;
  const label = f.split('-')[0];
  if (!byPack[label]) byPack[label] = [];
  const result = classify(doc);
  byPack[label].push({
    name: doc.name,
    type: doc.system.charmType,
    dur: doc.system.duration,
    ...result,
  });
}
for (const label of Object.keys(byPack)) {
  byPack[label].sort((a, b) => a.name.localeCompare(b.name));
}

const SPLATS = Object.keys(byPack).sort();

// ── Counts ───────────────────────────────────────────────────────────────────

const cats = { fully: 0, partial: 0, could: 0, narrative: 0 };
for (const pack of SPLATS) for (const c of byPack[pack]) cats[c.cat]++;
const total = Object.values(cats).reduce((a, b) => a + b, 0);

// ── Helpers ──────────────────────────────────────────────────────────────────

function effectTags(c) {
  if (c.isExcellency) return '`Excellency`';
  if (c.isPerfDef) return '`Perfect Defense`';
  if (c.effects.length === 0) return '';
  return c.effects.map(e => `\`${EFFECT_LABELS[e]}\``).join(' ');
}

function row(c) {
  const tags = effectTags(c);
  return `- **${c.name}** (${c.type})${tags ? ' — ' + tags : ''}`;
}

function splatHeader(label) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Build markdown ───────────────────────────────────────────────────────────

const lines = [];
const today = new Date().toISOString().slice(0, 10);

lines.push(`# Charm Functionality Status`);
lines.push(`\n_Generated ${today}. Automated analysis based on enabled effect fields in \`src/packs/charms/\`. Manual review recommended for edge cases._\n`);

lines.push(`## Summary\n`);
lines.push(`| Category | Count | % |`);
lines.push(`|---|---:|---:|`);
lines.push(`| Fully functional | ${cats.fully} | ${Math.round(cats.fully / total * 100)}% |`);
lines.push(`| Partial functionality | ${cats.partial} | ${Math.round(cats.partial / total * 100)}% |`);
lines.push(`| Could have functionality | ${cats.could} | ${Math.round(cats.could / total * 100)}% |`);
lines.push(`| Narrative | ${cats.narrative} | ${Math.round(cats.narrative / total * 100)}% |`);
lines.push(`| **Total** | **${total}** | |`);
lines.push('');

lines.push(`### By Splat\n`);
lines.push(`| Splat | Fully | Partial | Could | Narrative | Total |`);
lines.push(`|---|---:|---:|---:|---:|---:|`);
for (const pack of SPLATS) {
  const ch = byPack[pack];
  lines.push(`| ${splatHeader(pack)} | ${ch.filter(c => c.cat === 'fully').length} | ${ch.filter(c => c.cat === 'partial').length} | ${ch.filter(c => c.cat === 'could').length} | ${ch.filter(c => c.cat === 'narrative').length} | ${ch.length} |`);
}

// ── Section 1: Fully functional ──────────────────────────────────────────────

lines.push(`\n---\n\n## 1. Fully Functional\n`);
lines.push(`Charms whose primary mechanic is covered by at least one enabled effect field, or are handled entirely by the Excellency / Perfect Defense system.\n`);
for (const pack of SPLATS) {
  const charms = byPack[pack].filter(c => c.cat === 'fully');
  if (charms.length === 0) continue;
  lines.push(`### ${splatHeader(pack)} (${charms.length})\n`);
  for (const c of charms) lines.push(row(c));
  lines.push('');
}

// ── Section 2: Partial functionality ────────────────────────────────────────

lines.push(`\n---\n\n## 2. Partial Functionality\n`);
lines.push(`Charms with at least one effect enabled, but whose description mentions additional mechanical effects not yet implemented.\n`);
let anyPartial = false;
for (const pack of SPLATS) {
  const charms = byPack[pack].filter(c => c.cat === 'partial');
  if (charms.length === 0) continue;
  anyPartial = true;
  lines.push(`### ${splatHeader(pack)} (${charms.length})\n`);
  for (const c of charms) lines.push(row(c));
  lines.push('');
}
if (!anyPartial) lines.push('_No charms currently in this category._\n');

// ── Section 3: Could have functionality ─────────────────────────────────────

lines.push(`\n---\n\n## 3. Could Have Functionality\n`);
lines.push(`No effect fields enabled, but description contains detectable mechanical patterns (numeric bonuses or penalties, DV/soak modifiers, health effects, speed/rate changes, recovery on events, status conditions, extra attacks).\n`);
for (const pack of SPLATS) {
  const charms = byPack[pack].filter(c => c.cat === 'could');
  if (charms.length === 0) continue;
  lines.push(`### ${splatHeader(pack)} (${charms.length})\n`);
  for (const c of charms) lines.push(`- **${c.name}** (${c.type} / ${c.dur})`);
  lines.push('');
}

// ── Section 4: Narrative ─────────────────────────────────────────────────────

lines.push(`\n---\n\n## 4. Narrative\n`);
lines.push(`No enabled effect fields and no detectable numeric mechanical patterns. Effects are primarily story-based, social, perception-based, transformative, or otherwise outside the scope of the combat / derived-data engine.\n`);
for (const pack of SPLATS) {
  const charms = byPack[pack].filter(c => c.cat === 'narrative');
  if (charms.length === 0) continue;
  lines.push(`### ${splatHeader(pack)} (${charms.length})\n`);
  for (const c of charms) lines.push(`- **${c.name}** (${c.type} / ${c.dur})`);
  lines.push('');
}

writeFileSync('docs/charm-functionality.md', lines.join('\n'), 'utf-8');
console.log(`Written docs/charm-functionality.md`);
console.log(`Fully: ${cats.fully} | Partial: ${cats.partial} | Could: ${cats.could} | Narrative: ${cats.narrative} | Total: ${total}`);
