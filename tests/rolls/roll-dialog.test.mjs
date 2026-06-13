import { vi, describe, it, expect } from "vitest";
import { RollDialog } from "../../module/rolls/roll-dialog.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDialog(options = {}) {
  const resolve = vi.fn();
  const dialog  = new RollDialog(options, resolve);
  return { dialog, resolve };
}

// ── constructor ───────────────────────────────────────────────────────────────

describe("RollDialog constructor", () => {
  it("defaults pool to 1", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.pool).toBe(1);
  });

  it("accepts pool from options", () => {
    const { dialog } = makeDialog({ pool: 7 });
    expect(dialog._data.pool).toBe(7);
  });

  it("defaults stunt to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.stunt).toBe(0);
  });

  it("defaults moteCost to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.moteCost).toBe(0);
  });

  it("defaults moteType to 'peripheral'", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.moteType).toBe("peripheral");
  });

  it("defaults excellency to all-false", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.excellency).toEqual({ first: false, second: false, third: false });
  });

  it("defaults firstExcMax to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.firstExcMax).toBe(0);
  });

  it("defaults secondExcMax to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.secondExcMax).toBe(0);
  });

  it("defaults virtues to null", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.virtues).toBeNull();
  });

  it("defaults advancesMotivation to false", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.advancesMotivation).toBe(false);
  });

  it("defaults rewardKind to 'motes'", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.rewardKind).toBe("motes");
  });

  it("defaults firstExcCostPerDie to 1", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.firstExcCostPerDie).toBe(1);
  });

  it("defaults secondExcCostPerSucc to 2", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.secondExcCostPerSucc).toBe(2);
  });

  it("defaults _resolved to false", () => {
    const { dialog } = makeDialog();
    expect(dialog._resolved).toBe(false);
  });

  it("accepts flavor from options", () => {
    const { dialog } = makeDialog({ flavor: "Strike of the Sun" });
    expect(dialog._data.flavor).toBe("Strike of the Sun");
  });

  it("stores resolve callback", () => {
    const resolve = vi.fn();
    const dialog  = new RollDialog({}, resolve);
    expect(dialog._resolve).toBe(resolve);
  });
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("RollDialog._prepareContext", () => {
  it("includes stuntChoices with 4 entries", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(Object.keys(ctx.stuntChoices)).toHaveLength(4);
  });

  it("stuntChoices keys are 0, 1, 2, 3", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(Object.keys(ctx.stuntChoices).map(Number)).toEqual([0, 1, 2, 3]);
  });

  it("includes moteTypeChoices with personal and peripheral", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.moteTypeChoices).toHaveProperty("personal");
    expect(ctx.moteTypeChoices).toHaveProperty("peripheral");
  });

  it("virtueChoices is empty array when virtues is null", async () => {
    const { dialog } = makeDialog({ virtues: null });
    const ctx = await dialog._prepareContext({});
    expect(ctx.virtueChoices).toEqual([]);
  });

  it("virtueChoices excludes zero-rated virtues", async () => {
    const { dialog } = makeDialog({
      virtues: {
        compassion: { value: 3, current: 2 },
        temperance: { value: 0, current: 0 },
      }
    });
    const ctx = await dialog._prepareContext({});
    const keys = ctx.virtueChoices.map(v => v.key);
    expect(keys).toContain("compassion");
    expect(keys).not.toContain("temperance");
  });

  it("virtueChoices entries have key, label, current, rating", async () => {
    const { dialog } = makeDialog({
      virtues: { valor: { value: 2, current: 1 } }
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.virtueChoices[0]).toMatchObject({
      key:     "valor",
      label:   "EX2E.VirtueValor",
      current: 1,
      rating:  2,
    });
  });

  it("spreads _data properties into context", async () => {
    const { dialog } = makeDialog({ pool: 8, flavor: "Iron Skin" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.pool).toBe(8);
    expect(ctx.flavor).toBe("Iron Skin");
  });

  it("includes mentalInfluenceEffects from options", async () => {
    const effects = [{ id: "ae-1", keyword: "Emotion" }];
    const { dialog } = makeDialog({ mentalInfluenceEffects: effects });
    const ctx = await dialog._prepareContext({});
    expect(ctx.mentalInfluenceEffects).toBe(effects);
  });
});

// ── _onClose ──────────────────────────────────────────────────────────────────

describe("RollDialog._onClose", () => {
  it("resolves null when not yet resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._onClose({});
    expect(resolve).toHaveBeenCalledWith(null);
  });

  it("does not call resolve when already resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._resolved = true;
    dialog._onClose({});
    expect(resolve).not.toHaveBeenCalled();
  });
});

// ── static prompt ─────────────────────────────────────────────────────────────

describe("RollDialog.prompt", () => {
  it("returns a Promise", () => {
    const result = RollDialog.prompt({ pool: 5 });
    expect(result).toBeInstanceOf(Promise);
  });
});
