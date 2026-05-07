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
    const name = (data.name || '').toLowerCase();
    
    // FILTER 1: Reject clear non-attacks
    const rejectPatterns = [
      /essence flow/i,  // Essence flows are ability boosters
      /perception|healing|medical|resurrection|resurrection|cure|recover|regenerate|repair/i,  // Non-attack support
      /form|stance|style|art(?!ifact)/i,  // Form/stance charms modify other attacks
      /perfected|\(excellency|excellences/i,  // Excellency patterns
      /glamour|disguise|illusion|deception|speak|language|communication|social/i, // Social charms
      /travel|movement|speed(?:no damage)|navigation|find|search|sense|detect|scent/i // Movement/detection
    ];
    
    for (const pattern of rejectPatterns) {
      if (pattern.test(name) || pattern.test(desc.substring(0, 200))) return null;
    }
    
    // FILTER 2: Must mention attack-like mechanics explicitly
    const attackIndicators = [
      /attack pool equals|dice pool of.*?\(.*?\+.*?\)/,
      /range of\s*\(.*?\)|range.*?yard|range.*?meter/,
      /base damage.*?\(.*?\+.*?\)|damage.*?lethal|damage.*?bashing|damage.*?aggravated/,
      /speed\s+\d+|accuracy\s*[+-]?\d+|rate\s+\d|fires|hurls|launches|bolt|blast|projectile/,
      /inflicts.*?(?:lethal|bashing|aggravated)/
    ];
    
    let hasAttackPatterns = 0;
    for (const indicator of attackIndicators) {
      if (indicator.test(desc)) hasAttackPatterns++;
    }
    
    if (hasAttackPatterns < 2) return null;
    
    // Extract excerpt
    const sentences = desc.split(/[.!?]+/).filter(s => s.trim().length > 20);
    let excerpt = '';
    
    // Find sentence mentioning attack with stats
    for (const sent of sentences) {
      const statCount = (sent.match(/speed|accuracy|rate|damage|range/gi) || []).length;
      if (statCount >= 2 && /attack|bolt|beam|fire|launch/.test(sent)) {
        excerpt = sent.trim();
        break;
      }
    }
    
    // Fallback: first sentence with multiple attack indicators
    if (!excerpt) {
      for (const sent of sentences) {
        let indicators = 0;
        if (/attack|bolt|strike|damage/.test(sent)) indicators++;
        if (/speed|accuracy|rate|range/.test(sent)) indicators++;
        if (/pool|dice/.test(sent)) indicators++;
        if (indicators >= 2) {
          excerpt = sent.trim();
          break;
        }
      }
    }
    
    if (!excerpt || excerpt.length < 30) return null;
    
    const charmType = data.system?.charmType || 'unknown';
    const duration = data.system?.duration || 'unknown';
    const ability = data.system?.ability || '';
    
    return {
      name: data.name || '',
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
  console.log('║     ATTACK-IMPLEMENTING CHARM CANDIDATES (NO ATTACK.ENABLED)     ║');
  console.log('║  Charms defining standalone attacks but missing attack schema     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  let currentPack = '';
  for (const r of results) {
    if (r.pack !== currentPack) {
      currentPack = r.pack;
      console.log(`\n[${currentPack.toUpperCase()}]`);
    }
    console.log(`\n• ${r.name}`);
    console.log(`  Ability: ${r.ability} | Type: ${r.charmType} | Duration: ${r.duration}`);
    console.log(`  >>> ${r.excerpt}`);
  }

  console.log(`\n\n${'═'.repeat(70)}`);
  console.log(`TOTAL CANDIDATES: ${results.length}`);
  console.log(`${'═'.repeat(70)}\n`);
} catch (e) {
  console.error('Error:', e.message);
}
