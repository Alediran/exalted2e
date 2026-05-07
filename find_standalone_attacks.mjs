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
    
    // Look for explicit weapon stat blocks with AT LEAST 3 of: speed, accuracy, rate, damage, range
    // These indicate a COMPLETE attack definition
    const hasSpeed = /speed\s+\d+/.test(desc);
    const hasAccuracy = /accuracy\s*[+-]?\d+|accuracy\s+[+-]?\d+/.test(desc);
    const hasRate = /rate\s+\d+|rate\s+\d/.test(desc);
    const hasDamage = /damage[^a-z]*\([^)]*\)|damage\s+\d+[lba]|damage\s+[a-z]+/.test(desc);
    const hasRange = /range\s*\([^)]+\)|range\s+\d+|range of\s*\([^)]+\)/.test(desc);
    
    const statCount = [hasSpeed, hasAccuracy, hasRate, hasDamage, hasRange].filter(Boolean).length;
    
    if (statCount < 3) return null;
    
    // Confirm it's describing an attack
    const isAttackDesc = /(?:this charm|these|it)\s+(?:is|creates|inflicts?|fires?|throws?|hurls?|launches?).*?(?:attack|blast|beam|projectile|strike)/i.test(desc);
    if (!isAttackDesc) return null;
    
    // Extract the complete stat block passage
    const sentences = desc.split(/[.!?]+/);
    let excerpt = '';
    for (const sent of sentences) {
      if ((sent.match(/speed|accuracy|rate|damage|range/gi) || []).length >= 2) {
        excerpt = sent.trim() + '.';
        break;
      }
    }
    
    if (!excerpt) {
      // Fallback: find line mentioning attack with stats
      const match = desc.match(/(?:these|it|the)[^.!?]+(?:speed|accuracy|rate|damage|range)[^.!?]+[.!?]/i);
      if (match) excerpt = match[0];
    }
    
    if (!excerpt || excerpt.length < 20) return null;
    
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
  console.log('\n=== CHARMS WITH COMPLETE STANDALONE ATTACK DEFINITIONS ===\n');
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
