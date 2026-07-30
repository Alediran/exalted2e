import { describe, it, expect } from "vitest";
import {
  parseRules, collectTokens, findSelfRefDefs, findUndefinedVars,
  findOrphanTokens, checkBraceBalance, findDuplicateBlocks,
  elementsHaveCompanionClass,
} from "../../tools/ci/css-integrity.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("css-integrity pure checks", () => {
  it("parseRules returns selector/body pairs, comments stripped", () => {
    const rules = parseRules("/* c */ .a { color: red; } .b{gap:6px}");
    expect(rules.map(r => r.selector)).toEqual([".a", ".b"]);
  });
  it("collectTokens separates defined vs used ex2e tokens", () => {
    const { defined, used } = collectTokens(":root{--ex2e-x:#fff;} .a{color:var(--ex2e-x);background:var(--ex2e-y)}");
    expect([...defined]).toEqual(["--ex2e-x"]);
    expect([...used].sort()).toEqual(["--ex2e-x", "--ex2e-y"]);
  });
  it("findSelfRefDefs flags --x: var(--x)", () => {
    expect(findSelfRefDefs(".a{--ex2e-x: var(--ex2e-x); color:var(--ex2e-x)}")).toEqual(["--ex2e-x"]);
    expect(findSelfRefDefs(".a{--ex2e-x:#fff}")).toEqual([]);
  });
  it("findUndefinedVars flags used-but-undefined", () => {
    const { defined, used } = collectTokens(":root{--ex2e-x:#fff} .a{color:var(--ex2e-x);background:var(--ex2e-y)}");
    expect(findUndefinedVars({ defined, used })).toEqual(["--ex2e-y"]);
  });
  it("findOrphanTokens flags defined-but-unused minus allowlist", () => {
    const { defined, used } = collectTokens(":root{--ex2e-x:#fff;--ex2e-z:#000} .a{color:var(--ex2e-x)}");
    expect(findOrphanTokens({ defined, used }, [])).toEqual(["--ex2e-z"]);
    expect(findOrphanTokens({ defined, used }, ["--ex2e-z"])).toEqual([]);
  });
  it("checkBraceBalance detects imbalance", () => {
    expect(checkBraceBalance(".a{color:red}").balanced).toBe(true);
    expect(checkBraceBalance(".a{color:red").balanced).toBe(false);
  });
  it("findDuplicateBlocks flags identical >=minDecls blocks occurring >=2x", () => {
    const css = ".a{display:flex;align-items:center;gap:6px} .b{display:flex;align-items:center;gap:6px}";
    const dups = findDuplicateBlocks(parseRules(css), { minDecls: 3 });
    expect(dups.length).toBe(1);
    expect(dups[0].count).toBe(2);
  });
  it("elementsHaveCompanionClass finds elements missing the companion class", () => {
    const hbs = '<div class="a stat-row">x</div><div class="stat-row ex2e-row">y</div>';
    expect(elementsHaveCompanionClass(hbs, "stat-row", "ex2e-row")).toEqual(["a stat-row"]);
  });
  it("elementsHaveCompanionClass returns empty when all carry the companion", () => {
    expect(elementsHaveCompanionClass('<i class="stat-row ex2e-row"></i>', "stat-row", "ex2e-row")).toEqual([]);
  });
  it("elementsHaveCompanionClass matches whole tokens only (no substring false-hits)", () => {
    expect(elementsHaveCompanionClass('<div class="stat-row-header"></div>', "stat-row", "ex2e-row")).toEqual([]);
  });
});

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../styles");
const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates");
const ORPHAN_ALLOWLIST = [];   // intentionally-reserved tokens (none after cleanup)
const CSS_DUP_MAX = 79;        // baseline; lower as structural merges land, never raise
const MIGRATED_ROW_SELECTORS = [   // leaf classes migrated to .ex2e-row (populated in Phase B)
  "charm-activation-row",
  "charm-group-header",
  "hearthstone-slot-row",
  "resplendent-endurance-row",
  "resplendency-row",
  // B.2b – dialog rows
  "formula-input-row",
  "exc-input-row",
  "eruption-stepper",
  "rparadox-trigger-row",
  // B.2c – sheet / actor rows
  "wp-row",
  "virtue-label-group",
  "dissonance-row",
  "stat-row",
  "unit-health-row",
  // B.2d – section toolbars
  "section-toolbar",
];

function readStyles() {
  const files = fs.readdirSync(STYLES_DIR).filter(f => f.endsWith(".css"));
  return files.map(f => ({ file: f, css: fs.readFileSync(path.join(STYLES_DIR, f), "utf8") }));
}

function readTemplates() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".hbs")) out.push({ file: p, text: fs.readFileSync(p, "utf8") });
    }
  };
  walk(TEMPLATES_DIR);
  return out;
}

describe("css-integrity: live stylesheets", () => {
  const files = readStyles();
  const allCss = files.map(f => f.css).join("\n");

  it("has no self-referential token definitions", () => {
    expect(findSelfRefDefs(allCss)).toEqual([]);
  });
  it("references no undefined --ex2e-* tokens", () => {
    expect(findUndefinedVars(collectTokens(allCss))).toEqual([]);
  });
  it("has no orphan (defined-but-unused) tokens", () => {
    expect(findOrphanTokens(collectTokens(allCss), ORPHAN_ALLOWLIST)).toEqual([]);
  });
  it.each(files)("$file has balanced braces", ({ css }) => {
    expect(checkBraceBalance(css).balanced).toBe(true);
  });
  it(`has no more than ${CSS_DUP_MAX} duplicate rule blocks`, () => {
    const dups = findDuplicateBlocks(parseRules(allCss), { minDecls: 3 });
    expect(dups.length).toBeLessThanOrEqual(CSS_DUP_MAX);
  });
  it(".ex2e-row is defined exactly once with the canonical declarations", () => {
    const rows = parseRules(allCss).filter(r => r.selector.trim() === ".ex2e-row");
    expect(rows.length).toBe(1);
    const norm = rows[0].body.split(";").map(s => s.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean).sort().join(";");
    expect(norm).toBe("align-items: center;display: flex;gap: var(--ex2e-gap-sm)");
  });
  it("every migrated row element also carries ex2e-row", () => {
    const templates = readTemplates();
    const offenders = [];
    for (const base of MIGRATED_ROW_SELECTORS) {
      for (const t of templates) {
        for (const bad of elementsHaveCompanionClass(t.text, base, "ex2e-row")) {
          offenders.push(`${path.basename(t.file)}: class="${bad}" (has ${base}, missing ex2e-row)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
