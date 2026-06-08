import { sweep } from "../_helpers/cleanup.mjs";
import { assertTestWorld } from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { createTempWeapon } from "../_helpers/weapons.mjs";

/**
 * Poll until predicate truthy or timeoutMs elapses.
 */
async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

export function registerResourceEconomySmoke(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("resource economy — smoke (real DOM)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // Test 1: Purchase Mode round-trip
    it("[110] opens the real PurchaseConfirmDialog and applies confirm via DOM click", async () => {
      const actor = await createTempCharacter({ name: "Q-Smoke-Purchase", str: 2 });
      await actor.update({
        "system.purchaseLocked": true,
        "system.experience.value": 20
      });
      await actor.sheet.render(true);
      await waitFor(() => actor.sheet.rendered === true);

      // Fire-and-forget: the update awaits the dialog mid-_preUpdate
      const updatePromise = actor.update({
        "system.attributes.strength.value": 3
      });

      // Wait for the dialog to render
      const dialog = await waitFor(() =>
        document.querySelector("#ex2e-purchase-confirm")
      );

      // Set the xpCost input and click confirm
      const xpInput = dialog.querySelector("input[name='xpCost']");
      xpInput.value = "8";
      xpInput.dispatchEvent(new Event("input", { bubbles: true }));
      const noteInput = dialog.querySelector("input[name='note']");
      if (noteInput) {
        noteInput.value = "smoke";
        noteInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const confirmBtn = dialog.querySelector("[data-action='confirmPurchase']");
      confirmBtn.click();

      await updatePromise;
      await waitFor(() => actor.system.attributes.strength.value === 3);
      // Dialog close is async — poll for the element to disappear.
      await waitFor(() => !document.querySelector("#ex2e-purchase-confirm"));

      assert.equal(actor.system.attributes.strength.value, 3);
      assert.equal((actor.system.purchaseLog ?? []).length, 1);
      assert.equal(actor.system.experience.value, 12);
      assert.ok(!document.querySelector("#ex2e-purchase-confirm"),
        "dialog closed after confirm");
    });

    // Test 2: Attune round-trip with rendered sheet
    it("[111] reflects an attune update in the rendered character sheet's mote pool", async () => {
      const actor = await createTempCharacter({ name: "Q-Smoke-Attune" });
      await actor.update({ "system.essence.value": 5 });
      // Read the derived max AFTER essence bump (motes.*.max is clobbered by
      // prepareDerivedData — never trust a persisted max value).
      const startMax = actor.system.motes.peripheral.max;
      await actor.update({ "system.motes.peripheral.value": startMax });
      const item = await createTempWeapon(actor, {
        name: "Q-Smoke-Artifact",
        artifact: true, attuned: false, attunementCost: 5
      });
      await actor.sheet.render(true);
      await waitFor(() => actor.sheet.rendered === true);

      await item.update({ "system.attuned": true }, { attunePool: "peripheral" });
      // Wait for the actor data to settle, then poll for the sheet's
      // re-rendered DOM to reflect the new value (re-render is async).
      await waitFor(() => actor.system.motes.peripheral.value === startMax - 5);
      const expected = String(startMax - 5);
      await waitFor(() => {
        const input = actor.sheet.element?.querySelector(
          "input[data-pool='peripheral'][data-field='value']"
        );
        return input && String(input.value) === expected;
      });

      assert.equal(actor.system.motes.peripheral.value, startMax - 5);
      assert.equal(actor.system.motes.peripheral.totalCommitted, 5);
      // DOM check: the rendered character sheet's peripheral mote input
      // reflects the post-attune pool value.
      const input = actor.sheet.element.querySelector(
        "input[data-pool='peripheral'][data-field='value']"
      );
      assert.ok(input, "peripheral mote input present in rendered sheet");
      assert.equal(String(input.value), expected,
        "rendered peripheral input shows the post-attune value");
    });
  });
}
