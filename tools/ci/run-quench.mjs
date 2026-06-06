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
const DIAG_DIR     = process.env.DIAG_DIR ?? "diag";
const COVERAGE_OUT = process.env.COVERAGE_OUT ?? "coverage/quench-coverage.json";
const NAV_TIMEOUT  = 120_000;
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
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  let raw = null;

  try {
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: "domcontentloaded" });
    console.log(`Loaded ${page.url()} — "${await page.title().catch(() => "?")}"`);

    // Wait for the join page's user selector. Loosened to just the select so a
    // changed form id doesn't break it. On timeout, dump the screen first.
    try {
      await page.waitForSelector("select[name='userid']", { timeout: NAV_TIMEOUT });
    } catch (e) {
      await dumpDiag(page, "join-no-userid");
      throw new Error(`Join page never showed select[name='userid']. We may be on a setup/EULA/error screen — see ${DIAG_DIR}/join-no-userid.{png,html}. (${e.message})`);
    }

    // Select the GM by visible label; password left blank.
    await page.selectOption("select[name='userid']", { label: GM_NAME });
    await page.click("button[name='join'], button[type='submit']");

    // Wait for the game to be fully ready and Quench to be registered.
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: NAV_TIMEOUT });
    await page.waitForFunction(() => !!globalThis.quench, null, { timeout: NAV_TIMEOUT });

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
