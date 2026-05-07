import fs from 'fs';
import path from 'path';

const charms = [
  'bone-shattering-blow',
  'eyes-like-daggers-glance',
  'labyrinth-walking-prana',
  'god-smashing-blow',
  'elemental-bolt-attack',
  'crypt-bolt-attack'
];

const packsDir = 'C:\Users\Nicolas.Costa\AppData\Local\FoundryVTT\Data\systems\exalted2e\src\packs';

for (const charm of charms) {
  // Find the file
  let found = false;
  for (const packDir of fs.readdirSync(packsDir).filter(d => d.startsWith('charms-'))) {
    const filePath = path.join(packsDir, packDir, charm + '.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`\n${'='.repeat(70)}`);
      console.log(`${data.name} [${packDir.replace('charms-', '')}]`);
      console.log(`${'='.repeat(70)}`);
      console.log(`Attack Enabled: ${data.system?.attack?.enabled ? 'YES' : 'NO'}`);
      console.log(`Type: ${data.system?.charmType}, Duration: ${data.system?.duration}`);
      console.log(`Ability: ${data.system?.ability}`);
      const desc = data.system?.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
      console.log(`\nDescription:\n${desc}...`);
      found = true;
      break;
    }
  }
  if (!found) console.log(`\nNot found: ${charm}`);
}
