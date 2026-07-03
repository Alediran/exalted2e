import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ActionBarConfig } from "../../module/apps/action-bar-config.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

let settingsSpy;

beforeEach(() => {
  settingsSpy = vi.spyOn(game.settings, "get").mockReturnValue([]);
});

afterEach(() => {
  settingsSpy.mockRestore();
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("ActionBarConfig._prepareContext", () => {
  it("returns a rows array", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    expect(Array.isArray(ctx.rows)).toBe(true);
  });

  it("rows is non-empty (cast + non-clinchOnly actions)", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    expect(ctx.rows.length).toBeGreaterThan(1);
  });

  it("first row is always cast", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    expect(ctx.rows[0].key).toBe("cast");
  });

  it("rows exclude clinchOnly actions", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    const keys = ctx.rows.map(r => r.key);
    expect(keys).not.toContain("clinchHold");
    expect(keys).not.toContain("clinchCrush");
    expect(keys).not.toContain("clinchThrow");
  });

  it("all rows have checked false when actionBarPinned is empty", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    expect(ctx.rows.every(r => r.checked === false)).toBe(true);
  });

  it("pinned row has checked true", async () => {
    settingsSpy.mockReturnValue(["guard"]);
    const ctx = await new ActionBarConfig()._prepareContext({});
    const guard = ctx.rows.find(r => r.key === "guard");
    expect(guard?.checked).toBe(true);
  });

  it("pinned rows appear before unpinned rows", async () => {
    settingsSpy.mockReturnValue(["thaumaturgy"]);
    const ctx = await new ActionBarConfig()._prepareContext({});
    const firstChecked   = ctx.rows.findIndex(r => r.checked);
    const firstUnchecked = ctx.rows.findIndex(r => !r.checked);
    expect(firstChecked).toBeLessThan(firstUnchecked);
  });

  it("each row has key, labelKey, and checked properties", async () => {
    const ctx = await new ActionBarConfig()._prepareContext({});
    for (const row of ctx.rows) {
      expect(row).toHaveProperty("key");
      expect(row).toHaveProperty("labelKey");
      expect(row).toHaveProperty("checked");
    }
  });

  it("reads actionBarPinned from game.settings", async () => {
    await new ActionBarConfig()._prepareContext({});
    expect(settingsSpy).toHaveBeenCalledWith("exalted2e", "actionBarPinned");
  });
});
