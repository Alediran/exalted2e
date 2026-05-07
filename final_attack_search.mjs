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
    
    // FILTERS: Reject known patterns
    // Don't include weapon modifiers or things that use enemy as weapon
    if (/supplements|modifies|weapon|improvised|as an improvised|treats.*as a weapon|adds.*bonus|increases|boosts|enhances|when.*attack|whenever.*attack|adds to|applies to/i.test(desc)) {
      return null;
    }
    
    // Must explicitly say THIS CHARM is/creates an attack or does damage
    if (!/(?:this charm|it|these|the charm)\s+(?:is a|creates?|inflicts|fires?|throws?|hurls?|launches?)\s+(?:an?|the)?\s*[a-z]*(?:attack|blast|beam|bolt|projectile|strike|damage)/i.test(desc)) {
      return null;
    }
    
    // Must have complete attack stats: need at least 3 of speed, accuracy, rate, damage, range
    const hasSpeed = /\bspeed\s+\d+/.test(desc);
    const hasAccuracy = /\baccuracy\s*[+-]?\d+|accuracy\s+[+-]?\d+/.test(desc);
    const hasRate = /\brate\s+\d+|rate\s+\d\b/.test(desc);
    const hasDamage = /damage\s*(?:of|=|:)?\s*\([^)]*[\+\-\*]\|base damage|damage\s+\d+[lba]|\(\s*[a-z\s\+\*x\d]+\s*\)\s*[lba]/i.test(desc);
    const hasRange = /\brange\s*(?:of|=|:)?\s*\(|\brange\s+\d+|\brange:\s*\d+/i.test(desc);
    
    const statCount = [hasSpeed, hasAccuracy, hasRate, hasDamage, hasRange].filter(Boolean).length;
    if (statCount < 3) return null;
    
    // Extract the relevant passage
    const paragraphs = desc.split(/\n/);
    let excerpt = '';
    for (const para of paragraphs) {
      const statMatches = (para.match(/(speed|accuracy|rate|damage|range)/gi) || []).length;
      if (statMatches >= 2) {
        excerpt = para.trim();
        break;
      }
    }
    
    if (!excerpt) {
      // Try to find a sentence with the attack description
      const sentences = desc.split(/[.!?]+/);
      for (const sent of sentences) {
        if (/(?:this charm|it)\s+(?:is|creates|inflicts?|fires?).+attack/.test(sent) && 
            /speed|accuracy|rate|damage|range/.test(sent)) {
          excerpt = sent.trim() + '.';
          break;
        }
      }
    }
    
    if (!excerpt || excerpt.length < 30) return null;
    
    const name = data.name || '';
    const charmType = data.system?.charmType || 'unknown';
    const duration = data.system?.duration || 'unknown';
    const ability = data.system?.ability || '';
    
    return {
      name,
      pack: packName,
      charmType,
      duration,
      ability,
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

  // Sort by pack
  results.sort((a, b) => a.pack.localeCompare(b.pack) || a.name.localeCompare(b.name));

  // Output results
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║   CHARMS WITH STANDALONE ATTACK DEFINITIONS                     ║');
  console.log('║   (No attack.enabled but describe complete attack mechanics)     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  let currentPack = '';
  for (const r of results) {
    if (r.pack !== currentPack) {
      currentPack = r.pack;
      console.log(`\n[${currentPack.toUpperCase()}]`);
    }
    console.log(`\n• ${r.name}`);
    console.log(`  Type: ${r.charmType}, Duration: ${r.duration}, Ability: ${r.ability}`);
    console.log(`  Description excerpt:\n  ${r.excerpt.split('\n').join('\n  ')}`);
  }

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`TOTAL CANDIDATES: ${results.length}`);
  console.log(`${'='.repeat(70)}`);
} catch (e) {
  console.error('Error:', e.message);
}
