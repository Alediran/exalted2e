#!/usr/bin/env node
/**
 * link-charm-prereqs.mjs
 * Reads system.prereqText on every charm JSON in src/packs/ and writes
 * system.prereqGroups (the format used by charm-prereqs.mjs at runtime).
 * Also removes the legacy dead fields `prereqs` and `prereqText`.
 *
 * prereqGroups schema (from CharmData.defineSchema):
 *   Array of AND-groups; within each group, alternatives OR together.
 *   alt.type: "charm" | "anyExcellency" | "virtue"
 *   alt.charmUid: left blank (assigned at Foundry ready-time per actor)
 *   alt.charmName: display name / name-based fallback
 *   alt.abilityKey: for anyExcellency, overrides host charm's ability
 *   alt.virtueKey / virtueMin: for virtue alts
 *
 * Usage:
 *   node scripts/link-charm-prereqs.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = 'src/packs';

// ── Ability normalisation ─────────────────────────────────────────────────────
const ABILITY_NORM = {
  archery: 'archery', athletics: 'athletics', awareness: 'awareness',
  bureaucracy: 'bureaucracy', craft: 'craft', dodge: 'dodge',
  integrity: 'integrity', investigation: 'investigation', larceny: 'larceny',
  linguistics: 'linguistics', lore: 'lore',
  'martial arts': 'martialarts', martialarts: 'martialarts',
  medicine: 'medicine', melee: 'melee', occult: 'occult',
  performance: 'performance', presence: 'presence', resistance: 'resistance',
  ride: 'ride', sail: 'sail', socialize: 'socialize', stealth: 'stealth',
  survival: 'survival', thrown: 'thrown', war: 'war',
  strength: 'strength', dexterity: 'dexterity', stamina: 'stamina',
  charisma: 'charisma', manipulation: 'manipulation', appearance: 'appearance',
  perception: 'perception', intelligence: 'intelligence', wits: 'wits',
};

const ABILITY_DISPLAY = {
  archery: 'Archery', athletics: 'Athletics', awareness: 'Awareness',
  bureaucracy: 'Bureaucracy', craft: 'Craft', dodge: 'Dodge',
  integrity: 'Integrity', investigation: 'Investigation', larceny: 'Larceny',
  linguistics: 'Linguistics', lore: 'Lore', martialarts: 'Martial Arts',
  medicine: 'Medicine', melee: 'Melee', occult: 'Occult',
  performance: 'Performance', presence: 'Presence', resistance: 'Resistance',
  ride: 'Ride', sail: 'Sail', socialize: 'Socialize', stealth: 'Stealth',
  survival: 'Survival', thrown: 'Thrown', war: 'War',
  strength: 'Strength', dexterity: 'Dexterity', stamina: 'Stamina',
  charisma: 'Charisma', manipulation: 'Manipulation', appearance: 'Appearance',
  perception: 'Perception', intelligence: 'Intelligence', wits: 'Wits',
};

function normalizeAbility(raw) {
  const lower = raw.toLowerCase().trim();
  if (ABILITY_NORM[lower]) return ABILITY_NORM[lower];
  const noSpaces = lower.replace(/\s+/g, '');
  return ABILITY_NORM[noSpaces] ?? null;
}

// ── Alt factories ─────────────────────────────────────────────────────────────
function makeCharmAlt(charmName) {
  return { type: 'charm', charmUid: '', charmName: charmName.trim(), abilityKey: '', virtueKey: 'valor', virtueMin: 1 };
}

function makeAnyExcellencyAlt(abilityKey = '') {
  return { type: 'anyExcellency', charmUid: '', charmName: '', abilityKey, virtueKey: 'valor', virtueMin: 1 };
}

function makeVirtueAlt(virtueKey, virtueMin) {
  return { type: 'virtue', charmUid: '', charmName: '', abilityKey: '', virtueKey, virtueMin };
}

// ── Parsers ───────────────────────────────────────────────────────────────────

// Split text by top-level commas (ignore commas inside parentheses)
function splitByTopLevelComma(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      const t = cur.trim();
      if (t) parts.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const last = cur.trim();
  if (last) parts.push(last);
  return parts;
}

// If text matches an "Any X Excellency" pattern, return the appropriate alt;
// else return null.
function tryParseExcellencyAlt(text, hostAbility) {
  // Generic "for the relevant ability" form
  if (/^Any Excellency for the relevant Ability$/i.test(text)) {
    return makeAnyExcellencyAlt('');
  }
  const m = text.match(/^Any\s+(.+?)\s+Excellency$/i);
  if (!m) return null;
  const abilKey = normalizeAbility(m[1]);
  if (!abilKey) {
    // Unknown ability — preserve as a charm-name fallback
    return makeCharmAlt(text);
  }
  if (!hostAbility || abilKey === hostAbility) {
    return makeAnyExcellencyAlt(''); // self-scoped; abilityKey blank = use host
  }
  return makeAnyExcellencyAlt(abilKey); // cross-ability override
}

// If text matches "Virtue N+" return virtue alt; else null.
function tryParseVirtueAlt(text) {
  const m = text.match(/^(Valor|Compassion|Conviction|Temperance)\s+(\d+)\+?$/i);
  if (!m) return null;
  return makeVirtueAlt(m[1].toLowerCase(), parseInt(m[2]));
}

// Parse a single comma-segment (possibly OR-joined) into alternatives.
// Returns { alts, skipped } — skipped is a human-readable reason string or null.
function parseSegment(seg, hostAbility) {
  // Guard: if very long, description text probably bled in during extraction
  let effective = seg;
  if (seg.length > 180) {
    // Try to salvage an "Any X Excellency" pattern at the start
    const excMatch = seg.match(/^(Any\s+\w+(?:\s+\w+)?\s+Excellency)\b/i);
    if (excMatch) {
      effective = excMatch[1];
    } else {
      return { alts: [], skipped: `segment too long (${seg.length} chars)` };
    }
  }

  // Special case: "Any X or Y <Suffix>" where Suffix (Augmentation/Excellency)
  // applies to BOTH X and Y.
  // e.g. "Any Charisma or Manipulation Augmentation"
  // e.g. "Any Dexterity or Wits Augmentation"
  const orSuffixMatch = effective.match(/^Any\s+(\w+)\s+or\s+(\w+)\s+(\w+(?:\s+\w+)?)$/i);
  if (orSuffixMatch) {
    const a = `Any ${orSuffixMatch[1]} ${orSuffixMatch[3]}`;
    const b = `Any ${orSuffixMatch[2]} ${orSuffixMatch[3]}`;
    const altA = tryParseExcellencyAlt(a, hostAbility) ?? makeCharmAlt(a);
    const altB = tryParseExcellencyAlt(b, hostAbility) ?? makeCharmAlt(b);
    return { alts: [altA, altB], skipped: null };
  }

  // Special case: "Strain-Resistant Chassis Modification or X or Y"
  // (genuine OR list of charm names)
  const parts = effective.split(/\s+or\s+/i).map(p => p.trim()).filter(Boolean);
  const alts = [];
  for (const part of parts) {
    if (!part || /^none$/i.test(part)) continue;
    const exc = tryParseExcellencyAlt(part, hostAbility);
    if (exc) { alts.push(exc); continue; }
    const virt = tryParseVirtueAlt(part);
    if (virt) { alts.push(virt); continue; }
    alts.push(makeCharmAlt(part));
  }
  return { alts, skipped: null };
}

function parsePrereqText(text, hostAbility) {
  const warnings = [];
  if (!text) return { groups: [], warnings };
  const cleaned = text.trim();
  if (!cleaned || /^none$/i.test(cleaned)) return { groups: [], warnings };

  const segments = splitByTopLevelComma(cleaned);
  const groups = [];
  for (const seg of segments) {
    if (!seg || /^none$/i.test(seg)) continue;
    const { alts, skipped } = parseSegment(seg.trim(), hostAbility);
    if (skipped) warnings.push(`  [${seg.substring(0, 50)}...] ${skipped}`);
    if (alts.length > 0) groups.push({ alternatives: alts });
  }
  return { groups, warnings };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const packs = readdirSync(BASE).filter(d => d.startsWith('charms-'));
let totalCharms = 0;
let totalWithGroups = 0;
let totalWarnings = 0;
const allWarnings = [];

for (const pack of packs) {
  const dir = join(BASE, pack);
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  let packWithGroups = 0;

  for (const f of files) {
    const path = join(dir, f);
    const doc = JSON.parse(readFileSync(path, 'utf-8'));
    if (doc.type !== 'charm') continue;
    totalCharms++;

    const prereqText  = doc.system?.prereqText  ?? '';
    const hostAbility = doc.system?.ability      ?? '';

    const { groups, warnings } = parsePrereqText(prereqText, hostAbility);

    if (warnings.length > 0) {
      allWarnings.push(`${pack}/${f}:`);
      allWarnings.push(...warnings);
      totalWarnings += warnings.length;
    }

    // Write prereqGroups; remove legacy dead fields
    doc.system.prereqGroups = groups;
    delete doc.system.prereqs;
    delete doc.system.prereqText;

    writeFileSync(path, JSON.stringify(doc, null, 2), 'utf-8');
    if (groups.length > 0) { packWithGroups++; totalWithGroups++; }
  }

  console.log(`  ${pack}: ${packWithGroups} charms with prereqGroups`);
}

if (allWarnings.length > 0) {
  console.log(`\nWarnings (${totalWarnings} skipped segments):`);
  allWarnings.slice(0, 50).forEach(w => console.log(w));
  if (allWarnings.length > 50) console.log(`  ... and ${allWarnings.length - 50} more (check output)`);
}

console.log(`\n✓ ${totalWithGroups}/${totalCharms} charms have prereqGroups. ${totalWarnings} segments skipped.`);
