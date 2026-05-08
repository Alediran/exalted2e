#!/usr/bin/env node
// scripts/patch-could-have-charms.mjs
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'src/packs/charms';

const PATCHES = [
  // ── soakBonus ────────────────────────────────────────────────────────────────
  { file: 'alchemical-subcutaneous-armor-plating.json',
    patch: { soakBonus: { enabled: true, bashing: 3, lethal: 3 } } },

  { file: 'alchemical-strain-resistant-chassis-modification.json',
    patch: { soakBonus: { enabled: true, bashing: 2, lethal: 2 } } },

  { file: 'inkmonkeys-devil-tyrant-avatar-shintai.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@ess', lethalFormula: '@ess' } } },

  { file: 'lunar-armor-forming-technique.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@ess * 3', lethalFormula: '@ess * 3', aggravatedFormula: '@ess' } } },

  { file: 'lunar-soak-enhancement-charms-hide-toughening-essence.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@ess * 2', lethalFormula: '@ess * 2' } } },

  { file: 'sidereal-optimistic-security-practice.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@ess', lethalFormula: '@ess' } } },

  { file: 'solar-durability-of-oak-meditation.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@sta', lethalFormula: '@sta' } } },

  { file: 'terrestrial-element-protection-form.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@ess', lethalFormula: '@ess' } } },

  // This one gets BOTH soakBonus AND dvBonus
  { file: 'terrestrial-elemental-defense-technique.json',
    patch: { soakBonus: { enabled: true, bashing: 2, lethal: 2 },
             dvBonus:   { enabled: true, dodgeBonus: 2, parryBonus: 2 } } },

  { file: 'terrestrial-impervious-skin-of-stone-meditation.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@sta', lethalFormula: '@sta' } } },

  { file: 'terrestrial-strength-of-stone-technique.json',
    patch: { soakBonus: { enabled: true, bashingFormula: '@sta', lethalFormula: '@sta' } } },

  // ── dvBonus ──────────────────────────────────────────────────────────────────
  { file: 'alchemical-accelerated-response-system-dodge.json',
    patch: { dvBonus: { enabled: true, dodgeBonusFormula: '@ess' } } },

  { file: 'alchemical-accelerated-response-system-parry.json',
    patch: { dvBonus: { enabled: true, parryBonusFormula: '@ess' } } },

  { file: 'alchemical-light-etched-interceptor-barrier.json',
    patch: { dvBonus: { enabled: true, parryBonus: 3 } } },

  { file: 'inkmonkeys-flawless-mirror-trance.json',
    patch: { dvBonus: { enabled: true, parryBonusFormula: '@ess' } } },

  { file: 'sidereal-forward-thinking-technique.json',
    patch: { dvBonus: { enabled: true, dodgeBonusFormula: '@ess' } } },

  { file: 'terrestrial-defense-from-anathema-method.json',
    patch: { dvBonus: { enabled: true, dodgeBonusFormula: '@ess', parryBonusFormula: '@ess' } } },

  // ── perfectDefenseType ───────────────────────────────────────────────────────
  { file: 'alchemical-precalculated-evasion-system.json',
    patch: { perfectDefenseType: 'dodge' } },

  { file: 'inkmonkeys-beast-spirit-defense.json',
    patch: { perfectDefenseType: 'parry' } },

  { file: 'terrestrial-portentous-comet-deflecting-mode.json',
    patch: { perfectDefenseType: 'parry' } },

  { file: 'terrestrial-unassailable-body-of-element-defense.json',
    patch: { perfectDefenseType: 'dodge' } },

  // ── attackBonus ──────────────────────────────────────────────────────────────
  { file: 'solar-fire-and-stones-strike.json',
    patch: { attackBonus: { enabled: true, damageDice: '@str' } } },

  { file: 'terrestrial-falling-star-maneuver.json',
    patch: { attackBonus: { enabled: true, damageDice: '@ess * 2' } } },

  // ── motePoolBonus ────────────────────────────────────────────────────────────
  { file: 'solar-immanent-solar-glory.json',
    patch: { motePoolBonus: { enabled: true, pool: 'peripheral', amount: 10 } } },

  // ── extraActions ─────────────────────────────────────────────────────────────
  { file: 'terrestrial-persistent-hornet-attack.json',
    patch: { extraActions: { enabled: true, maxFormula: '@ess', costPerAction: 0 } } },

  // ── targetPenalty ────────────────────────────────────────────────────────────
  { file: 'terrestrial-sense-destroying-method.json',
    patch: { targetPenalty: { enabled: true, amount: -2 } } },

  { file: 'terrestrial-presence-glowing-coal-radiance.json',
    patch: { targetPenalty: { enabled: true, amountFormula: '-@presence' } } },

  { file: 'inkmonkeys-lions-roar-rebuke.json',
    patch: { targetPenalty: { enabled: true, amount: -1 } } },
];

let patched = 0, missing = 0;
for (const { file, patch } of PATCHES) {
  const path = join(BASE, file);
  if (!existsSync(path)) {
    console.warn(`MISSING: ${file}`);
    missing++;
    continue;
  }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      data.system[key] = Object.assign(data.system[key] ?? {}, value);
    } else {
      data.system[key] = value;
    }
  }
  writeFileSync(path, JSON.stringify(data, null, 2));
  patched++;
}
console.log(`Patched: ${patched}  Missing: ${missing}`);
