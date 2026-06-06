/**
 * Headless Quench runner. Assumes a Foundry server is already serving the
 * `exalted2e-test` world at FOUNDRY_URL (default http://localhost:30000) with
 * the system + Quench active and a passwordless "Gamemaster" user present.
 *
 * Flow: launch Chromium → join as Gamemaster → wait for quench + game.ready →
 * ensure an active scene → run all batches (writes Data/quench-report.json) →
 * read that report from QUENCH_REPORT_PATH → parse → exit non-zero on failure.
 *
 * Pure decision logic lives in ./quench-results.mjs (unit-tested). This file is
 * thin integration glue, verified by the CI run itself.
 */
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { parseQuenchResults } from "./quench-results.mjs";
import { filterSystemCoverage, summarizeCoverage } from "./coverage-report.mjs";

const FOUNDRY_URL  = process.env.FOUNDRY_URL  ?? "http://localhost:30000";
const REPORT_PATH  = process.env.QUENCH_REPORT_PATH ?? "/data/Data/quench-report.json";
const GM_NAME      = process.env.FOUNDRY_GM_NAME ?? "Gamemaster";
const NAV_TIMEOUT  = 120_000;
const BATCH_TIMEOUT = Number(process.env.QUENCH_BATCH_TIMEOUT_MS ?? 600_000); // hard cap on the whole run

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  // Join the already-launched world as the GM user.
  await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("form#join-game, select[name='userid']", { timeout: NAV_TIMEOUT });
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

  await browser.close();

  // Summarize coverage over the system modules and write a JSON summary.
  const systemCov = filterSystemCoverage(cov);
  const covSummary = summarizeCoverage(systemCov);
  await writeFile(
    process.env.COVERAGE_OUT ?? "coverage/quench-coverage.json",
    JSON.stringify(covSummary, null, 2)
  ).catch(() => {});
  console.log(`Coverage (system modules): ${covSummary.totalPct}% — ${covSummary.uncovered.length} file(s) below 100%`);
  if (covSummary.uncovered.length) {
    console.log("Uncovered (worst-first):\n" + covSummary.uncovered.slice(0, 20).map(u => `  ${u}`).join("\n"));
  }

  // Read the server-written report from the mounted Data path.
  let raw = null;
  try { raw = JSON.parse(await readFile(REPORT_PATH, "utf8")); }
  catch (e) {
    console.error(`CRITICAL: Quench report unreadable at ${REPORT_PATH} (${e.message}). ` +
      `Foundry likely failed to boot or run — check the container logs.`);
  }

  const result = parseQuenchResults(raw);
  console.log(result.summary);
  process.exit(result.exitCode);
}

main().catch(err => { console.error(err); process.exit(1); });
