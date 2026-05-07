#!/usr/bin/env node
/**
 * extract-charm-effects.mjs
 * First-pass mechanical-effect extraction for all charm JSON source files.
 *
 * Handles effects whose values can be reliably parsed from charm description text:
 *   M2  soakBonus       — "adds N to [Type] soak"
 *   M3  woundReduction  — "ignores wound penalties"
 *   M8  motePoolBonus   — "adds N motes to [peripheral|personal] pool"
 *   M10 dvBonus         — "ignore[s] penalties … Parry/Dodge DV" | "adds N to Parry/Dodge DV"
 *   M13 speedModifier   — "reduces Speed by N"
 *
 * Effects that need AI reasoning (healing rolls, mote recovery events, attack
 * bonus formulas, status-apply conditions, stat boosts) are left for a follow-up pass.
 *
 * Usage:
 *   node scripts/extract-charm-effects.mjs [--dry-run]
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY = process.argv.includes('--dry-run');
const BASE = 'src/packs';

function strip(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function numWord(w) {
  const map = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
  const n = parseInt(w);
  return isNaN(n) ? (map[w.toLowerCase()] ?? null) : n;
}

// ── M3: woundReduction ───────────────────────────────────────────────────────
// "ignores all wound penalties" / "negates wound penalties"
const WOUND_IGNORE_RE = /ignores?\s+(?:all\s+)?wound\s+penalt(?:y|ies)|negates?\s+(?:all\s+)?wound\s+penalt/i;
// "reduces all wound penalties by one/two/N"
const WOUND_REDUCE_BY_RE = /reduces?\s+(?:all\s+)?wound\s+penalt(?:y|ies)\s+by\s+(one|two|three|\d)/i;

function extractWoundReduction(desc) {
  if (WOUND_IGNORE_RE.test(desc)) return { enabled: true, formula: '' };
  const m = desc.match(WOUND_REDUCE_BY_RE);
  if (m) {
    const n = numWord(m[1]);
    if (!n) return null;
    return { enabled: true, formula: String(-n) };
  }
  return null;
}

// ── M8: motePoolBonus ────────────────────────────────────────────────────────
// "adds N motes to [her/his/the] peripheral/personal [Essence] pool"
// "increases [her/his/the] peripheral pool by N"
// "permanent … N motes to peripheral/personal"
const POOL_RE = /(?:adds?\s+|increase[sd]?\s+(?:\w+\s+){0,3})(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+motes?\s+to\s+(?:\w+\s+){0,2}?(peripheral|personal)/i;
const POOL_RE2 = /(?:peripheral|personal)\s+(?:essence\s+)?pool\s+(?:capable of holding|of)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+motes?/i;

function extractMotePoolBonus(desc) {
  let m = desc.match(POOL_RE);
  if (m) {
    const amount = numWord(m[1]);
    if (!amount) return null;
    const pool = m[2].toLowerCase();
    return { enabled: true, pool, amount };
  }
  m = desc.match(POOL_RE2);
  if (m) {
    const amount = numWord(m[1]);
    if (!amount) return null;
    // Determine pool from the preceding context
    const poolMatch = desc.match(/(peripheral|personal)\s+(?:essence\s+)?pool\s+(?:capable of holding|of)\s+\d/i);
    const pool = poolMatch ? poolMatch[1].toLowerCase() : 'peripheral';
    return { enabled: true, pool, amount };
  }
  return null;
}

// ── M2: soakBonus ────────────────────────────────────────────────────────────
// Only matches fixed-number bonuses; skips per-mote / per-success formula bonuses.
// "+NB/+NL soak" shorthand (e.g. "+15 bashing soak")
const SOAK_SHORTHAND_RE = /\+(\d+)\s*(bashing|lethal|aggravated)\s+(?:natural\s+)?soak(?!\s+for\s+every|\s+per\s+mote)/gi;
// "adds N [Type] soak" — NOT followed by "for every" / "per mote"
const SOAK_ADD_RE = /adds?\s+(\d+|one|two|three|four|five|six|seven|eight)\s+(?:points?\s+of\s+)?(?:to\s+)?(?:(?:his|her|their)\s+)?(bashing|lethal|aggravated)\s+soak(?!\s+for\s+every|\s+per)/gi;

// Returns true if the match position is followed within 25 chars by "for every" or "per mote"
function isPerMote(desc, matchEnd) {
  return /^\s+(?:for\s+every|per\s+mote)/.test(desc.slice(matchEnd, matchEnd + 25));
}

function extractSoakBonus(desc) {
  const bonus = { bashing: 0, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 };
  let found = false;

  SOAK_SHORTHAND_RE.lastIndex = 0;
  let m;
  while ((m = SOAK_SHORTHAND_RE.exec(desc)) !== null) {
    const n = parseInt(m[1]);
    const type = m[2].toLowerCase();
    if (!n) continue;
    if (isPerMote(desc, m.index + m[0].length)) continue;
    if (type === 'bashing')    { bonus.bashing    = Math.max(bonus.bashing,    n); found = true; }
    if (type === 'lethal')     { bonus.lethal      = Math.max(bonus.lethal,     n); found = true; }
    if (type === 'aggravated') { bonus.aggravated  = Math.max(bonus.aggravated, n); found = true; }
  }

  SOAK_ADD_RE.lastIndex = 0;
  while ((m = SOAK_ADD_RE.exec(desc)) !== null) {
    const n = numWord(m[1]);
    const type = m[2].toLowerCase();
    if (!n) continue;
    if (isPerMote(desc, m.index + m[0].length)) continue;
    if (type === 'bashing')    { bonus.bashing    = Math.max(bonus.bashing,    n); found = true; }
    if (type === 'lethal')     { bonus.lethal      = Math.max(bonus.lethal,     n); found = true; }
    if (type === 'aggravated') { bonus.aggravated  = Math.max(bonus.aggravated, n); found = true; }
  }

  if (!found) return null;
  return { enabled: true, ...bonus };
}

// ── M10: dvBonus ─────────────────────────────────────────────────────────────
// "ignore[s] penalties … Parry/Dodge DV"
const DV_IGNORE_RE = /ignores?\s+(?:all\s+)?penalt(?:y|ies)\s+(?:that\s+apply\s+to|to|on|against)\s+(?:his|her|their|the)?\s*(?:parry|dodge)\s+dv/i;
// "adds N to [Parry|Dodge] DV"
const DV_ADD_PARRY_RE = /adds?\s+(\d+)\s+(?:dice\s+)?(?:to\s+)?(?:his|her|their|the)?\s*parry\s+dv/i;
const DV_ADD_DODGE_RE = /adds?\s+(\d+)\s+(?:dice\s+)?(?:to\s+)?(?:his|her|their|the)?\s*dodge\s+dv/i;

function extractDvBonus(desc) {
  const result = { dodgeBonus: 0, parryBonus: 0, ignoreAllPenalties: false, ignorePenaltyTypes: [] };
  let found = false;

  if (DV_IGNORE_RE.test(desc)) {
    result.ignoreAllPenalties = true;
    found = true;
  }
  const parry = desc.match(DV_ADD_PARRY_RE);
  if (parry) { result.parryBonus = parseInt(parry[1]); found = true; }
  const dodge = desc.match(DV_ADD_DODGE_RE);
  if (dodge) { result.dodgeBonus = parseInt(dodge[1]); found = true; }

  if (!found) return null;
  return { enabled: true, ...result };
}

// ── M5: moteRecovery ─────────────────────────────────────────────────────────
// Forward kill: "respires N mote per victim" / "regains N mote each time [X] kills"
const MR_KILL_FWD = /(?:regains?|recovers?|respires?|gains?)\s+(one|two|three|\d+)\s+motes?\s+(?:of\s+essence\s+)?(?:per\s+victim|each\s+time\s+(?:\w+\s+){0,3}kills?|whenever\s+(?:\w+\s+){0,3}kills?|when\s+(?:\w+\s+){0,3}kills?)/i;
// Reverse kill: "whenever [X] kills ... regains N mote"
const MR_KILL_REV = /(?:each\s+time|whenever|when)\s+(?:the\s+\w+|\w+)\s+kills?[^.]{0,120}?(?:regains?|recovers?|gains?)\s+(one|two|three|\d+)\s+motes?/i;
// Attack success: "regains N mote whenever [X] successfully strikes/hits an animate being/target"
const MR_ATK_RE = /(?:regains?|recovers?|gains?)\s+(one|two|three|\d+)\s+motes?\s+(?:of\s+essence\s+)?(?:each\s+time|whenever|when)\s+[^.]{0,60}?(?:successfully\s+)?(?:strikes?|hits?)\s+(?:an?\s+)?(?:animate\s+)?(?:being|target|enemy|creature|opponent)/i;
// Damage received: "receives N motes equal to [permanent] Essence"
const MR_DMG_ESS_RE = /(?:receives?|regains?|gains?)\s+(?:a\s+number\s+of\s+)?motes?\s+(?:of\s+essence\s+)?equal\s+to\s+(?:(?:her|his|their|the\s+\w+'?s?)\s+)?(?:permanent\s+)?essence/i;

function extractMoteRecovery(desc) {
  let m = desc.match(MR_KILL_FWD);
  if (m) {
    const n = numWord(m[1]);
    return { enabled: true, event: 'onKill', action: 'recoverPeripheral', formula: n ? String(n) : '1' };
  }
  m = desc.match(MR_KILL_REV);
  if (m) {
    const n = numWord(m[1]);
    return { enabled: true, event: 'onKill', action: 'recoverPeripheral', formula: n ? String(n) : '1' };
  }
  m = desc.match(MR_ATK_RE);
  if (m) {
    const n = numWord(m[1]);
    return { enabled: true, event: 'onAttackSuccess', action: 'recoverPeripheral', formula: n ? String(n) : '1' };
  }
  if (MR_DMG_ESS_RE.test(desc)) {
    return { enabled: true, event: 'onDamageReceived', action: 'recoverPeripheral', formula: '@ess' };
  }
  return null;
}

// ── M11: targetPenalty ───────────────────────────────────────────────────────
// Explicit target reference: "target/victim/opponent suffers -N [internal] penalty"
const TP_SUFFERS_RE = /(?:target|victim|opponent|foe|enemy)(?:'s)?\s+suffers?\s+(?:an?\s+)?(?:internal\s+)?-(\d+)\s+(?:internal\s+)?penalt(?:y|ies)/i;
// "imposes -N penalty [on/to] the target"
const TP_IMPOSES_RE = /imposes?\s+(?:an?\s+)?-(\d+)\s+(?:internal\s+)?penalt(?:y|ies)[^.]{0,80}?(?:target|victim|opponent)/i;
// Duration cues
const TP_UNTIL_NEXT_RE = /until[^.]{0,30}?next\s+action|for\s+the\s+next\s+(?:(?:two|three|four|\d+)\s+)?actions?/i;
const TP_SCENE_RE = /for\s+the\s+(?:rest\s+of\s+the\s+)?scene|for\s+(?:a|one)\s+scene/i;
// Scope cues
const TP_PHYSICAL_RE = /all\s+physical\s+actions?/i;
const TP_DV_RE = /\bddv\b|\bpdv\b|parry\s+dv|dodge\s+dv|both\s+dvs?/i;

function extractTargetPenalty(desc) {
  let m = desc.match(TP_SUFFERS_RE) ?? desc.match(TP_IMPOSES_RE);
  if (!m) return null;
  const amount = -parseInt(m[1]);
  const ctx = desc.slice(m.index, m.index + 200);

  let duration = 'oneScene';
  if (TP_UNTIL_NEXT_RE.test(ctx)) duration = 'untilNextAction';
  else if (TP_SCENE_RE.test(ctx)) duration = 'oneScene';

  let scope = 'all';
  if (TP_PHYSICAL_RE.test(ctx)) scope = 'physical';
  else if (TP_DV_RE.test(ctx)) scope = 'dv';

  return { enabled: true, amount, scope, duration };
}

// ── M14: rateBonus ───────────────────────────────────────────────────────────
// "adds N to the Rate [of weapon]" — negative lookahead prevents "rate of one per"
const RATE_BONUS_RE = /adds?\s+(one|two|three|\d+)\s+to\s+(?:(?:the\s+)?(?:weapon'?s?\s+)?)?(?:maximum\s+)?rate(?!\s+of\s+(?:one|two|\d))/i;

function extractRateBonus(desc) {
  const m = desc.match(RATE_BONUS_RE);
  if (!m) return null;
  const n = numWord(m[1]);
  if (!n) return null;
  return { enabled: true, formula: String(n) };
}

// ── M13: speedModifier ───────────────────────────────────────────────────────
// Actual description patterns found across all packs:
//   "reduces the Speed of Martial Arts attacks by 1, to a minimum of 3"
//   "reduces the Speed of a Lunar's action by one for every two motes spent"
//   "reduces the Speed of all social combat actions by one while the Charm lasts"
//   "reduce the Speed by one and add two to the weapons' Defense"
//   "reduces the Speed of an Archery-based attack by one tick for every two motes spent"
//   "for every two motes spent, reduces Speed by one" (reverse order)

// Non-greedy middle `[^.!?]{0,60}?` avoids crossing sentence boundaries while
// still handling apostrophes ("Lunar's") and hyphens ("Archery-based").

// Per-mote forward: "reduces Speed [of …] by one [tick] for every N motes"
const SPEED_PERMOTE_FWD = /reduces?\s+(?:the\s+)?[Ss]peed[^.!?]{0,60}?by\s+(?:one|1)\s+(?:tick\s+)?for\s+(?:every|each)\s+(\d+|two|one)\s+motes?/i;
// Per-mote reverse: "for every N motes, reduces Speed by one"
const SPEED_PERMOTE_REV = /for\s+(?:every|each)\s+(\d+|two|one)\s+motes?\s+(?:spent)?,?\s+(?:this\s+charm\s+)?reduces?\s+(?:the\s+)?(?:[^.!?]{0,30}?\s+)?[Ss]peed\s+by\s+(?:one|1)/i;
// Flat reduction: "reduces the Speed [of …] by one|two|N"
// Excludes "by one yard" (movement speed in yards, not combat Speed ticks)
const SPEED_FLAT = /reduces?\s+(?:the\s+)?[Ss]peed[^.!?]{0,60}?by\s+(one|two|three|1|2|3)(?!\s+(?:motes?\s+spent|yards?))/i;
// Minimum floor: "to a minimum of N" or "(minimum N)"
const SPEED_MIN = /(?:to\s+a\s+minimum\s+of|\(\s*minimum)\s+(three|two|four|3|2|4)/i;

function extractSpeedModifier(desc) {
  // Per-mote — forward order
  let m = desc.match(SPEED_PERMOTE_FWD);
  if (m) {
    const perMotes = numWord(m[1]) ?? 2;
    const minM = desc.match(SPEED_MIN);
    const minimum = minM ? (numWord(minM[1]) ?? 3) : 3;
    return { enabled: true, delta: -1, minimum, perMotes };
  }
  // Per-mote — reverse order
  m = desc.match(SPEED_PERMOTE_REV);
  if (m) {
    const perMotes = numWord(m[1]) ?? 2;
    return { enabled: true, delta: -1, minimum: 3, perMotes };
  }
  // Flat reduction
  m = desc.match(SPEED_FLAT);
  if (m) {
    const delta = -(numWord(m[1]) ?? 1);
    const minM = desc.match(SPEED_MIN);
    const minimum = minM ? (numWord(minM[1]) ?? 3) : 3;
    return { enabled: true, delta, minimum, perMotes: 0 };
  }
  return null;
}

// ── M1: healthGrant ──────────────────────────────────────────────────────────
// "grants [the character] one additional -0 health level"
// "one -1 health level and two -2 health levels"
const HL_GRANT_RE = /(?:grants?\s+(?:\w+\s+){0,4}|gives?\s+(?:\w+\s+){0,4})((?:one|two|three|four|1|2|3|4)\s+additional\s+-(?:0|1|2|4|X)\s+health\s+level)/gi;
const HL_INDIVIDUAL_RE = /(?<!\-)(-[0-4])\s+health\s+levels?\s*[,:;]?\s*(?:and\s+(-[0-4])\s+health\s+levels?)?/gi;

function parseHealthGrants(desc) {
  // Look for patterns like "one additional -0 health level and two additional -1 health levels and one -2"
  const numMap = { one:1, two:2, three:3, four:4, 1:1, 2:2, 3:3, 4:4 };
  const result = { zero: 0, one: 0, two: 0, dying: 0 };
  let found = false;

  // Pattern: "(one|two|three) additional|extra -(0|1|2|4) [health] level(s)?"
  const HL_RE = /(one|two|three|four|\d)\s+(?:additional|extra)\s+-(0|1|2|4)\s+(?:health\s+)?levels?/gi;
  let m;
  while ((m = HL_RE.exec(desc)) !== null) {
    const count = numMap[m[1].toLowerCase()] ?? parseInt(m[1]);
    const lvl = m[2];
    if (!count) continue;
    if (lvl === '0') result.zero += count;
    else if (lvl === '1') result.one += count;
    else if (lvl === '2') result.two += count;
    else if (lvl === '4') result.dying += count;
    found = true;
  }

  if (!found) return null;
  return { enabled: true, options: [{ label: 'Purchase', ...result }] };
}

// ── M12: attackBonus ─────────────────────────────────────────────────────────
// Only for supplemental charms with explicit numeric accuracy and/or damage bonuses.
// "improving its Accuracy by N and its Damage by M"
const ATK_ACC_DMG_RE = /improving\s+(?:its|his|her|the)?\s*(?:base\s+)?accuracy\s+by\s+(\d+|one|two|three)\s+and\s+(?:its|his|her|the)?\s*(?:base\s+)?damage\s+by\s+(\d+|one|two|three)/i;
// "improves Accuracy by N" without damage
const ATK_ACC_ONLY_RE = /(?:improves?\s+(?:its|his|her)?\s*accuracy\s+by|adds?\s+(\d+|one|two|three)\s+dice\s+to\s+(?:his|her|its|the)?\s*accuracy)\s+(\d+|one|two|three)/i;
// nullifies all penalties to accuracy
const ATK_NO_PENALTY_RE = /null(?:ifies?|ify)\s+all\s+penalties\s+to\s+(?:the\s+)?accuracy|ignores?\s+all\s+(?:attack\s+)?accuracy\s+penalt/i;

function extractAttackBonus(desc, charmType) {
  if (charmType !== 'supplemental') return null;
  const result = { accuracyDice: '', accuracySuccesses: '', damageDice: '', ignoreAccuracyPenalties: false };
  let found = false;

  const m1 = desc.match(ATK_ACC_DMG_RE);
  if (m1) {
    result.accuracyDice = String(numWord(m1[1]) ?? m1[1]);
    result.damageDice   = String(numWord(m1[2]) ?? m1[2]);
    found = true;
  }
  if (!found) {
    const m2 = desc.match(ATK_ACC_ONLY_RE);
    if (m2) {
      result.accuracyDice = String(numWord(m2[1] ?? m2[2]) ?? 1);
      found = true;
    }
  }
  if (ATK_NO_PENALTY_RE.test(desc)) {
    result.ignoreAccuracyPenalties = true;
    found = true;
  }

  if (!found) return null;
  return { enabled: true, ...result };
}

// ── M9: extraActions ─────────────────────────────────────────────────────────
// Only for charms of type "extraaction".
// Extracts maxFormula from "(Trait [+ N] [* N])" patterns and costPerAction from
// "each attack costs N motes" patterns.

const TRAIT_KEY = {
  essence: '@ess', dexterity: '@dex', wits: '@wit', strength: '@str',
  stamina: '@sta', charisma: '@cha', manipulation: '@man', appearance: '@app',
  perception: '@per', intelligence: '@int', thrown: '@thrown', melee: '@melee',
  archery: '@archery', 'martial arts': '@martialarts', 'martial art': '@martialarts',
  athletics: '@athletics', dodge: '@dodge', resistance: '@resistance',
  lore: '@lore', awareness: '@awareness', war: '@war',
};

// "(Essence + 1)" / "(her Dexterity + 3)" / "(Dexterity x 2)" / "(Wits)"
// Groups: [1] trait, [2] operator (+|x|*), [3] operand
const EXTRA_COUNT_RE = /(?:total\s+number\s+of\s+attacks\s+equal\s+to\s+\(|(?:up\s+to|(?:buys?|makes?|perform(?:s|ing)?)\s+(?:up\s+to\s+)?)\()(?:his\s+|her\s+|the\s+(?:\w+\s+)?)?(?:permanent\s+)?((?:martial\s+arts?|[\w]+))(?:\s*(\+|[x\*])\s*(\d+))?\s*\)/i;
// "each attack costs N motes" / "costs N motes, including the first"
const EXTRA_COST_RE = /each\s+attack\s+costs?\s+(\d+|one|two|three)\s+motes?|costs?\s+(\d+|one|two|three)\s+motes?(?:\s+of\s+essence)?,\s+including\s+the\s+first/i;

function extractExtraActions(desc, charmType) {
  if (charmType !== 'extraaction') return null;
  const m = desc.match(EXTRA_COUNT_RE);
  if (!m) return null;
  const traitKey = TRAIT_KEY[m[1].toLowerCase().trim()];
  if (!traitKey) return null;

  let maxFormula = traitKey;
  if (m[3]) {
    const op  = /^[x\*]$/i.test(m[2]) ? '*' : '+';
    maxFormula = `${traitKey} ${op} ${m[3]}`;
  }

  const costM = desc.match(EXTRA_COST_RE);
  let costPerAction = 0;
  if (costM) {
    const raw = costM[1] ?? costM[2] ?? '';
    costPerAction = numWord(raw) ?? 0;
  }
  return { enabled: true, maxFormula, costPerAction };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const packs = readdirSync(BASE).filter(d => d.startsWith('charms-'));
const stats = { total: 0, updated: 0, perMech: {} };
const MECHS = ['healthGrant','soakBonus','woundReduction','motePoolBonus','dvBonus','speedModifier','extraActions','attackBonus','moteRecovery','targetPenalty','rateBonus'];
for (const m of MECHS) stats.perMech[m] = 0;

for (const pack of packs) {
  const dir = join(BASE, pack);
  let packUpdated = 0;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'))) {
    const path = join(dir, f);
    const doc = JSON.parse(readFileSync(path, 'utf-8'));
    if (doc.type !== 'charm') continue;
    stats.total++;

    // Limit to first 100 000 chars to exclude compilation charms (So Speaks X are ~450 K chars)
    // while keeping all normal charms (longest ~23 K chars)
    const desc = strip(doc.system?.description ?? '').slice(0, 100_000);
    let changed = false;

    const wr = extractWoundReduction(desc);
    if (wr) {
      doc.system.woundReduction = wr;
      stats.perMech.woundReduction++;
      changed = true;
    }

    const mpb = extractMotePoolBonus(desc);
    if (mpb) {
      doc.system.motePoolBonus = mpb;
      stats.perMech.motePoolBonus++;
      changed = true;
    }

    const sb = extractSoakBonus(desc);
    if (sb) {
      doc.system.soakBonus = sb;
      stats.perMech.soakBonus++;
      changed = true;
    }

    const dv = extractDvBonus(desc);
    if (dv) {
      doc.system.dvBonus = dv;
      stats.perMech.dvBonus++;
      changed = true;
    }

    const sm = extractSpeedModifier(desc);
    if (sm) {
      doc.system.speedModifier = sm;
      stats.perMech.speedModifier++;
      changed = true;
    }

    const hg = parseHealthGrants(desc);
    if (hg) {
      doc.system.healthGrant = hg;
      stats.perMech.healthGrant++;
      changed = true;
    }

    const ea = extractExtraActions(desc, doc.system?.charmType);
    if (ea) {
      doc.system.extraActions = ea;
      stats.perMech.extraActions++;
      changed = true;
    }

    const ab = extractAttackBonus(desc, doc.system?.charmType);
    if (ab) {
      doc.system.attackBonus = ab;
      stats.perMech.attackBonus++;
      changed = true;
    }

    const mr = extractMoteRecovery(desc);
    if (mr) {
      doc.system.moteRecovery = mr;
      stats.perMech.moteRecovery++;
      changed = true;
    }

    // Guard: only extract targetPenalty if not already manually set
    if (!doc.system.targetPenalty?.enabled) {
      const tp = extractTargetPenalty(desc);
      if (tp) {
        doc.system.targetPenalty = tp;
        stats.perMech.targetPenalty++;
        changed = true;
      }
    }

    const rb = extractRateBonus(desc);
    if (rb) {
      doc.system.rateBonus = rb;
      stats.perMech.rateBonus++;
      changed = true;
    }

    if (changed) {
      packUpdated++;
      stats.updated++;
      if (!DRY) writeFileSync(path, JSON.stringify(doc, null, 2), 'utf-8');
    }
  }
  console.log(`  ${pack}: ${packUpdated} updated`);
}

console.log(`\n✓ Updated ${stats.updated}/${stats.total} charms${DRY ? ' (dry run)' : ''}`);
console.log('Per mechanism:');
for (const [k, v] of Object.entries(stats.perMech)) console.log(`  ${k.padEnd(20)} ${v}`);
