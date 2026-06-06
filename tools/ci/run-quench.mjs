/**
 * Headless Quench runner. Assumes a Foundry server is already serving the
 * `exalted2e-test` world at FOUNDRY_URL (default http://localhost:30000) with
 * the system + Quench active and a passwordless "Gamemaster" user present.
 *
 * Flow: launch Chromium → join as Gamemaster → wait for quench + game.ready →
 * ensure an active scene → run all batches (writes Data/quench-report.json) →
 * read that report from QUENCH_REPORT_PATH → parse → exit non-zero on failure.
 *
 * On any failure it writes diagnostics (URL, title, screenshot, HTML) to
 * DIAG_DIR so the actual screen can be inspected from CI artifacts.
 *
 * Pure decision logic lives in ./quench-results.mjs (unit-tested). This file is
 * thin integration glue, verified by the CI run itself.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { parseQuenchResults } from "./quench-results.mjs";
import { filterSystemCoverage, summarizeCoverage } from "./coverage-report.mjs";
import v8toIstanbul from "v8-to-istanbul";
import { normalizeCoverageKey } from "./coverage-paths.mjs";

const FOUNDRY_URL  = process.env.FOUNDRY_URL  ?? "http://localhost:30000";
const REPORT_PATH  = process.env.QUENCH_REPORT_PATH ?? "/data/Data/quench-report.json";
const GM_NAME      = process.env.FOUNDRY_GM_NAME ?? "Gamemaster";
const GM_PASSWORD  = process.env.FOUNDRY_GM_PASSWORD ?? ""; // world.json resetKeys clears the GM password on launch
const DIAG_DIR     = process.env.DIAG_DIR ?? "diag";
const COVERAGE_OUT = process.env.COVERAGE_OUT ?? "coverage/quench-coverage.json";
const NAV_TIMEOUT  = 120_000;
// World launch migrates all compendium packs (thousands of items) on every
// fresh CI boot, which can take several minutes before game.ready fires.
const READY_TIMEOUT = Number(process.env.FOUNDRY_READY_TIMEOUT_MS ?? 600_000);
const BATCH_TIMEOUT = Number(process.env.QUENCH_BATCH_TIMEOUT_MS ?? 600_000); // hard cap on the whole run
// Batches that can't pass headlessly (E2E assertions on canvas placeable state,
// e.g. token.x after a move — the rendered position lags without a real canvas).
// The logic is covered by the matching "focused" batches. Comma-separated.
const SKIP_BATCHES = (process.env.QUENCH_SKIP_BATCHES ?? "exalted2e.knockback.smoke")
  .split(",").map(s => s.trim()).filter(Boolean);

/** Best-effort diagnostics dump — never throws. */
async function dumpDiag(page, tag) {
  try {
    const url = page.url();
    const title = await page.title().catch(() => "?");
    console.error(`[diag:${tag}] url=${url} title="${title}"`);
    await page.screenshot({ path: `${DIAG_DIR}/${tag}.png`, fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => "");
    await writeFile(`${DIAG_DIR}/${tag}.html`, html).catch(() => {});
    console.error(`[diag:${tag}] saved screenshot + html under ${DIAG_DIR}/`);
  } catch { /* diagnostics must never mask the real error */ }
}

async function main() {
  await mkdir(DIAG_DIR, { recursive: true }).catch(() => {});
  // Use SwiftShader for WebGL. Without it, headless Chromium falls back to a
  // very slow software path that pegs the CPU rendering Foundry's PIXI canvas,
  // starving the socket so document CRUD times out (every test hits the 2000ms
  // mocha timeout). SwiftShader keeps the canvas cheap so tests run normally.
  const browser = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-sandbox",
    ],
  });
  // Foundry needs a viewport >= 1366x768 or it warns and disables features.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(NAV_TIMEOUT);
  // Surface client-side logs/errors in the CI output — these reveal a system
  // init/ready exception that would otherwise just look like a game.ready hang.
  page.on("console", m => console.log(`[browser:${m.type()}] ${m.text()}`));
  page.on("pageerror", e => console.error(`[pageerror] ${e.message}`));
  let raw = null;

  try {
    // Licensing + world launch are handled by the workflow (Sign license +
    // restart). Here we just wait for the world to finish launching/migrating
    // and join — READY_TIMEOUT covers the migration window.
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: "domcontentloaded" });
    console.log(`Loaded ${page.url()} — "${await page.title().catch(() => "?")}"`);

    // Wait for the join page's user selector. Loosened to just the select so a
    // changed form id doesn't break it. On timeout, dump the screen first.
    try {
      await page.waitForSelector("select[name='userid']", { timeout: READY_TIMEOUT });
    } catch (e) {
      await dumpDiag(page, "join-no-userid");
      throw new Error(`Join page never showed select[name='userid']. We may be on a setup/EULA/error screen — see ${DIAG_DIR}/join-no-userid.{png,html}. (${e.message})`);
    }

    // Select the GM by visible label and provide its password.
    await page.selectOption("select[name='userid']", { label: GM_NAME });
    const pwField = await page.$("input[name='password']");
    if (pwField) await pwField.fill(GM_PASSWORD).catch(() => {});
    await page.click("button[name='join'], button[type='submit']");
    console.log(`Clicked join; now at ${page.url()}`);

    // Wait for the game to be fully ready and Quench to be registered. On
    // timeout, probe the in-page game state so we know whether we even entered
    // the game (vs. stuck on /join) and whether ready/quench are present.
    try {
      await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: READY_TIMEOUT });
    } catch (e) {
      const state = await page.evaluate(() => ({
        url: location.href,
        hasGame: typeof globalThis.game !== "undefined",
        ready: globalThis.game?.ready ?? null,
        world: globalThis.game?.world?.id ?? null,
        user: globalThis.game?.user?.name ?? null,
        hasQuench: !!globalThis.quench,
      })).catch(() => null);
      console.error("game.ready timed out; in-page state:", JSON.stringify(state));
      await dumpDiag(page, "game-not-ready");
      throw e;
    }
    // Wait for Quench's API to be available. Resolve it from any of the places
    // a module may expose it: a global, game.quench, or the module's `api`.
    try {
      await page.waitForFunction(() => {
        const g = globalThis;
        return !!(g.quench || g.game?.quench || g.game?.modules?.get("quench")?.api);
      }, null, { timeout: READY_TIMEOUT });
    } catch (e) {
      const qstate = await page.evaluate(() => ({
        moduleInstalled: !!globalThis.game?.modules?.get("quench"),
        moduleActive:    globalThis.game?.modules?.get("quench")?.active ?? null,
        hasGlobalQuench: typeof globalThis.quench !== "undefined",
        hasGameQuench:   typeof globalThis.game?.quench !== "undefined",
        hasModuleApi:    !!globalThis.game?.modules?.get("quench")?.api,
        activeModules:   [...(globalThis.game?.modules ?? [])].filter(m => m.active).map(m => m.id),
      })).catch(() => null);
      console.error("quench API not found; state:", JSON.stringify(qstate));
      await dumpDiag(page, "no-quench");
      throw e;
    }

    // Report how many batches registered. 0 means the system's Quench harness
    // (module/exalted2e.mjs → tests/quench/index.mjs) failed to load — look for
    // "Quench test harness failed to load" earlier in the log.
    const batchInfo = await page.evaluate(() => {
      const q = globalThis.quench || globalThis.game?.quench || globalThis.game?.modules?.get("quench")?.api;
      const reg = q?._testBatches;
      const keys = reg ? [...reg.keys()] : [];
      return { count: keys.length, sample: keys.slice(0, 5) };
    }).catch(() => ({ count: -1, sample: [] }));
    console.log(`Quench batches registered: ${batchInfo.count}${batchInfo.sample.length ? " e.g. " + batchInfo.sample.join(", ") : ""}`);
    if (SKIP_BATCHES.length) console.log(`Skipping headless-incompatible batches: ${SKIP_BATCHES.join(", ")}`);
    if (batchInfo.count === 0) await dumpDiag(page, "no-batches");

    // Ensure an active scene exists (some batches place tokens on the active scene).
    await page.evaluate(async () => {
      if (!globalThis.game.scenes?.active) {
        const sc = globalThis.game.scenes?.contents?.[0];
        if (sc) await sc.activate();
      }
    });

    // Render Quench's app first so its reporter has a DOM element (otherwise the
    // run hits "Cannot read properties of undefined (reading 'querySelector')").
    await page.evaluate(async () => {
      const q = globalThis.quench || globalThis.game?.quench || globalThis.game?.modules?.get("quench")?.api;
      try { if (q?.app?.render) await q.app.render(true); } catch { /* non-fatal */ }
    }).catch(() => {});
    await page.waitForTimeout(1000);

    // Collect V8 coverage across the batch run.
    await page.coverage.startJSCoverage({ resetOnNavigation: false });

    // Run every registered batch by explicit key — the "**" glob matched none of
    // the dotted batch ids (e.g. "exalted2e.knockback.focused"). { json: true }
    // writes Data/quench-report.json on the server. page.evaluate has no implicit
    // timeout, so race a hung run against a hard cap.
    // A cap stops a hung run, but on timeout we still capture partial results
    // below rather than aborting to 0 — so a slow/failing suite is reported.
    let runResult = null;
    try {
      runResult = await Promise.race([
        page.evaluate(async (skip) => {
          const q = globalThis.quench || globalThis.game?.quench || globalThis.game?.modules?.get("quench")?.api;
          const keys = [...(q._testBatches?.keys() ?? [])].filter(k => !skip.includes(k));

          // Resilient gate: the suite has a known cross-test teardown race where
          // a swept actor/combat is referenced by a late async hook (chat-card
          // re-render, etc.). That surfaces as an uncaught rejection mocha blames
          // on whatever test is running, flaking unrelated tests. Swallow ONLY
          // those specific "does not exist in …" errors before mocha sees them
          // (capture phase + stopImmediatePropagation). Real assertion failures
          // and other errors are untouched.
          const RACE_RE = /does not exist in (the )?(actors|combats|items|scenes)/i;
          const swallow = (msg, ev) => {
            if (msg && RACE_RE.test(msg)) { ev.stopImmediatePropagation(); ev.preventDefault?.(); }
          };
          window.addEventListener("unhandledrejection",
            (e) => swallow(e?.reason?.message || String(e?.reason ?? ""), e), true);
          window.addEventListener("error",
            (e) => swallow(e?.error?.message || e?.message || "", e), true);
          // CI perf varies and many tests sit near the 2000ms mocha default, so
          // give the suite timeout headroom. NOT retries — mocha marks a
          // this.skip() test as FAILED rather than pending when retries are on,
          // and the cross-test races are already handled by the error suppression
          // below, so retries aren't needed.
          try {
            if (q.mocha?.options) q.mocha.options.timeout = 15000;
            q.mocha?.timeout?.(15000);
          } catch { /* best effort */ }
          // runBatches kicks off mocha.run() and returns the runner WITHOUT
          // awaiting completion — so we must wait for the runner's "end" event,
          // otherwise reports/coverage are read before any test executes.
          const runner = await q.runBatches(keys.length ? keys : "**", { json: true });

          // Collect failures straight from the runner's "fail" events — these
          // fire for BOTH tests and hooks (with titles + errors), so they name
          // failures that never appear as a tests[]/failures[] entry (e.g. an
          // "after each" hook). Attached synchronously here, before any test
          // runs (mocha.run schedules tests on later ticks).
          const failedTests = [];
          runner?.on?.("fail", (r, err) => {
            let title = "(unknown)";
            try { title = typeof r?.fullTitle === "function" ? r.fullTitle() : (r?.title || title); } catch { /* ignore */ }
            let error = "";
            try { error = (err && err.message) || String(err ?? ""); } catch { /* ignore */ }
            failedTests.push({ title, error });
          });

          // runBatches builds per-batch sub-suites whose tests keep mocha's 2000ms
          // default — setting only the root suite's timeout does NOT propagate.
          // Walk the whole tree (built synchronously by runBatches, before any
          // test executes) and force a generous timeout on every suite AND test.
          try {
            const bump = (s) => {
              try { s.timeout?.(15000); } catch { /* ignore */ }
              for (const t of (s.tests ?? [])) { try { t.timeout?.(15000); } catch { /* ignore */ } }
              // Hooks aren't in s.tests — they live in these arrays and keep the
              // 2000ms default otherwise (an afterEach was the timeout culprit).
              for (const arr of [s._beforeAll, s._afterAll, s._beforeEach, s._afterEach]) {
                for (const h of (arr ?? [])) { try { h.timeout?.(15000); } catch { /* ignore */ } }
              }
              for (const c of (s.suites ?? [])) bump(c);
            };
            bump(q.mocha.suite);
          } catch { /* best effort */ }
          await new Promise((resolve) => {
            if (!runner || runner.stats?.end || runner.state === "stopped") return resolve();
            let settled = false;
            const finish = () => { if (!settled) { settled = true; resolve(); } };
            runner.once?.("end", finish);
            // Safety net in case the "end" event fired before we attached.
            const iv = setInterval(() => { if (runner.stats?.end) { clearInterval(iv); finish(); } }, 500);
          });

          const s = runner?.stats ?? {};
          return {
            total:    s.tests    ?? 0,
            passes:   s.passes   ?? 0,
            failures: s.failures ?? failedTests.length,
            pending:  s.pending  ?? 0,
            failedTests,
          };
        }, SKIP_BATCHES),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Quench batches exceeded ${BATCH_TIMEOUT}ms`)), BATCH_TIMEOUT)),
      ]);
    } catch (e) {
      console.error(`Quench run did not finish cleanly: ${e.message} — capturing partial results.`);
    }

    const cov = await page.coverage.stopJSCoverage().catch(() => []);

    // Summarize coverage over the system modules and write a JSON summary.
    const systemCov = filterSystemCoverage(cov);
    const covSummary = summarizeCoverage(systemCov);
    await writeFile(COVERAGE_OUT, JSON.stringify(covSummary, null, 2)).catch(() => {});
    console.log(`Coverage (system modules): ${covSummary.totalPct}% — ${covSummary.uncovered.length} file(s) below 100%`);
    if (covSummary.uncovered.length) {
      console.log("Uncovered (worst-first):\n" + covSummary.uncovered.slice(0, 20).map(u => `  ${u}`).join("\n"));
    }

    // Convert the system-module V8 coverage to an istanbul coverage map so it can
    // be merged with the Vitest coverage. Keys are normalized to repo-relative
    // module/... so both runtimes' entries line up.
    const istanbul = {};
    for (const entry of systemCov) {
      try {
        const key = normalizeCoverageKey(entry.url);
        const converter = v8toIstanbul(key, 0, { source: entry.source ?? "" });
        await converter.load();
        converter.applyCoverage(entry.functions ?? []);
        Object.assign(istanbul, converter.toIstanbul());
      } catch (e) {
        console.error(`(coverage) could not convert ${entry.url}: ${e.message}`);
      }
    }
    await writeFile("coverage/quench-coverage-final.json", JSON.stringify(istanbul)).catch(() => {});
    console.log(`Wrote istanbul coverage for ${Object.keys(istanbul).length} system module(s).`);

    // Results come straight from the mocha runner (stats + "fail" events). This
    // is authoritative and shape-independent — it names hook failures too.
    console.log(`Quench results: ${JSON.stringify({ total: runResult?.total, passes: runResult?.passes, failures: runResult?.failures, pending: runResult?.pending })}`);
    if (runResult?.failedTests?.length) {
      console.log("Failed:\n" + runResult.failedTests.map(t => `  ✗ ${t.title}${t.error ? ` — ${t.error}` : ""}`).join("\n"));
    }

    if (runResult && runResult.total > 0) {
      raw = {
        stats: { tests: runResult.total, passes: runResult.passes, failures: runResult.failures, pending: runResult.pending },
        failures: (runResult.failedTests ?? []).map(t => ({ fullTitle: t.title, err: { message: t.error } })),
      };
    } else {
      // Fall back to the server-written report file (e.g. if the run timed out).
      try { raw = JSON.parse(await readFile(REPORT_PATH, "utf8")); }
      catch (e) {
        console.error(`No runner stats and Quench report unreadable at ${REPORT_PATH} (${e.message}).`);
      }
    }
  } catch (err) {
    console.error(err);
    await dumpDiag(page, "failure");
    raw = null; // fail-closed
  } finally {
    await browser.close().catch(() => {});
  }

  const result = parseQuenchResults(raw);
  console.log(result.summary);
  process.exit(result.exitCode);
}

main().catch(err => { console.error(err); process.exit(1); });
