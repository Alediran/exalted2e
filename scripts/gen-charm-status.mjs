#!/usr/bin/env node
/**
 * gen-charm-status.mjs
 *
 * Scans src/packs/{charms,martialarts,spells}/*.json and regenerates
 * docs/charm-functionality.md.
 *
 * Charm classification rules:
 *   Fully Functional  — at least one enabled payload field OR truthy system.excellency
 *                       OR system.attack.enabled OR system.isCountermagic
 *   Partial           — manually flagged via OVERRIDES
 *   Could Have        — manually flagged via OVERRIDES
 *   Narrative         — everything else
 *
 * Spells: no mechanical payload fields exist; all spells are reported as
 * Narrative from an effect standpoint. They are grouped by tradition + circle.
 *
 * Usage:
 *   node scripts/gen-charm-status.mjs
 *   node scripts/gen-charm-status.mjs --dry-run   (print to stdout only)
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT        = resolve(__dirname, "..");
const CHARMS_DIR  = join(ROOT, "src", "packs", "charms");
const MA_DIR      = join(ROOT, "src", "packs", "martialarts");
const SPELLS_DIR  = join(ROOT, "src", "packs", "spells");
const OUT_FILE    = join(ROOT, "docs", "charm-functionality.md");
const DRY_RUN     = process.argv.includes("--dry-run");

// ── Payload fields that carry an `enabled` sub-key ──────────────────────────
const PAYLOAD_FIELDS = [
  "healthGrant",
  "soakBonus",
  "woundReduction",
  "statBoost",
  "moteRecovery",
  "healingRoll",
  "statusApply",
  "motePoolBonus",
  "extraActions",
  "dvBonus",
  "targetPenalty",
  "attackBonus",
  "socialBonus",
  "speedModifier",
  "rateBonus",
  "willpowerRecovery",
  "targetEffect",
  "grantsInitiation",
  "hazardImmunity",
];

const FIELD_LABEL = {
  healthGrant:       "health levels",
  soakBonus:         "soak bonus",
  woundReduction:    "wound reduction",
  statBoost:         "stat boost",
  moteRecovery:      "mote recovery",
  healingRoll:       "healing roll",
  statusApply:       "status effect",
  motePoolBonus:     "mote pool expansion",
  extraActions:      "extra actions",
  dvBonus:           "DV bonus",
  targetPenalty:     "target penalty",
  attackBonus:       "attack bonus",
  socialBonus:       "social bonus",
  speedModifier:     "speed modifier",
  rateBonus:         "rate bonus",
  willpowerRecovery: "WP recovery",
  targetEffect:      "target AE",
  grantsInitiation:  "initiation grant",
  hazardImmunity:    "hazard immunity",
};

const EXCELLENCY_LABEL = {
  first:          "Excellency (1st)",
  second:         "Excellency (2nd)",
  third:          "Excellency (3rd)",
  fateful:        "Fateful Excellency",
  infiniteMastery:"Infinite Mastery",
};

// Known exaltType values — controls output order and display names
const SPLAT_ORDER = [
  "abyssal", "alchemical", "dragonblooded", "fairfolk", "infernal",
  "inkmonkeys", "lunar", "martialarts", "sidereal", "solar", "terrestrial",
];
const SPLAT_LABEL = {
  abyssal:       "Abyssal",
  alchemical:    "Alchemical",
  dragonblooded: "Dragon-Blooded (legacy)",
  fairfolk:      "Fair Folk",
  infernal:      "Infernal",
  inkmonkeys:    "Inkmonkeys",
  lunar:         "Lunar",
  martialarts:   "Martial Arts",
  sidereal:      "Sidereal",
  solar:         "Solar",
  terrestrial:   "Terrestrial",
};

// Spell circle names per tradition
const CIRCLE_LABEL = {
  sorcery:   { 1: "Terrestrial Circle", 2: "Celestial Circle", 3: "Solar Circle" },
  necromancy: { 1: "Shadowlands Circle", 2: "Labyrinth Circle", 3: "Void Circle" },
  weaving:   { 1: "Terrestrial Weaving", 2: "Celestial Weaving", 3: "Solar Weaving" },
};

// ── Manual classification overrides ─────────────────────────────────────────
// Key = charm name (exact match). Value = { cat: "partial"|"could" }
const OVERRIDES = {};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadCharmDir(dir) {
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith(".json")); }
  catch { return []; }
  return files.flatMap(fname => {
    const raw = JSON.parse(readFileSync(join(dir, fname), "utf8"));
    if (raw.type !== "charm") return [];
    return [{ raw, sys: raw.system ?? {} }];
  });
}

function loadSpellDir(dir) {
  let files;
  try { files = readdirSync(dir).filter(f => f.endsWith(".json")); }
  catch { return []; }
  return files.flatMap(fname => {
    const raw = JSON.parse(readFileSync(join(dir, fname), "utf8"));
    if (raw.type !== "spell") return [];
    return [{ raw, sys: raw.system ?? {} }];
  });
}

function classifyCharm({ raw, sys }) {
  const name      = raw.name ?? "(unnamed)";
  const charmType = sys.charmType ?? "simple";
  const duration  = sys.duration  ?? "";
  const exaltType = (sys.exaltType ?? "").toLowerCase();

  const enabledFields = PAYLOAD_FIELDS.filter(f => sys[f]?.enabled === true);

  const hasExcellency     = !!sys.excellency;
  const hasPerfectDefense = !!sys.perfectDefenseType;
  const hasWeaponAttack   = !!sys.attack?.enabled;
  const hasCountermagic   = !!sys.isCountermagic;

  const tags = [];
  for (const f of enabledFields) tags.push(FIELD_LABEL[f] ?? f);
  if (hasExcellency)     tags.push(EXCELLENCY_LABEL[sys.excellency] ?? `Excellency (${sys.excellency})`);
  if (hasPerfectDefense) tags.push("Perfect Defense");
  if (hasWeaponAttack)   tags.push("weapon attack");
  if (hasCountermagic)   tags.push("countermagic");

  const override = OVERRIDES[name];
  let category;
  if (override)            category = override.cat;
  else if (tags.length)    category = "full";
  else                     category = "narrative";

  return { name, charmType, duration, exaltType, tags, category };
}

// ── Load data ─────────────────────────────────────────────────────────────────

const charms  = [...loadCharmDir(CHARMS_DIR), ...loadCharmDir(MA_DIR)];
const spells  = loadSpellDir(SPELLS_DIR);
const results = charms.map(c => classifyCharm(c));

// ── Charm aggregation ─────────────────────────────────────────────────────────

const byCategory = {
  full:      results.filter(c => c.category === "full"),
  partial:   results.filter(c => c.category === "partial"),
  could:     results.filter(c => c.category === "could"),
  narrative: results.filter(c => c.category === "narrative"),
};
const total = results.length;

function bySplat(arr) {
  const map = {};
  for (const c of arr) { const s = c.exaltType || "unknown"; (map[s] ??= []).push(c); }
  return map;
}

const fullBySplat      = bySplat(byCategory.full);
const partialBySplat   = bySplat(byCategory.partial);
const couldBySplat     = bySplat(byCategory.could);
const narrativeBySplat = bySplat(byCategory.narrative);

const knownSplatSet  = new Set(SPLAT_ORDER);
const unknownSplats  = [...new Set(results.map(c => c.exaltType || "unknown"))]
  .filter(s => !knownSplatSet.has(s) && s !== "unknown").sort();
if (unknownSplats.length)
  process.stderr.write(`WARNING: unknown exaltType values: ${unknownSplats.join(", ")}\n`);

const allSplats = [
  ...SPLAT_ORDER.filter(s => results.some(c => c.exaltType === s)),
  ...unknownSplats,
  ...(results.some(c => !c.exaltType || c.exaltType === "unknown") ? ["unknown"] : []),
];

// ── Spell aggregation ─────────────────────────────────────────────────────────

const spellsByTraditionCircle = {};
for (const { raw, sys } of spells) {
  const tradition = sys.tradition ?? "sorcery";
  const circle    = sys.circle ?? 1;
  const key       = `${tradition}:${circle}`;
  (spellsByTraditionCircle[key] ??= []).push({
    name: raw.name ?? "(unnamed)",
    duration: sys.duration ?? "",
    target: sys.target ?? "",
    countermagicImmune: !!sys.countermagicImmune,
  });
}
// Sort each bucket alphabetically
for (const arr of Object.values(spellsByTraditionCircle))
  arr.sort((a, b) => a.name.localeCompare(b.name));

const traditions = ["sorcery", "necromancy", "weaving"];
const circles    = [1, 2, 3];

// ── Formatters ────────────────────────────────────────────────────────────────

function entryLine(c) {
  const typeInfo = c.duration && c.duration !== c.charmType
    ? `${c.charmType} / ${c.duration}` : c.charmType;
  const tagStr = c.tags.length ? ` — ${c.tags.map(t => `\`${t}\``).join(" ")}` : "";
  return `- **${c.name}** (${typeInfo})${tagStr}`;
}

function renderCharmSection(title, bySplatMap, splats, withTags) {
  const lines = [`### ${title}`, ""];
  for (const splat of splats) {
    const arr = (bySplatMap[splat] ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (!arr.length) continue;
    lines.push(`#### ${SPLAT_LABEL[splat] ?? splat} (${arr.length})`, "");
    for (const c of arr)
      lines.push(withTags ? entryLine(c) : `- **${c.name}** (${c.charmType} / ${c.duration})`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderSpellsSection() {
  const lines = [];
  for (const tradition of traditions) {
    const traditionHasSpells = circles.some(c => spellsByTraditionCircle[`${tradition}:${c}`]?.length);
    if (!traditionHasSpells) continue;
    const tradLabel = tradition.charAt(0).toUpperCase() + tradition.slice(1);
    lines.push(`### ${tradLabel}`, "");
    for (const circle of circles) {
      const key  = `${tradition}:${circle}`;
      const arr  = spellsByTraditionCircle[key];
      if (!arr?.length) continue;
      const circLabel = CIRCLE_LABEL[tradition]?.[circle] ?? `Circle ${circle}`;
      lines.push(`#### ${circLabel} (${arr.length})`, "");
      for (const s of arr) {
        const meta = [s.duration, s.target].filter(Boolean).join(", ");
        const flag = s.countermagicImmune ? " ⚡" : "";
        lines.push(`- **${s.name}**${flag}${meta ? ` (${meta})` : ""}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ── Build document ────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);
const pct   = (n, d = total) => `${Math.round(n / d * 100)}%`;

const totalSpells      = spells.length;
const countermagicImm  = spells.filter(s => s.sys?.countermagicImmune).length;

const splatTableRows = allSplats.map(s => {
  const f  = fullBySplat[s]?.length      ?? 0;
  const pa = partialBySplat[s]?.length   ?? 0;
  const co = couldBySplat[s]?.length     ?? 0;
  const na = narrativeBySplat[s]?.length ?? 0;
  return `| ${SPLAT_LABEL[s] ?? s} | ${f} | ${pa} | ${co} | ${na} | ${f+pa+co+na} |`;
}).join("\n");

// Spell count table by tradition × circle
const spellTableRows = traditions.flatMap(trad => {
  const rows = circles.map(c => {
    const key = `${trad}:${c}`;
    const n   = spellsByTraditionCircle[key]?.length ?? 0;
    const cl  = CIRCLE_LABEL[trad]?.[c] ?? `Circle ${c}`;
    return n ? `| ${cl} | ${n} |` : null;
  }).filter(Boolean);
  return rows;
}).join("\n");

const doc = `# Charm & Spell Functionality Status

_Generated ${today}. Automated analysis based on enabled effect fields in \`src/packs/{charms,martialarts,spells}/\`. Manual review recommended for edge cases._

> **Schema notes (charms):**
> - \`excellency\` values: \`"first"\`/\`"second"\`/\`"third"\` (Solar/Abyssal), \`"fateful"\` (Sidereal), \`"infiniteMastery"\` — all truthy → Fully Functional.
> - Payload fields with \`enabled: true\` → Fully Functional: healthGrant, soakBonus, woundReduction, statBoost, moteRecovery, healingRoll, statusApply, motePoolBonus, extraActions, dvBonus, targetPenalty, attackBonus, socialBonus, speedModifier, rateBonus, willpowerRecovery, targetEffect, grantsInitiation, hazardImmunity.
> - \`attack.enabled: true\` (weapon-like charm attacks) → Fully Functional.
> - \`isCountermagic: true\` → Fully Functional.
>
> **Schema notes (spells):**
> - SpellData has no mechanical payload fields. Casting cost is tracked by the activation ledger, but all spell *effects* require GM adjudication.
> - \`countermagicImmune: true\` is the only mechanical flag (${countermagicImm} spells). Marked ⚡ in the listing.

---

## Part 1 — Charms (${total} total, including Martial Arts)

### Summary

| Category | Count | % |
|---|---:|---:|
| Fully functional | ${byCategory.full.length} | ${pct(byCategory.full.length)} |
| Partial functionality | ${byCategory.partial.length} | ${pct(byCategory.partial.length)} |
| Could have functionality | ${byCategory.could.length} | ${pct(byCategory.could.length)} |
| Narrative | ${byCategory.narrative.length} | ${pct(byCategory.narrative.length)} |
| **Total** | **${total}** | |

### By Splat

| Splat | Fully | Partial | Could | Narrative | Total |
|---|---:|---:|---:|---:|---:|
${splatTableRows}

---

### 1. Fully Functional

Charms whose primary mechanic is covered by at least one enabled effect field, the Excellency system, the Perfect Defense system, a weapon-like attack, countermagic, or Infinite Mastery.

${renderCharmSection("By Splat", fullBySplat, allSplats, true)}

---

### 2. Partial Functionality

Charms that have some wired mechanics but whose core loop is incomplete.
${byCategory.partial.length === 0
  ? "\n_(none currently)_\n"
  : "\n" + renderCharmSection("By Splat", partialBySplat, allSplats, true) + "\n"}

---

### 3. Could Have Functionality

Charms whose effects could be encoded in existing schema fields but have not been configured yet.
${byCategory.could.length === 0
  ? "\n_(none currently)_\n"
  : "\n" + renderCharmSection("By Splat", couldBySplat, allSplats, false) + "\n"}

---

### 4. Narrative Only

Charms with no enabled mechanical fields. Descriptions are present but require GM/player adjudication.

${renderCharmSection("By Splat", narrativeBySplat, allSplats, false)}

---

## Part 2 — Spells (${totalSpells} total)

All spell effects are narrative — no mechanical payload fields exist on SpellData. The activation ledger tracks mote/WP costs for all spells. Spells marked ⚡ are countermagic-immune.

### Summary by Tradition and Circle

| Circle | Count |
|---|---:|
${spellTableRows}
| **Total** | **${totalSpells}** |

${renderSpellsSection()}
`;

if (DRY_RUN) {
  process.stdout.write(doc);
} else {
  writeFileSync(OUT_FILE, doc, "utf8");
  console.log(`Written: ${OUT_FILE}`);
  console.log(`Charms — Fully functional: ${byCategory.full.length} / ${total} (${pct(byCategory.full.length)})`);
  console.log(`Charms — Partial:          ${byCategory.partial.length}`);
  console.log(`Charms — Could have:       ${byCategory.could.length}`);
  console.log(`Charms — Narrative:        ${byCategory.narrative.length}`);
  console.log(`Spells — Total:            ${totalSpells} (${countermagicImm} countermagic-immune)`);
}
