/**
 * Stamps grantsInitiation on the known initiation charms in src/packs/charms/.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR  = path.join(ROOT, "src/packs/charms");

const ENTRIES = [
  // Sorcery level 1
  { file: "abyssal-occult-terrestrial-circle-sorcery.json",      tradition: "sorcery",    level: 1 },
  { file: "lunar-sorcery-charms-terrestrial-circle-sorcery.json", tradition: "sorcery",   level: 1 },
  { file: "sidereal-terrestrial-circle-sorcery.json",             tradition: "sorcery",   level: 1 },
  { file: "solar-occult-terrestrial-circle-sorcery.json",         tradition: "sorcery",   level: 1 },
  { file: "terrestrial-occult-terrestrial-circle-sorcery.json",   tradition: "sorcery",   level: 1 },
  // Sorcery level 2
  { file: "abyssal-celestial-circle-sorcery.json",   tradition: "sorcery", level: 2 },
  { file: "sidereal-celestial-circle-sorcery.json",  tradition: "sorcery", level: 2 },
  { file: "solar-celestial-circle-sorcery.json",     tradition: "sorcery", level: 2 },
  // Sorcery level 3
  { file: "solar-solar-circle-sorcery.json",         tradition: "sorcery", level: 3 },
  // Necromancy level 1
  { file: "abyssal-shadowlands-circle-necromancy.json", tradition: "necromancy", level: 1 },
  // Necromancy level 2
  { file: "abyssal-labyrinth-circle-necromancy.json",   tradition: "necromancy", level: 2 },
  // Necromancy level 3
  { file: "abyssal-void-circle-necromancy.json",         tradition: "necromancy", level: 3 },
  // Weaving level 1
  { file: "alchemical-man-machine-weaving-engine.json",  tradition: "weaving", level: 1 },
  // Weaving level 2
  { file: "alchemical-god-machine-weaving-engine.json",  tradition: "weaving", level: 2 },
];

for (const { file, tradition, level } of ENTRIES) {
  const fp  = path.join(DIR, file);
  if (!fs.existsSync(fp)) { console.warn("MISSING:", file); continue; }
  const doc = JSON.parse(fs.readFileSync(fp, "utf8"));
  doc.system.grantsInitiation = { enabled: true, tradition, level };
  fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`✓ ${file}  →  ${tradition} ${level}`);
}
