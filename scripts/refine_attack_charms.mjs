import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const stripHtml = (html) => {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const checkCharm = (filePath, packName) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Check type
    if (data.type !== 'charm') return null;
    
    // Skip if attack already enabled
    if (data.system?.attack?.enabled === true) return null;
    
    // Check effect fields
    const effectFields = [
      'healthGrant', 'soakBonus', 'woundReduction', 'statBoost', 
      'moteRecovery', 'healingRoll', 'statusApply', 'motePoolBonus',
      'extraActions', 'dvBonus', 'targetPenalty', 'attackBonus',
      'speedModifier', 'rateBonus', 'willpowerRecovery'
    ];
    
    for (const field of effectFields) {
      if (data.system?.[field]?.enabled === true) return null;
    }
    
    // Check excellency
    if (data.system?.excellency && data.system.excellency !== '') return null;
    
    // Get description
    const descHtml = data.system?.description || '';
    if (!descHtml) return null;
    
    const desc = stripHtml(descHtml).toLowerCase();
    
    // STRICT: Look for charms that CREATE their own attack, not modifiers
    // Must have: pool formula AND (range OR damage formula)
    
    // Pattern 1: "attack pool equals" or "dice pool of (... + ...)" + range + damage
    const hasAttackPool = /attack pool equals.*?\([^)]+\+[^)]+\)|dice pool of.*?\([^)]+\+[^)]+\)/i.test(desc);
    const hasRangeFormula = /range of\s*\(\s*[a-z\s\+\*x\d]+\)|range:\s*\([^)]+\)/i.test(desc);
    const hasDamageFormula = /(?:base\s+)?damage.*?\([^)]+\+[^)]+\)|lethal damage.*?(\d+|formula)/i.test(desc);
    
    // Pattern 2: "creates X attack" style
    const createsAttack = /creates.*?(?:attack|bolt|projectile|beam|strike)|this charm.*?attacks?.*?with|hurls.*?attack|fires.*?with.*?pool|launches.*?with.*?damage/i.test(desc);
    
    // Pattern 3: Explicit weapon stat blocks for generated weapons
    const hasWeaponStats = /(accuracy\s*[+-]?\d+|speed\s+\d+|rate\s+\d|damage\s+\d+[lba]|range\s+\d+).*?(accuracy|speed|rate|damage|range)/i.test(desc);
    
    // Filter out false positives
    const isModifier = /supplements|modifies|adds|increases|boosts|applies to|enhances|when.*attack|whenever.*attack|adds bonus/i.test(desc);
    const isWeaponForm = /form|stance|style|technique(?=\s|$)/i.test(data.name || '') && !createsAttack;
    const isFluff = desc.length < 100;
    
    if (isModifier || isWeaponForm || isFluff) return null;
    
    // Check if it has enough attack definition
    const hasFullDefinition = (hasAttackPool && (hasRangeFormula || hasDamageFormula)) || 
                             (createsAttack && hasWeaponStats);
    
    if (!hasFullDefinition) return null;
    
    // Find the relevant excerpt
    const poolMatch = desc.match(/attack pool equals[^.!?]+[.!?]|dice pool of[^.!?]+[.!?]/i);
    const rangeMatch = desc.match(/range of[^.!?]+[.!?]/i);
    const damageMatch = desc.match(/(?:base\s+)?damage[^.!?]+[.!?]|lethal damage[^.!?]+[.!?]/i);
    
    const excerpt = [poolMatch, rangeMatch, damageMatch]
      .filter(m => m)
      .map(m => m[0].substring(0, 150))
      .join(' | ');
    
    if (!excerpt) return null;
    
    const name = data.name || '';
    const charmType = data.system?.charmType || 'unknown';
    const duration = data.system?.duration || 'unknown';
    
    return {
      name,
      pack: packName,
      charmType,
      duration,
      excerpt: excerpt.substring(0, 400)
    };
  } catch (e) {
    return null;
  }
};

// Scan all packs
const packsDir = path.join(__dirname, 'src', 'packs');
const results = [];

try {
  const dirs = fs.readdirSync(packsDir)
    .filter(f => f.startsWith('charms-') && fs.statSync(path.join(packsDir, f)).isDirectory())
    .sort();

  for (const packDirName of dirs) {
    const packName = packDirName.replace('charms-', '');
    const packPath = path.join(packsDir, packDirName);
    
    const files = fs.readdirSync(packPath)
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .sort();
    
    console.error(`Scanning ${packName}... (${files.length} files)`);
    
    for (const file of files) {
      const result = checkCharm(path.join(packPath, file), packName);
      if (result) {
        results.push(result);
      }
    }
  }

  // Output results
  console.log('\n=== HIGH-CONFIDENCE ATTACK CHARM CANDIDATES ===\n');
  for (const r of results) {
    console.log(`NAME: ${r.name}`);
    console.log(`PACK: ${r.pack}`);
    console.log(`TYPE: ${r.charmType}, DURATION: ${r.duration}`);
    console.log(`EXCERPT: ${r.excerpt}`);
    console.log('---');
  }

  console.log(`\n\nTotal matching charms: ${results.length}`);
} catch (e) {
  console.error('Error:', e.message);
}
