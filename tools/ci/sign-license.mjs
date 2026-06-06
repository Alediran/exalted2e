/**
 * One-shot license signer. On a fresh CI data dir felddy applies the license
 * key but can't sign it (account auth is blocked from datacenter IPs), so
 * Foundry boots unlicensed and never launches the world. This visits /license,
 * fills the key, accepts the EULA, and submits — Foundry signs via its license
 * API (not Cloudflare-gated) and persists the signature to Data/Config. The
 * caller then restarts the container so it boots licensed and auto-launches
 * FOUNDRY_WORLD.
 *
 * Best-effort: always exits 0. The real gate is run-quench.mjs after restart.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const FOUNDRY_URL = process.env.FOUNDRY_URL ?? "http://localhost:30000";
const LICENSE_KEY = process.env.FOUNDRY_LICENSE_KEY ?? "";
const DIAG_DIR    = process.env.DIAG_DIR ?? "diag";

async function dump(page, tag) {
  try {
    console.log(`[diag:${tag}] url=${page.url()} title="${await page.title().catch(() => "?")}"`);
    await page.screenshot({ path: `${DIAG_DIR}/${tag}.png`, fullPage: true }).catch(() => {});
    await writeFile(`${DIAG_DIR}/${tag}.html`, await page.content().catch(() => "")).catch(() => {});
  } catch { /* never throw from diagnostics */ }
}

async function main() {
  await mkdir(DIAG_DIR, { recursive: true }).catch(() => {});
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  try {
    await page.goto(`${FOUNDRY_URL}/license`, { waitUntil: "domcontentloaded" });
    await dump(page, "sign-before");

    if (LICENSE_KEY) {
      const keyField = await page.$(
        "input[name='licenseKey'], textarea[name='licenseKey'], input#license-key, input[name='license']"
      );
      if (keyField) await keyField.fill(LICENSE_KEY).catch(() => {});
    }

    await page.evaluate(() => {
      for (const c of document.querySelectorAll("input[type=checkbox]")) {
        c.checked = true;
        c.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }).catch(() => {});

    const submit = await page.$("button[type='submit'], button[name='submit'], form button");
    if (submit) await submit.click().catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await dump(page, "sign-after");
    console.log(`License sign step finished at ${page.url()}`);
  } catch (err) {
    console.error("License sign step error (non-fatal):", err.message);
    await dump(page, "sign-error");
  } finally {
    await browser.close().catch(() => {});
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
