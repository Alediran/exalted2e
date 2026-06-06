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
  const browser = await chromium.launch();
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
    await page.waitForFunction(() => !!globalThis.quench, null, { timeout: READY_TIMEOUT });

    // Ensure an active scene exists (some batches place tokens on the active scene).
    await page.evaluate(async () => {
      if (!globalThis.game.scenes?.active) {
        const sc = globalThis.game.scenes?.contents?.[0];
        if (sc) await sc.activate();
      }
    });

    // Collect V8 coverage across the batch run.
    await page.coverage.startJSCoverage({ resetOnNavigation: false });

    // Run every batch; { json: true } writes Data/quench-report.json on the server.
    // page.evaluate has no implicit timeout, so a hung batch would otherwise stall
    // CI until the job-level timeout. Race it against a hard cap.
    await Promise.race([
      page.evaluate(async () => { await globalThis.quench.runBatches("**", { json: true }); }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Quench batches exceeded ${BATCH_TIMEOUT}ms`)), BATCH_TIMEOUT)),
    ]);

    const cov = await page.coverage.stopJSCoverage();

    // Summarize coverage over the system modules and write a JSON summary.
    const systemCov = filterSystemCoverage(cov);
    const covSummary = summarizeCoverage(systemCov);
    await writeFile(COVERAGE_OUT, JSON.stringify(covSummary, null, 2)).catch(() => {});
    console.log(`Coverage (system modules): ${covSummary.totalPct}% — ${covSummary.uncovered.length} file(s) below 100%`);
    if (covSummary.uncovered.length) {
      console.log("Uncovered (worst-first):\n" + covSummary.uncovered.slice(0, 20).map(u => `  ${u}`).join("\n"));
    }

    // Read the server-written report from the mounted Data path.
    try { raw = JSON.parse(await readFile(REPORT_PATH, "utf8")); }
    catch (e) {
      console.error(`CRITICAL: Quench report unreadable at ${REPORT_PATH} (${e.message}). ` +
        `Foundry likely failed to write it — check container logs.`);
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
