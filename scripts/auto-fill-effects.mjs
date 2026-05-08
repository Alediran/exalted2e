#!/usr/bin/env node
// scripts/auto-fill-effects.mjs
// Reads all charm packs and fills in mechanical effect fields for charms that
// match implementable patterns but have no effects enabled yet.
//
// Usage:
//   node scripts/auto-fill-effects.mjs          # dry-run (prints changes, writes nothing)
//   node scripts/auto-fill-effects.mjs --write  # apply changes to JSON files
//   node scripts/auto-fill-effects.mjs --pack terrestrial --write  # one pack only

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN  = !process.argv.includes('--write');
const PACK_ARG = (() => { const i = process.argv.indexOf('--pack'); return i !== -1 ? process.argv[i + 1] : null; })();

const BASE = 'src/packs';

const EFFECT_FIELDS = [
  'attack', 'healthGrant', 'soakBonus', 'woundReduction', 'statBoost',
  'moteRecovery', 'healingRoll', 'statusApply', 'motePoolBonus', 'extraActions',
  'dvBonus', 'targetPenalty', 'attackBonus', 'speedModifier', 'rateBonus',
  'willpowerRecovery', 'targetEffect',
];

// ── Helpers ────────────────────────────────────────────────────────────────

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseNum(s) {
  if (!s) return null;
  const trimmed = s.trim().toLowerCase();
  if (WORD_NUM[trimmed] !== undefined) return WORD_NUM[trimmed];
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

function stripHtml(html) {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasAnyEffect(system) {
  return EFFECT_FIELDS.some(f => system[f]?.enabled);
}

// ── Attribute path lookup for statBoost ───────────────────────────────────

const ATTR_PATH = {
  strength:     'system.attributes.strength.value',
  dexterity:    'system.attributes.dexterity.value',
  stamina:      'system.attributes.stamina.value',
  charisma:     'system.attributes.charisma.value',
  manipulation: 'system.attributes.manipulation.value',
  appearance:   'system.attributes.appearance.value',
  perception:   'system.attributes.perception.value',
  intelligence: 'system.attributes.intelligence.value',
  wits:         'system.attributes.wits.value',
};

// ── Analysis: returns { field: patch } or null ─────────────────────────────

function analyzeCharm(doc) {
  const s   = doc.system;
  const desc = stripHtml(s.description ?? '');
  const name = doc.name ?? '';
  const type = s.charmType ?? '';

  if (hasAnyEffect(s)) return null; // already configured

  const updates = {};

  // ── Wound-penalty negation ─────────────────────────────────────────────
  if (/ignores?\s+(?:all\s+)?wound\s+penalt|negates?\s+(?:all\s+)?wound\s+penalt/i.test(desc)) {
    updates.woundReduction = { enabled: true, formula: '' };
  }

  // ── Wound-penalty partial reduction (reduces wound penalty by N) ──────
  const wpReduceMatch = !updates.woundReduction &&
    desc.match(/reduces?\s+wound\s+penalt\w*\s+by\s+(one|two|three|four|five|\d+)/i);
  if (wpReduceMatch) {
    const n = parseNum(wpReduceMatch[1]);
    if (n !== null) updates.woundReduction = { enabled: true, formula: String(-n) };
  }

  // ── Speed reduction ────────────────────────────────────────────────────
  const speedMatch =
    desc.match(/reduces?\s+(?:the\s+)?(?:action\s+)?speed\s+by\s+(one|two|three|four|five|\d+)/i) ||
    desc.match(/speed\s+(?:is\s+)?reduced\s+by\s+(one|two|three|four|five|\d+)/i);
  if (speedMatch) {
    const n = parseNum(speedMatch[1]);
    if (n !== null) updates.speedModifier = { enabled: true, delta: -n, minimum: 3, perMotes: 0 };
  }

  // ── Attack/accuracy dice bonus (fixed integer only) ────────────────────
  const atkDiceMatch =
    desc.match(/adds?\s+(one|two|three|four|five|\d+)\s+dice\s+to\s+(?:the\s+)?(?:accuracy|attack(?:\s+roll)?)/i) ||
    desc.match(/(?:accuracy|attack(?:\s+roll)?)\s+(?:pool\s+)?(?:bonus\s+of\s+)?(one|two|three|four|five|\d+)\s+dice/i);
  if (atkDiceMatch) {
    const n = parseNum(atkDiceMatch[1]);
    if (n !== null) updates.attackBonus = { enabled: true, accuracyDice: String(n), accuracySuccesses: '', damageDice: '', ignoreAccuracyPenalties: false };
  }

  // ── Damage dice bonus (fixed integer only) ─────────────────────────────
  const dmgDiceMatch =
    desc.match(/adds?\s+(one|two|three|four|five|\d+)\s+dice\s+to\s+(?:the\s+)?(?:raw\s+)?damage/i);
  if (dmgDiceMatch) {
    const n = parseNum(dmgDiceMatch[1]);
    if (n !== null) {
      const existing = updates.attackBonus ?? { enabled: true, accuracyDice: '', accuracySuccesses: '', ignoreAccuracyPenalties: false };
      updates.attackBonus = { ...existing, damageDice: String(n) };
    }
  }

  // ── Soak bonus (fixed integer, type detection) ─────────────────────────
  const soakMatch =
    desc.match(/(?:adds?|grants?|provides?|gains?)\s+(one|two|three|four|five|\d+)\s+(?:additional\s+)?(?:points?\s+of\s+)?(?:(lethal|bashing|aggravated)\s+)?soak/i) ||
    desc.match(/soak\s+(?:is\s+)?(?:increased|improved)\s+by\s+(one|two|three|four|five|\d+)/i) ||
    desc.match(/(?:\+)(one|two|three|four|five|\d+)\s+soak/i);
  if (soakMatch) {
    const raw = soakMatch[1];
    const n = parseNum(raw);
    if (n !== null) {
      const isAgg  = /aggravated/i.test(soakMatch[0]);
      const isBash = /bashing/i.test(soakMatch[0]) && !isAgg;
      const isLeth = !isBash && !isAgg;
      updates.soakBonus = {
        enabled: true,
        bashing:           isBash ? n : 0,
        lethal:            isLeth ? n : 0,
        aggravated:        isAgg  ? n : 0,
        hardnessAdd:       0,
        hardnessSetTo:     0,
        bashingFormula:    '',
        lethalFormula:     '',
        aggravatedFormula: '',
      };
    }
  }

  // ── Dodge DV bonus (fixed integer) ─────────────────────────────────────
  const dodgeMatch =
    desc.match(/adds?\s+(one|two|three|four|five|\d+)\s+(?:to\s+)?(?:(?:\w+\s+)?)?dodge\s+(?:dv|defense)/i) ||
    desc.match(/dodge\s+(?:dv|defense)\s+(?:by\s+|of\s+|is\s+increased\s+by\s+)(one|two|three|four|five|\d+)/i) ||
    desc.match(/increases?\s+(?:his|her|the\s+\w+(?:'s)?|their)?\s*dodge\s+(?:dv|defense)\s+by\s+(one|two|three|four|five|\d+)/i);
  if (dodgeMatch) {
    const n = parseNum(dodgeMatch[1]);
    if (n !== null) updates.dvBonus = { enabled: true, dodgeBonus: n, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: [], dodgeBonusFormula: '', parryBonusFormula: '' };
  }

  // ── Parry DV bonus (fixed integer) ─────────────────────────────────────
  const parryMatch =
    desc.match(/adds?\s+(one|two|three|four|five|\d+)\s+(?:to\s+)?(?:(?:\w+\s+)?)?parry\s+(?:dv|defense)/i) ||
    desc.match(/parry\s+(?:dv|defense)\s+(?:by\s+|of\s+|is\s+increased\s+by\s+)(one|two|three|four|five|\d+)/i) ||
    desc.match(/increases?\s+(?:his|her|the\s+\w+(?:'s)?|their)?\s*parry\s+(?:dv|defense)\s+by\s+(one|two|three|four|five|\d+)/i);
  if (parryMatch) {
    const n = parseNum(parryMatch[1]);
    if (n !== null) {
      const existing = updates.dvBonus ?? { enabled: true, dodgeBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: [], dodgeBonusFormula: '', parryBonusFormula: '' };
      updates.dvBonus = { ...existing, parryBonus: n };
    }
  }

  // ── Mote recovery (fixed integer, peripheral default) ─────────────────
  const moteMatch =
    desc.match(/(?:regains?|recovers?|respires?|gains?)\s+(one|two|three|four|five|\d+)\s+(?:committed\s+)?motes?/i);
  if (moteMatch) {
    const n = parseNum(moteMatch[1]);
    if (n !== null) {
      const isPersonal = /personal/i.test(desc);
      updates.moteRecovery = {
        enabled: true,
        event:   'onDamageReceived',
        action:  isPersonal ? 'recoverPersonal' : 'recoverPeripheral',
        formula: String(n),
      };
    }
  }

  // ── Willpower recovery ─────────────────────────────────────────────────
  if (
    /(?:regains?|recovers?|gains?)\s+(?:one\s+)?(?:point\s+of\s+)?willpower/i.test(desc) ||
    /willpower\b.{0,80}(?:regains?|recovers?|gains?)/i.test(desc)
  ) {
    const wpMatch = desc.match(/(?:regains?|recovers?|gains?)\s+(one|two|three|\d+)\s+(?:points?\s+of\s+)?willpower/i);
    const n = wpMatch ? (parseNum(wpMatch[1]) ?? 1) : 1;
    updates.willpowerRecovery = { enabled: true, event: 'onDamageDealt', formula: String(n) };
  }

  // ── Healing roll (fixed integer levels) ───────────────────────────────
  const healMatch =
    desc.match(/heals?\s+(one|two|three|four|five|\d+)\s+(?:levels?\s+of\s+)?(bashing|lethal|aggravated)\s+damage/i) ||
    desc.match(/(?:restores?|repairs?)\s+(one|two|three|four|five|\d+)\s+(?:levels?\s+of\s+)?(bashing|lethal|aggravated)/i);
  if (healMatch) {
    const n = parseNum(healMatch[1]);
    const dt = /aggravated/i.test(healMatch[2]) ? 'aggravated'
             : /lethal/i.test(healMatch[2])     ? 'lethal'
             : 'bashing';
    if (n !== null) updates.healingRoll = { enabled: true, pool: String(n), bonus: '', damageType: dt, target: 'self' };
  }

  // ── Mote pool expansion (Essence Plethora family) ─────────────────────
  const poolMatch =
    desc.match(/(?:adds?|grants?|provides?|gains?)\s+(one|two|three|four|five|ten|\d+)\s+(?:additional\s+)?(?:peripheral\s+)?motes?\s+(?:to\s+(?:the\s+)?(?:her|his|their|the\s+\w+'s)\s+)?(?:mote\s+)?pool/i) ||
    desc.match(/(?:peripheral|personal)\s+mote\s+pool\s+(?:is\s+)?(?:increases?|expands?)\s+by\s+(one|two|three|four|five|ten|\d+)/i);
  if (poolMatch && !updates.moteRecovery) {
    const n = parseNum(poolMatch[1]);
    if (n !== null) {
      const isPersonal = /personal/i.test(poolMatch[0]);
      updates.motePoolBonus = { enabled: true, pool: isPersonal ? 'personal' : 'peripheral', amount: n };
    }
  }

  // ── Transpuissant X Upgrade (Alchemical) — name-based ─────────────────
  const transpMatch = name.match(/Transpuissant\s+(\w+)\s+Upgrade/i);
  if (transpMatch) {
    const attr = transpMatch[1].toLowerCase();
    const path = ATTR_PATH[attr];
    if (path) updates.statBoost = { enabled: true, changes: [{ path, value: '1' }] };
  }

  // ── Status effects (non-permanent charms only) ─────────────────────────
  if (type !== 'permanent' && !updates.statusApply) {
    if (/\bcrippl(?:ing|ed)\b/i.test(desc))
      updates.statusApply = { enabled: true, status: 'Crippling', resistPool: '@sta + @resistance', onFail: 'applyCrippling' };
    else if (/\bpoisoned?\b/i.test(desc))
      updates.statusApply = { enabled: true, status: 'Poisoned', resistPool: '@sta + @resistance', onFail: 'applyPoison' };
    else if (/\bsickness\b/i.test(desc))
      updates.statusApply = { enabled: true, status: 'Sickness', resistPool: '@sta + @resistance', onFail: 'applySickness' };
    else if (/\bblinded?\b/i.test(desc))
      updates.statusApply = { enabled: true, status: 'Blinded', resistPool: '@per + @awareness', onFail: 'applyBlind' };
    else if (/\bknockback\b/i.test(desc))
      updates.statusApply = { enabled: true, status: 'Knockback', resistPool: '@sta + @athletics', onFail: 'applyKnockback' };
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

// ── Main ───────────────────────────────────────────────────────────────────

let totalChanged = 0;
let totalSkipped = 0;

for (const packDir of readdirSync(BASE).filter(d => d.startsWith('charms-'))) {
  const packLabel = packDir.replace('charms-', '');
  if (PACK_ARG && packLabel !== PACK_ARG) continue;

  const dir = join(BASE, packDir);
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

  for (const file of files) {
    const path = join(dir, file);
    const doc  = JSON.parse(readFileSync(path, 'utf-8'));
    if (doc.type !== 'charm') continue;

    const updates = analyzeCharm(doc);
    if (!updates) { totalSkipped++; continue; }

    console.log(`\n[${packLabel}] ${doc.name}`);
    for (const [field, patch] of Object.entries(updates)) {
      console.log(`  ${field}:`, JSON.stringify(patch));
    }

    if (!DRY_RUN) {
      for (const [field, patch] of Object.entries(updates)) {
        doc.system[field] = { ...(doc.system[field] ?? {}), ...patch };
      }
      writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
    }

    totalChanged++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Charms that would be/were updated: ${totalChanged}`);
console.log(`Charms skipped (already configured or no match): ${totalSkipped}`);
if (DRY_RUN) console.log('\n⚠  DRY RUN — pass --write to apply changes');
