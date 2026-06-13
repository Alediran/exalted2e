import { vi, describe, it, expect } from "vitest";
import { Step2SocialDefenseDialog } from "../../module/dialogs/step2-social-defense-dialog.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCharm(overrides = {}) {
  return {
    id:   overrides.id   ?? "charm1",
    name: overrides.name ?? "Test Charm",
    system: {
      cost: { formula: overrides.formula ?? "", motes: overrides.motes ?? 0 },
    },
  };
}

function makeDialog(options = {}) {
  const resolve = vi.fn();
  const dialog  = new Step2SocialDefenseDialog(options, resolve);
  return { dialog, resolve };
}

// ── constructor ───────────────────────────────────────────────────────────────

describe("Step2SocialDefenseDialog constructor", () => {
  it("defaults intent to 'build'", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.intent).toBe("build");
  });

  it("accepts intent override", () => {
    const { dialog } = makeDialog({ intent: "erode" });
    expect(dialog._data.intent).toBe("erode");
  });

  it("defaults defenderMDV to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.defenderMDV).toBe(0);
  });

  it("accepts defenderMDV override", () => {
    const { dialog } = makeDialog({ defenderMDV: 5 });
    expect(dialog._data.defenderMDV).toBe(5);
  });

  it("defaults attackerSuccesses to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.attackerSuccesses).toBe(0);
  });

  it("defaults charms to []", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.charms).toEqual([]);
  });

  it("defaults targetName to null", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.targetName).toBeNull();
  });

  it("defaults excellency to { first: false, second: false }", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.excellency).toEqual({ first: false, second: false });
  });

  it("accepts firstExcMax and secondExcMax", () => {
    const { dialog } = makeDialog({ firstExcMax: 6, secondExcMax: 3 });
    expect(dialog._data.firstExcMax).toBe(6);
    expect(dialog._data.secondExcMax).toBe(3);
  });

  it("uses game.i18n.localize for secondExcLabel when not provided", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.secondExcLabel).toBe("EX2E.SecondExcellency");
  });

  it("starts with _resolved = false", () => {
    const { dialog } = makeDialog();
    expect(dialog._resolved).toBe(false);
  });
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("Step2SocialDefenseDialog._prepareContext", () => {
  it("intentLabelKey is EX2E.IntentBuild for 'build'", async () => {
    const { dialog } = makeDialog({ intent: "build" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.intentLabelKey).toBe("EX2E.IntentBuild");
  });

  it("intentLabelKey is EX2E.IntentErode for 'erode'", async () => {
    const { dialog } = makeDialog({ intent: "erode" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.intentLabelKey).toBe("EX2E.IntentErode");
  });

  it("intentLabelKey is EX2E.IntentCompel for 'compel'", async () => {
    const { dialog } = makeDialog({ intent: "compel" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.intentLabelKey).toBe("EX2E.IntentCompel");
  });

  it("intentLabelKey falls back to EX2E.SocialAttack for unknown intent", async () => {
    const { dialog } = makeDialog({ intent: "unknown" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.intentLabelKey).toBe("EX2E.SocialAttack");
  });

  it("includes defenderMDV in context", async () => {
    const { dialog } = makeDialog({ defenderMDV: 4 });
    const ctx = await dialog._prepareContext({});
    expect(ctx.defenderMDV).toBe(4);
  });

  it("includes attackerSuccesses in context", async () => {
    const { dialog } = makeDialog({ attackerSuccesses: 3 });
    const ctx = await dialog._prepareContext({});
    expect(ctx.attackerSuccesses).toBe(3);
  });

  it("includes targetName in context", async () => {
    const { dialog } = makeDialog({ targetName: "Merchant" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.targetName).toBe("Merchant");
  });

  it("hasExcellency is true when first excellency is available", async () => {
    const { dialog } = makeDialog({ excellency: { first: true, second: false } });
    const ctx = await dialog._prepareContext({});
    expect(ctx.hasExcellency).toBe(true);
  });

  it("hasExcellency is true when second excellency is available", async () => {
    const { dialog } = makeDialog({ excellency: { first: false, second: true } });
    const ctx = await dialog._prepareContext({});
    expect(ctx.hasExcellency).toBe(true);
  });

  it("hasExcellency is false when neither excellency is available", async () => {
    const { dialog } = makeDialog({ excellency: { first: false, second: false } });
    const ctx = await dialog._prepareContext({});
    expect(ctx.hasExcellency).toBe(false);
  });

  it("maps charms to rows with id and name", async () => {
    const charms = [makeCharm({ id: "c1", name: "Iron Skin Concentration" })];
    const { dialog } = makeDialog({ charms });
    const ctx = await dialog._prepareContext({});
    expect(ctx.charms[0].id).toBe("c1");
    expect(ctx.charms[0].name).toBe("Iron Skin Concentration");
  });

  it("builds costLabel from charm formula", async () => {
    const charms = [makeCharm({ formula: "2m" })];
    const { dialog } = makeDialog({ charms });
    const ctx = await dialog._prepareContext({});
    expect(ctx.charms[0].costLabel).toBe("2m");
  });

  it("costLabel is empty when formula is blank", async () => {
    const charms = [makeCharm({ formula: "" })];
    const { dialog } = makeDialog({ charms });
    const ctx = await dialog._prepareContext({});
    expect(ctx.charms[0].costLabel).toBe("");
  });

  it("includes moteTypeChoices with personal and peripheral", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.moteTypeChoices).toHaveProperty("personal");
    expect(ctx.moteTypeChoices).toHaveProperty("peripheral");
  });

  it("includes firstExcMax and secondExcMax", async () => {
    const { dialog } = makeDialog({ firstExcMax: 8, secondExcMax: 4 });
    const ctx = await dialog._prepareContext({});
    expect(ctx.firstExcMax).toBe(8);
    expect(ctx.secondExcMax).toBe(4);
  });
});

// ── _onClose ──────────────────────────────────────────────────────────────────

describe("Step2SocialDefenseDialog._onClose", () => {
  it("resolves null when dialog was not yet resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._onClose({});
    expect(resolve).toHaveBeenCalledWith(null);
  });

  it("does not resolve again when dialog was already resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._resolved = true;
    dialog._onClose({});
    expect(resolve).not.toHaveBeenCalled();
  });
});

// ── static prompt ─────────────────────────────────────────────────────────────

describe("Step2SocialDefenseDialog.prompt", () => {
  it("returns a Promise", () => {
    const result = Step2SocialDefenseDialog.prompt({});
    expect(result).toBeInstanceOf(Promise);
  });
});
