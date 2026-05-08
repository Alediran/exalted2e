#!/usr/bin/env node
// scripts/fix-charm-effects-data.mjs
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function patch(file, fn) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data.system);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('  patched:', file);
}

const BASE = 'src/packs/charms';

// A: Perfect defense types
console.log('\nA. Perfect defense types');
const perfectDefs = [
  { file: 'solar-heavenly-guardian-defense.json',          type: 'parry' },
  { file: 'solar-adamant-skin-technique.json',             type: 'soak'  },
  { file: 'abyssal-flickering-wisp-technique.json',        type: 'dodge' },
  { file: 'infernal-sands-through-fingers-defense.json',   type: 'dodge' },
  { file: 'infernal-who-strikes-the-wind.json',            type: 'dodge' },
  { file: 'infernal-counter-conceptual-interposition.json',type: 'parry' },
  { file: 'infernal-bloodless-murk-evasion.json',          type: 'dodge' },
  { file: 'alchemical-impenetrable-repulsor-field.json',   type: 'parry' },
];
for (const { file, type } of perfectDefs) {
  patch(join(BASE, file), s => { s.perfectDefenseType = type; });
}

// B: Pain Suppression Nodes
console.log('\nB. Pain Suppression Nodes — woundReduction @sta*2');
patch(join(BASE, 'alchemical-pain-suppression-nodes.json'), s => {
  s.woundReduction = { enabled: true, formula: '@sta * 2' };
});

// C: Joyful Cessation Of Restraint
console.log('\nC. Joyful Cessation Of Restraint — extraActions @ess');
patch(join(BASE, 'infernal-joyful-cessation-of-restraint.json'), s => {
  s.extraActions = { enabled: true, maxFormula: '@ess', costPerAction: 0 };
});

console.log('\nDone.');
