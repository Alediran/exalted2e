#!/usr/bin/env node
/**
 * lint-i18n.mjs — language-drift linter.
 *
 * Compares the key sets of lang/en.json and lang/es.json and reports:
 *   • Keys present in en.json but missing from es.json  (need translation)
 *   • Keys present in es.json but missing from en.json  (stale / orphaned)
 *
 * Usage:
 *   node scripts/lint-i18n.mjs
 *
 * Exit code 0 = clean. Exit code 1 = drift detected.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const en = JSON.parse(readFileSync(join(root, "lang/en.json"), "utf8"));
const es = JSON.parse(readFileSync(join(root, "lang/es.json"), "utf8"));

const enKeys = new Set(flattenKeys(en));
const esKeys = new Set(flattenKeys(es));

const missingInEs  = [...enKeys].filter(k => !esKeys.has(k)).sort();
const orphanedInEs = [...esKeys].filter(k => !enKeys.has(k)).sort();

let exitCode = 0;

if (missingInEs.length) {
  console.log(`\n[MISSING in es.json] (${missingInEs.length} keys need translation):`);
  for (const k of missingInEs) console.log(`  ${k}`);
  exitCode = 1;
}

if (orphanedInEs.length) {
  console.log(`\n[ORPHANED in es.json] (${orphanedInEs.length} keys not in en.json):`);
  for (const k of orphanedInEs) console.log(`  ${k}`);
  exitCode = 1;
}

if (exitCode === 0) {
  console.log("i18n OK — en.json and es.json are in sync.");
}

process.exit(exitCode);
