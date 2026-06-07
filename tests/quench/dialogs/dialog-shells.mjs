import { sweep }              from "../_helpers/cleanup.mjs";
import { assertTestWorld }    from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";

import { FormulaBuilderDialog }    from "../../../module/dialogs/formula-builder-dialog.mjs";
import { GmRollPoolDialog }        from "../../../module/dialogs/gm-roll-pool-dialog.mjs";
import { ResplendentParadoxDialog } from "../../../module/dialogs/resplendent-paradox-dialog.mjs";
import { AddSpecialtyDialog }      from "../../../module/dialogs/add-specialty-dialog.mjs";
import { ComboCharmPickerDialog }  from "../../../module/dialogs/combo-charm-picker-dialog.mjs";
import { GiftPickerDialog }        from "../../../module/dialogs/gift-picker-dialog.mjs";
import { CounterattackDialog }     from "../../../module/dialogs/counterattack-dialog.mjs";
import { CoordinationDialog }      from "../../../module/dialogs/coordination-dialog.mjs";
import { PurchaseConfirmDialog }   from "../../../module/dialogs/purchase-confirm-dialog.mjs";
import { FlurryDeclarationDialog } from "../../../module/dialogs/flurry-declaration-dialog.mjs";
import { ShapeshiftDialog }        from "../../../module/dialogs/shapeshift-dialog.mjs";
import { CooperativeCharmDialog }  from "../../../module/dialogs/cooperative-charm-dialog.mjs";
import { CountermagicDialog }      from "../../../module/dialogs/countermagic-dialog.mjs";
import { PermissionsConfigDialog } from "../../../module/dialogs/permissions-config-dialog.mjs";
import { XpCostsConfigDialog }     from "../../../module/dialogs/xp-costs-config-dialog.mjs";
import { AnimaColorDialog }        from "../../../module/dialogs/anima-color-dialog.mjs";
import { DestinyCreationDialog }   from "../../../module/dialogs/destiny-creation-dialog.mjs";
import { EruptionAllocationDialog } from "../../../module/dialogs/eruption-allocation-dialog.mjs";
import { VirtueFlawPickerDialog }  from "../../../module/dialogs/virtueflaw-picker-dialog.mjs";
import { MansePowerPickerDialog }  from "../../../module/dialogs/manse-power-picker-dialog.mjs";

// Local poll helper (headless render can be slow).
async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await predicate();
    if (ok) return ok;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: predicate never returned truthy within ${timeoutMs}ms`);
}

/** Render a constructed dialog, assert it produced an element, then close it. */
async function smokeRender(dlg, assert, label) {
  await dlg.render(true);
  await waitFor(() => dlg.rendered && !!dlg.element);
  try {
    assert.ok(dlg.element, `[DLG] ${label} rendered an element`);
  } finally {
    await dlg.close();
  }
}

export function registerDialogShells(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("Dialog shells (render)", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    // ── Bucket A: options-bag dialogs, no actor needed ──────────────────────
    it("[DLG] formula-builder renders", async () => {
      await smokeRender(new FormulaBuilderDialog({ formula: "" }, () => {}), assert, "formula-builder");
    });
    it("[DLG] gm-roll-pool renders", async () => {
      await smokeRender(new GmRollPoolDialog({ description: "", difficulty: 7 }, () => {}), assert, "gm-roll-pool");
    });
    it("[DLG] resplendent-paradox renders", async () => {
      await smokeRender(new ResplendentParadoxDialog({}, () => {}), assert, "resplendent-paradox");
    });
    it("[DLG] add-specialty renders", async () => {
      await smokeRender(new AddSpecialtyDialog({ abilities: ["melee"] }, () => {}), assert, "add-specialty");
    });
    it("[DLG] combo-charm-picker renders", async () => {
      await smokeRender(new ComboCharmPickerDialog({ candidates: [] }, () => {}), assert, "combo-charm-picker");
    });
    it("[DLG] gift-picker renders", async () => {
      await smokeRender(new GiftPickerDialog({ gifts: [], baseCost: 5, essenceMax: 1 }, () => {}), assert, "gift-picker");
    });
    it("[DLG] counterattack renders", async () => {
      await smokeRender(new CounterattackDialog({ charms: [], weaponModes: [], targetName: "X" }, () => {}), assert, "counterattack");
    });
    it("[DLG] coordination renders", async () => {
      await smokeRender(new CoordinationDialog({}, () => {}), assert, "coordination");
    });
    it("[DLG] purchase-confirm renders", async () => {
      await smokeRender(new PurchaseConfirmDialog({ change: null }, () => {}), assert, "purchase-confirm");
    });

    // ── Bucket B: real actor / stub item ────────────────────────────────────
    it("[DLG] flurry-declaration renders", async () => {
      const actor = await createTempCharacter({ name: "Q-DLG-flurry" });
      await smokeRender(new FlurryDeclarationDialog({ actor, actorName: actor.name }, () => {}), assert, "flurry-declaration");
    });
    it("[DLG] shapeshift renders", async () => {
      const actor = await createTempCharacter({ name: "Q-DLG-shapeshift" });
      await smokeRender(new ShapeshiftDialog({ actor }, () => {}), assert, "shapeshift");
    });
    it("[DLG] cooperative-charm renders", async () => {
      const charm = { name: "Q Coop Charm", system: { cost: { motes: 0 } } };
      await smokeRender(new CooperativeCharmDialog(charm, [], {}, () => {}), assert, "cooperative-charm");
    });

    // ── Bucket C: target/combat stub ────────────────────────────────────────
    it("[DLG] countermagic renders", async () => {
      const counterActor = await createTempCharacter({ name: "Q-DLG-counter" });
      const target = { type: "effect-self", ae: { flags: {}, name: "x" } };
      await smokeRender(new CountermagicDialog({ target, counterActor, eligibleCharms: [] }, () => {}), assert, "countermagic");
    });

    // ── Bucket D: config dialogs (default ctor, no resolve) ──────────────────
    it("[DLG] permissions-config renders", async () => {
      await smokeRender(new PermissionsConfigDialog({}), assert, "permissions-config");
    });
    it("[DLG] xp-costs-config renders", async () => {
      await smokeRender(new XpCostsConfigDialog({}), assert, "xp-costs-config");
    });

    // ── Bucket E: real actor + system globals (present at runtime) ───────────
    it("[DLG] anima-color renders", async () => {
      const actor = await createTempCharacter({ name: "Q-DLG-anima" });
      await smokeRender(new AnimaColorDialog({ actor }), assert, "anima-color");
    });
    it("[DLG] destiny-creation renders", async () => {
      const actor = await createTempCharacter({ name: "Q-DLG-destiny" });
      await smokeRender(new DestinyCreationDialog(actor), assert, "destiny-creation");
    });
    it("[DLG] eruption-allocation renders", async () => {
      const actor = await createTempCharacter({ name: "Q-DLG-eruption" });
      await smokeRender(new EruptionAllocationDialog(actor, 5), assert, "eruption-allocation");
    });
    it("[DLG] virtueflaw-picker renders", async () => {
      await smokeRender(new VirtueFlawPickerDialog({ exaltType: "solar" }, () => {}), assert, "virtueflaw-picker");
    });
    it("[DLG] manse-power-picker renders", async () => {
      await smokeRender(new MansePowerPickerDialog({ rating: 3, manseAspect: "", existingNames: [] }, () => {}), assert, "manse-power-picker");
    });
  });
}
