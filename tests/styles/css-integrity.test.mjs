import { describe, it, expect } from "vitest";
import {
  parseRules, collectTokens, findSelfRefDefs, findUndefinedVars,
  findOrphanTokens, checkBraceBalance, findDuplicateBlocks,
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
});

const STYLES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../styles");
const ORPHAN_ALLOWLIST = [];   // intentionally-reserved tokens (none after cleanup)
const CSS_DUP_MAX = 89;        // baseline; lower as structural merges land, never raise

function readStyles() {
  const files = fs.readdirSync(STYLES_DIR).filter(f => f.endsWith(".css"));
  return files.map(f => ({ file: f, css: fs.readFileSync(path.join(STYLES_DIR, f), "utf8") }));
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
});
