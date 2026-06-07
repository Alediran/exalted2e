/**
 * Pure CSS integrity checks — no Foundry, no fs. Each takes CSS text (or
 * pre-parsed rules) and returns findings, so the Vitest test can run them
 * against the real stylesheets and assert on the results.
 */

/** Strip block comments. */
function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ""); }

/** Flat list of {selector, body}. Brace-depth-aware; body = direct declarations. */
export function parseRules(css) {
  const text = strip(css);
  const rules = [];
  const stack = [];
  let buf = "";
  for (const c of text) {
    if (c === "{") { stack.push({ sel: buf.trim(), decls: "" }); buf = ""; }
    else if (c === "}") { const r = stack.pop(); if (r) rules.push({ selector: r.sel, body: r.decls }); buf = ""; }
    else { buf += c; if (stack.length) stack[stack.length - 1].decls += c; }
  }
  return rules;
}

/** Defined (LHS `--ex2e-*:`) vs used (`var(--ex2e-*)`) token sets. */
export function collectTokens(css) {
  const text = strip(css);
  const defined = new Set([...text.matchAll(/(--ex2e-[\w-]+)\s*:/g)].map(m => m[1]));
  const used = new Set([...text.matchAll(/var\(\s*(--ex2e-[\w-]+)/g)].map(m => m[1]));
  return { defined, used };
}

/** Token definitions of the form `--x: var(--x)` (same token both sides). */
export function findSelfRefDefs(css) {
  const text = strip(css);
  const out = [];
  for (const m of text.matchAll(/(--ex2e-[\w-]+)\s*:\s*var\(\s*(--ex2e-[\w-]+)\s*\)/g)) {
    if (m[1] === m[2]) out.push(m[1]);
  }
  return out;
}

/** Used but never defined. */
export function findUndefinedVars({ defined, used }) {
  return [...used].filter(t => !defined.has(t)).sort();
}

/** Defined but never used, minus an allowlist. */
export function findOrphanTokens({ defined, used }, allowlist = []) {
  const allow = new Set(allowlist);
  return [...defined].filter(t => !used.has(t) && !allow.has(t)).sort();
}

/** Brace balance for one file's text. */
export function checkBraceBalance(css) {
  const text = strip(css);
  let open = 0, close = 0;
  for (const c of text) { if (c === "{") open++; else if (c === "}") close++; }
  return { open, close, balanced: open === close };
}

/** Normalize a declaration body for identity comparison. */
function normBody(body) {
  return body.split(";").map(s => s.replace(/\s+/g, " ").trim().toLowerCase())
    .filter(s => s && !s.includes("{") && !s.includes("}"))
    .sort().join(";");
}

/** Verbatim-identical declaration blocks (>=minDecls decls) occurring >=2x. */
export function findDuplicateBlocks(rules, { minDecls = 3 } = {}) {
  const byBody = new Map();
  for (const r of rules) {
    const nb = normBody(r.body);
    if (!nb) continue;
    const declCount = nb.split(";").length;
    if (declCount < minDecls) continue;
    if (!byBody.has(nb)) byBody.set(nb, []);
    byBody.get(nb).push(r.selector);
  }
  return [...byBody.entries()].filter(([, sels]) => sels.length >= 2)
    .map(([nb, sels]) => ({ count: sels.length, decls: nb.split(";").length, selectors: sels }));
}
