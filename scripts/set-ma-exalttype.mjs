/**
 * Sets exaltType = "martialarts" on every charm in src/packs/martialarts/
 * that does NOT have the "Native" keyword (Native = hero-expansion charm,
 * restricted to the creator splat and should keep its original exaltType).
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_DIR  = path.resolve(__dirname, "../src/packs/martialarts");

let updated = 0;
let skipped = 0;

for (const file of fs.readdirSync(PACK_DIR)) {
  if (!file.endsWith(".json") || file.startsWith("_folder")) continue;

  const filePath = path.join(PACK_DIR, file);
  const raw      = fs.readFileSync(filePath, "utf8");
  const doc      = JSON.parse(raw);

  if (doc.type !== "charm") continue;

  const keywords = doc.system?.keywords ?? [];
  if (keywords.includes("Native")) { skipped++; continue; }

  if (doc.system.exaltType === "martialarts") { skipped++; continue; }

  doc.system.exaltType = "martialarts";
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
  updated++;
}

console.log(`Done. Updated: ${updated}, skipped (Native or already set): ${skipped}`);
