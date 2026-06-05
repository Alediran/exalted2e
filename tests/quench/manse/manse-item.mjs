import { sweep }               from "../_helpers/cleanup.mjs";
import { assertTestWorld }     from "../_helpers/world.mjs";
import { createTempCharacter } from "../_helpers/actors.mjs";
import { manseBudgetState }    from "../../../module/helpers/manse-geomancy.mjs";

async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("waitFor timed out");
}

export function registerManse(context) {
  const { describe, it, assert, before, afterEach } = context;

  describe("manse item — data layer", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MN-1] manse stores backgroundId, hearthstoneId, and powers", async () => {
      const actor = await createTempCharacter({ name: "Manse Test Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Iron Hills Manse", type: "manse",
        system: {
          backgroundId:  "test-bg-id",
          hearthstoneId: "test-hs-id",
          powers:        [{ name: "Archive", cost: 1 }]
        }
      }]);
      assert.equal(manse.system.backgroundId,       "test-bg-id", "backgroundId stored");
      assert.equal(manse.system.hearthstoneId,      "test-hs-id", "hearthstoneId stored");
      assert.equal(manse.system.powers.length,      1,            "one power stored");
      assert.equal(manse.system.powers[0].name,     "Archive",    "power name stored");
      assert.equal(manse.system.powers[0].cost,     1,            "power cost stored");
    });

    it("[MN-2] usedBudget equals sum of all power costs", async () => {
      const actor = await createTempCharacter({ name: "Manse Budget Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Summit Manse", type: "manse",
        system: {
          powers: [
            { name: "Archive",             cost: 1 },
            { name: "Bound Servant Force", cost: 2 }
          ]
        }
      }]);
      assert.equal(manse.system.powers[0].cost, 1, "first power cost stored as 1");
      assert.equal(manse.system.powers[1].cost, 2, "second power cost stored as 2");
      const usedBudget = manse.system.powers.reduce((sum, p) => sum + p.cost, 0);
      assert.equal(usedBudget, 3, "sum of costs equals 3");
    });

    it("[MN-3] adding a power appends an entry with default cost 1", async () => {
      const actor = await createTempCharacter({ name: "Manse Add Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Stone Peak Manse", type: "manse",
        system: { powers: [] }
      }]);
      const cloned = foundry.utils.deepClone(manse.system.powers ?? []);
      cloned.push({ name: "", cost: 1 });
      await manse.update({ "system.powers": cloned });
      assert.equal(manse.system.powers.length,    1, "power appended");
      assert.equal(manse.system.powers[0].cost,   1, "default cost is 1");
    });

    it("[MN-4] deleting a power removes the correct index", async () => {
      const actor = await createTempCharacter({ name: "Manse Delete Actor" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Wind Peak Manse", type: "manse",
        system: {
          powers: [
            { name: "Archive",             cost: 1 },
            { name: "Bound Servant Force", cost: 2 }
          ]
        }
      }]);
      const cloned = foundry.utils.deepClone(manse.system.powers);
      cloned.splice(0, 1);
      await manse.update({ "system.powers": cloned });
      assert.equal(manse.system.powers.length,      1,                      "one power remains");
      assert.equal(manse.system.powers[0].name,     "Bound Servant Force",  "correct power remains");
    });

    it("[MN-5] rating derives from linked background value", async () => {
      const actor = await createTempCharacter({ name: "Manse Rating Actor" });
      const [bg] = await actor.createEmbeddedDocuments("Item", [{
        name: "Manse", type: "background", system: { value: 3 }
      }]);
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Iron Hills Manse", type: "manse",
        system: { backgroundId: bg.id }
      }]);
      const rating = actor.items.get(manse.system.backgroundId)?.system.value ?? 0;
      assert.equal(rating, 3, "background item stores value 3 and backgroundId is correctly linked");
    });
  });

  describe("Manse geomancy — Phase 1", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MG-1] geomancy fields, DBL, and power isMaterial persist", async () => {
      const actor = await createTempCharacter({ name: "Q-MG-Persist" });
      const [manse] = await actor.createEmbeddedDocuments("Item", [{
        name: "Q Manse", type: "manse",
        system: {
          maintenance: 2, fragility: 1, habitabilityReduction: 1,
          hearthstoneReduction: 1, designBeyondLimit: true,
          powers: [{ name: "Fortress", cost: 3, isMaterial: true }],
        }
      }]);
      assert.equal(manse.system.maintenance, 2, "maintenance persisted");
      assert.equal(manse.system.fragility, 1, "fragility persisted");
      assert.equal(manse.system.habitabilityReduction, 1, "habitability persisted");
      assert.equal(manse.system.hearthstoneReduction, 1, "hearthstone reduction persisted");
      assert.equal(manse.system.designBeyondLimit, true, "DBL persisted");
      assert.equal(manse.system.powers[0].isMaterial, true, "isMaterial persisted");
    });

    it("[MG-2] manseBudgetState reflects rating x2 + drawback economy", async () => {
      const s = manseBudgetState({ maintenance: 2, hearthstoneReduction: 1, powers: [{ cost: 2 }] }, 3);
      assert.equal(s.total, 9, "total = base 6 + drawbacks 2 + sacrifice 1");
      assert.equal(s.used, 2, "used = sum of costs");
      assert.equal(s.over, false, "not over budget");
    });
  });

  describe("Manse powers — Phase 2a", () => {
    before(() => assertTestWorld());
    afterEach(async () => { await sweep(); });

    it("[MP-1] manse-power item persists its fields", async () => {
      const actor = await createTempCharacter({ name: "Q-MP-Persist" });
      const [p] = await actor.createEmbeddedDocuments("Item", [{
        name: "Fortress", type: "manse-power",
        system: { cost: 3, aspectFavored: ["earth"], onlyAspect: [], abilityReq: "War 4", multiPurchase: true, isMaterial: false }
      }]);
      assert.equal(p.system.cost, 3, "cost persisted");
      assert.deepEqual(p.system.aspectFavored, ["earth"], "aspectFavored persisted");
      assert.equal(p.system.multiPurchase, true, "multiPurchase persisted");
    });

    it("[MP-2] picker snapshot pushes onto the manse's powers[] and budget counts it", async () => {
      const actor = await createTempCharacter({ name: "Q-MP-Add" });
      const [bg] = await actor.createEmbeddedDocuments("Item", [{ name: "Mountain Manse", type: "background", system: { value: 3, backgroundType: "manse" } }]);
      const [manse] = await actor.createEmbeddedDocuments("Item", [{ name: "Q Manse", type: "manse", system: { backgroundId: bg.id, powers: [] } }]);

      const { MansePowerPickerDialog } = await import("../../../module/dialogs/manse-power-picker-dialog.mjs");
      const origPrompt = MansePowerPickerDialog.prompt;
      MansePowerPickerDialog.prompt = async () => ({ name: "Fortress", cost: 2, isMaterial: false });
      try {
        await manse.sheet.render(true);
        await waitFor(() => manse.sheet.rendered && !!manse.sheet.element);
        const btn = await waitFor(() => manse.sheet.element.querySelector("[data-action='addMansePowerFromCatalog']"));
        btn.click();
        await waitFor(() => (manse.system.powers ?? []).some(p => p.name === "Fortress"));
        const power = manse.system.powers.find(p => p.name === "Fortress");
        assert.ok(power, "snapshot pushed onto powers[]");
        assert.equal(power.cost, 2, "snapshot cost stored");

        const s = manseBudgetState(manse.system, 3);
        assert.equal(s.used, 2, "budget counts the added power");
      } finally {
        MansePowerPickerDialog.prompt = origPrompt;
        await manse.sheet.close();
      }
    });
  });
}
