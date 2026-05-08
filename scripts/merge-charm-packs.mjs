/**
 * Merges all charms-* source packs into a single src/packs/charms/ directory.
 *
 * Each old pack becomes a top-level folder inside the merged pack.  Existing
 * ability/attribute sub-folders are re-parented to their splat folder.  When
 * two packs share the same folder _id (ability folders were copy-pasted across
 * packs), the first pack in PACKS keeps the original id; subsequent packs get
 * a freshly-generated id and their charm files are updated to match.
 *
 * Run: node scripts/merge-charm-packs.mjs [--write]
 *   Without --write  → dry-run (prints what would be created)
 *   With    --write  → writes files to src/packs/charms/
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

const WRITE = process.argv.includes("--write");
const SRC   = "src/packs";
const OUT   = `${SRC}/charms`;

const STATS = {
  coreVersion: "13",
  systemId: "exalted2e",
  systemVersion: "1.0.0",
  createdTime: 0,
  modifiedTime: 0,
  lastModifiedBy: null,
};

const PACKS = [
  { dir: "charms-solar",       slug: "solar",       id: "a1b2c3d4e5f60001", label: "Solar Exalted",      color: "#c08020" },
  { dir: "charms-lunar",       slug: "lunar",       id: "a1b2c3d4e5f60002", label: "Lunar Exalted",      color: "#a0a8b8" },
  { dir: "charms-sidereal",    slug: "sidereal",    id: "a1b2c3d4e5f60003", label: "Sidereal Exalted",   color: "#6060a0" },
  { dir: "charms-terrestrial", slug: "terrestrial", id: "a1b2c3d4e5f60004", label: "Dragon-Blooded",     color: "#408040" },
  { dir: "charms-abyssal",     slug: "abyssal",     id: "a1b2c3d4e5f60005", label: "Abyssal Exalted",    color: "#404058" },
  { dir: "charms-infernal",    slug: "infernal",    id: "a1b2c3d4e5f60006", label: "Infernal Exalted",   color: "#803030" },
  { dir: "charms-alchemical",  slug: "alchemical",  id: "a1b2c3d4e5f60007", label: "Alchemical Exalted", color: "#305080" },
  { dir: "charms-inkmonkeys",  slug: "inkmonkeys",  id: "a1b2c3d4e5f60008", label: "Ink Monkeys",        color: "#806040" },
];

// ── Pass 1: assign unique folder IDs across all packs ──────────────────────
// The same ability folder _id (e.g. archery) was reused across all packs that
// have archery charms.  We keep the first occurrence unchanged; every later
// pack that claims the same id gets a fresh id.

const globalFolderIds = new Set();   // ids already claimed by an earlier pack
const packRemaps      = new Map();   // slug → Map(oldId → newId)

// Splat folder IDs are in PACKS[].id — reserve them so generated IDs never
// collide with them.
for (const p of PACKS) globalFolderIds.add(p.id);

let idCounter = 0xf001;   // start of generated ID range

function genId() {
  return `b0b1b2b3b4b5${(idCounter++).toString(16).padStart(4, "0")}`;
}

for (const pack of PACKS) {
  const packDir     = join(SRC, pack.dir);
  const remap       = new Map();
  packRemaps.set(pack.slug, remap);

  for (const file of readdirSync(packDir).filter(f => f.startsWith("_folder-") && f.endsWith(".json"))) {
    const data  = JSON.parse(readFileSync(join(packDir, file), "utf8"));
    const oldId = data._id;
    if (globalFolderIds.has(oldId)) {
      const newId = genId();
      remap.set(oldId, newId);
      globalFolderIds.add(newId);
    } else {
      globalFolderIds.add(oldId);
      remap.set(oldId, oldId);   // keep unchanged
    }
  }
}

// ── Pass 2: write merged output ────────────────────────────────────────────

function write(path, obj) {
  if (WRITE) {
    writeFileSync(path, JSON.stringify(obj, null, 2));
  } else {
    process.stdout.write(`  [dry] ${path}\n`);
  }
}

if (WRITE) mkdirSync(OUT, { recursive: true });

let totalFolders = 0;
let totalCharms  = 0;

for (const pack of PACKS) {
  const packDir = join(SRC, pack.dir);
  const remap   = packRemaps.get(pack.slug);
  const files   = readdirSync(packDir).filter(f => f.endsWith(".json"));

  console.log(`\n── ${pack.dir} (${files.length} files) → folder "${pack.label}"`);

  // Write top-level splat folder
  write(join(OUT, `_folder-${pack.slug}.json`), {
    _id:    pack.id,
    _key:   `!folders!${pack.id}`,
    _stats: STATS,
    name:   pack.label,
    type:   "Item",
    description: "",
    folder: null,
    sorting: "a",
    sort:   0,
    color:  pack.color,
    flags:  {},
  });
  totalFolders++;

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(packDir, file), "utf8"));

    if (file.startsWith("_folder-")) {
      // Ability sub-folder: remap id if needed, re-parent to splat
      const oldId = data._id;
      const newId = remap.get(oldId) ?? oldId;
      const out = {
        ...data,
        _id:    newId,
        _key:   `!folders!${newId}`,
        folder: pack.id,
      };
      write(join(OUT, `_folder-${pack.slug}-${file.slice("_folder-".length)}`), out);
      totalFolders++;
    } else {
      // Charm: remap folder reference if its folder id was reassigned
      const oldFolder = data.folder;
      const newFolder = (oldFolder && remap.has(oldFolder)) ? remap.get(oldFolder) : oldFolder;
      write(join(OUT, `${pack.slug}-${file}`), { ...data, folder: newFolder });
      totalCharms++;
    }
  }
}

console.log(`\n✓ ${totalFolders} folder docs, ${totalCharms} charm docs`);

if (WRITE) {
  console.log(`\nNext step — compile the pack:`);
  console.log(`  npx fvtt package pack -n charms -t Item --in src/packs/charms --out packs`);
} else {
  console.log(`\nRun with --write to create the files.`);
}
