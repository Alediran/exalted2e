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
  // --no-sandbox is required in the rootless CI container.
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  // 1366×768 is Foundry's stated minimum; use 1920×1080 to avoid the
  // resolution-too-small warning that appears at the default 1280×720.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(60_000);
  try {
    // Navigate to the root so Foundry shows whatever step is pending (EULA,
    // license, setup) rather than hard-coding /license which may not be the
    // first screen on a fresh boot.
    await page.goto(`${FOUNDRY_URL}/`, { waitUntil: "domcontentloaded" });
    // Give ApplicationV2 dialogs time to mount after DOMContentLoaded.
    await page.waitForTimeout(2000);
    await dump(page, "sign-before");

    // Step 1 — accept EULA if the agreement dialog is present.
    // Foundry v14's ApplicationV2 dialog listens for pointer click events, NOT
    // the synthetic "change" event — so we must use page.click() here, not a
    // programmatic checkbox.checked = true assignment.
    const eulaCheckbox = await page.$("input[type=checkbox]");
    if (eulaCheckbox) {
      console.log("EULA dialog present — clicking agreement checkbox.");
      await page.click("input[type=checkbox]");
      await page.waitForTimeout(300);
      // AGREE is the leftmost button in the dialog. Prefer a text match; fall
      // back to the first <button> if the label ever changes.
      const agreed = await page.locator("button", { hasText: /agree/i }).first().click()
        .then(() => true).catch(() => false);
      if (!agreed) await page.locator("button").first().click().catch(() => {});
      console.log("Clicked AGREE on EULA.");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await dump(page, "sign-after-eula");
    }

    // Step 2 — fill in and submit the license page (if we land on it).
    // This may already be gone when using FOUNDRY_RELEASE_URL + a pre-applied
    // license, so the whole block is conditional.
    const licenseField = await page.$(
      "input[name='licenseKey'], textarea[name='licenseKey'], input#license-key, input[name='license']"
    );
    if (licenseField) {
      console.log("License page present — entering key.");
      if (LICENSE_KEY) await licenseField.fill(LICENSE_KEY).catch(() => {});
      // Check EULA agreement box on the license form if it has one.
      const licenseCheck = await page.$("input[type=checkbox]");
      if (licenseCheck) await page.click("input[type=checkbox]").catch(() => {});
      const submitBtn = await page.$("button[type='submit'], button[name='submit'], form button");
      if (submitBtn) await submitBtn.click().catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    }

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
