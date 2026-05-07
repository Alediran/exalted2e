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
    
    // Attack indicator patterns
    const patterns = [
      /attack pool equals.*?\([^)]+\+[^)]+\)/i,
      /dice pool.*?\([^)]+\+[^)]+\)/i,
      /range of\s*\([^)]+\)|range:\s*\d+/i,
      /base damage.*?\([^)]+\+[^)]+\)/i,
      /(lethal|bashing|aggravated)\s+damage.*?\([^)]+\+[^)]+\)/i,
      /this charm is a [^-]+-based attack/i,
      /(fires|hurls|launches).{0,50}(attack|bolt|projectile).*?(pool|dice|damage)/i,
      /accuracy\s*\+?\d+|speed\s+\d+|rate\s+\d+|damage\s+\d+\w+/i,
      /weapon.{0,100}(speed|accuracy|damage|rate|range)/i,
    ];
    
    let matched = false;
    let matchText = '';
    
    for (const pattern of patterns) {
      const m = desc.match(pattern);
      if (m) {
        matched = true;
        matchText = m[0];
        break;
      }
    }
    
    if (!matched) return null;
    
    const name = data.name || '';
    const charmType = data.system?.charmType || 'unknown';
    const duration = data.system?.duration || 'unknown';
    
    return {
      name,
      pack: packName,
      charmType,
      duration,
      excerpt: matchText.substring(0, 400)
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
  console.log('\n=== ATTACK CHARM CANDIDATES ===\n');
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
