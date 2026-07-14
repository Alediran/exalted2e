import { vi, describe, it, expect, beforeAll } from "vitest";
import { CharmTreeDialog } from "../../module/apps/charm-tree-dialog.mjs";
import { EX2E } from "../../module/config.mjs";

// ── test environment setup ────────────────────────────────────────────────────

beforeAll(() => {
  game.exalted2e = { EX2E };
  game.packs     = { get: vi.fn().mockReturnValue(null) };
  game.items     = [];
});

// ── constructor / static open ─────────────────────────────────────────────────

describe("CharmTreeDialog constructor", () => {
  it("static open returns a CharmTreeDialog instance", () => {
    const dlg = CharmTreeDialog.open({ exaltType: "solar", groupKey: "archery" });
    expect(dlg).toBeInstanceOf(CharmTreeDialog);
  });

  it("static open with no args returns a CharmTreeDialog instance", () => {
    const dlg = CharmTreeDialog.open();
    expect(dlg).toBeInstanceOf(CharmTreeDialog);
  });
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("CharmTreeDialog._prepareContext", () => {
  it("returns exactly 9 exaltType entries", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "archery" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.exaltTypes).toHaveLength(9);
  });

  it("defaults exaltType to 'solar' when not provided", async () => {
    const dlg = new CharmTreeDialog({});
    const ctx = await dlg._prepareContext({});
    expect(ctx.selectedExaltType).toBe("solar");
  });

  it("reflects provided exaltType in selectedExaltType", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "lunar", groupKey: "strength" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.selectedExaltType).toBe("lunar");
  });

  it("reflects provided groupKey in selectedGroupKey", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "melee" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.selectedGroupKey).toBe("melee");
  });

  it("showPrompt is false when both exaltType and groupKey are set", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "archery" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.showPrompt).toBe(false);
  });

  it("showPrompt is false when groupKey is null but exaltType has options (auto-selects first)", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar" });
    const ctx = await dlg._prepareContext({});
    // solar builds groupOptions from EX2E.abilities — auto-selects first
    expect(ctx.showPrompt).toBe(false);
  });

  // ── Solar / ability-based exalts ──────────────────────────────────────────

  it("solar groupOptions has one group with label null", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "archery" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.groupOptions).toHaveLength(1);
    expect(ctx.groupOptions[0].label).toBeNull();
  });

  it("solar groupOptions includes ability keys from EX2E.abilities", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "archery" });
    const ctx = await dlg._prepareContext({});
    const keys = ctx.groupOptions[0].options.map(pair => pair[1]);
    expect(keys).toContain("archery");
    expect(keys).toContain("melee");
  });

  // ── Lunar / attribute-based exalts ────────────────────────────────────────

  it("lunar groupOptions has one group with label null", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "lunar", groupKey: "strength" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.groupOptions).toHaveLength(1);
    expect(ctx.groupOptions[0].label).toBeNull();
  });

  it("lunar groupOptions includes attribute keys", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "lunar", groupKey: "strength" });
    const ctx = await dlg._prepareContext({});
    const keys = ctx.groupOptions[0].options.map(pair => pair[1]);
    expect(keys).toContain("strength");
    expect(keys).toContain("dexterity");
    expect(keys).toContain("perception");
  });

  // ── Alchemical (same as lunar) ────────────────────────────────────────────

  it("alchemical groupOptions includes attribute keys", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "alchemical", groupKey: "strength" });
    const ctx = await dlg._prepareContext({});
    const keys = ctx.groupOptions[0].options.map(pair => pair[1]);
    expect(keys).toContain("strength");
  });

  // ── Infernal ──────────────────────────────────────────────────────────────

  it("infernal groupOptions has one group with label null", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "infernal", groupKey: "malfeas" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.groupOptions).toHaveLength(1);
    expect(ctx.groupOptions[0].label).toBeNull();
  });

  it("infernal groupOptions includes yoziPatron keys", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "infernal", groupKey: "malfeas" });
    const ctx = await dlg._prepareContext({});
    const keys = ctx.groupOptions[0].options.map(pair => pair[1]);
    expect(keys).toContain("malfeas");
    expect(keys).toContain("cecelyne");
  });

  // ── Martialarts (no packs or items) ──────────────────────────────────────

  it("martialarts with no packs or world items returns empty groupOptions", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "martialarts" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.groupOptions).toEqual([]);
  });

  it("martialarts with empty sources sets showPrompt true", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "martialarts" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.showPrompt).toBe(true);
  });

  // ── sources ───────────────────────────────────────────────────────────────

  it("sources object is included in context", async () => {
    const dlg = new CharmTreeDialog({}, { exaltType: "solar", groupKey: "archery" });
    const ctx = await dlg._prepareContext({});
    expect(ctx.sources).toMatchObject({
      systemPack: expect.any(Boolean),
      worldPacks: expect.any(Boolean),
      worldItems: expect.any(Boolean),
    });
  });
});
