import { vi, describe, it, expect, beforeEach } from "vitest";
import { Step2DefenseDialog } from "../../module/dialogs/step2-defense-dialog.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCharm(overrides = {}) {
  return {
    id:   overrides.id   ?? "charm1",
    name: overrides.name ?? "Test Charm",
    system: {
      cost: { formula: overrides.formula ?? "", motes: overrides.motes ?? 0 },
      ...overrides.system,
    },
  };
}

function makeDialog(options = {}) {
  const resolve = vi.fn();
  const dialog  = new Step2DefenseDialog(options, resolve);
  return { dialog, resolve };
}

// ── constructor ───────────────────────────────────────────────────────────────

describe("Step2DefenseDialog constructor", () => {
  it("defaults defenseType to 'dodge'", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.defenseType).toBe("dodge");
  });

  it("accepts defenseType override", () => {
    const { dialog } = makeDialog({ defenseType: "parry" });
    expect(dialog._data.defenseType).toBe("parry");
  });

  it("defaults dv to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.dv).toBe(0);
  });

  it("accepts dv override", () => {
    const { dialog } = makeDialog({ dv: 5 });
    expect(dialog._data.dv).toBe(5);
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
    const { dialog } = makeDialog({ firstExcMax: 8, secondExcMax: 4 });
    expect(dialog._data.firstExcMax).toBe(8);
    expect(dialog._data.secondExcMax).toBe(4);
  });

  it("uses game.i18n.localize for firstExcLabel when not provided", () => {
    const { dialog } = makeDialog();
    expect(dialog._data.firstExcLabel).toBe("EX2E.FirstExcellency");
  });

  it("uses provided firstExcLabel when given", () => {
    const { dialog } = makeDialog({ firstExcLabel: "Custom Label" });
    expect(dialog._data.firstExcLabel).toBe("Custom Label");
  });

  it("starts with _resolved = false", () => {
    const { dialog } = makeDialog();
    expect(dialog._resolved).toBe(false);
  });
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("Step2DefenseDialog._prepareContext", () => {
  it("sets defenseLabelKey to EX2E.DodgeDV for dodge type", async () => {
    const { dialog } = makeDialog({ defenseType: "dodge" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.defenseLabelKey).toBe("EX2E.DodgeDV");
  });

  it("sets defenseLabelKey to EX2E.ParryDV for parry type", async () => {
    const { dialog } = makeDialog({ defenseType: "parry" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.defenseLabelKey).toBe("EX2E.ParryDV");
  });

  it("includes dv in context", async () => {
    const { dialog } = makeDialog({ dv: 7 });
    const ctx = await dialog._prepareContext({});
    expect(ctx.dv).toBe(7);
  });

  it("includes targetName in context", async () => {
    const { dialog } = makeDialog({ targetName: "Enemy" });
    const ctx = await dialog._prepareContext({});
    expect(ctx.targetName).toBe("Enemy");
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

  it("maps charm list to rows with id and name", async () => {
    const charms = [makeCharm({ id: "c1", name: "Solar Bolt" })];
    const { dialog } = makeDialog({ charms });
    const ctx = await dialog._prepareContext({});
    expect(ctx.charms[0].id).toBe("c1");
    expect(ctx.charms[0].name).toBe("Solar Bolt");
  });

  it("builds costLabel from charm formula", async () => {
    const charms = [makeCharm({ formula: "3m" })];
    const { dialog } = makeDialog({ charms });
    const ctx = await dialog._prepareContext({});
    expect(ctx.charms[0].costLabel).toBe("3m");
  });

  it("costLabel is empty string when formula is blank", async () => {
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

  it("includes firstExcMax and secondExcMax from _data", async () => {
    const { dialog } = makeDialog({ firstExcMax: 10, secondExcMax: 5 });
    const ctx = await dialog._prepareContext({});
    expect(ctx.firstExcMax).toBe(10);
    expect(ctx.secondExcMax).toBe(5);
  });
});

// ── _onClose ──────────────────────────────────────────────────────────────────

describe("Step2DefenseDialog._onClose", () => {
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

describe("Step2DefenseDialog.prompt", () => {
  it("returns a Promise", () => {
    const result = Step2DefenseDialog.prompt({});
    expect(result).toBeInstanceOf(Promise);
    // avoid unresolved promise — cancel it by accessing the dialog's resolve
    // The dialog was rendered (render() is a no-op in tests), so we can safely ignore
  });
});
