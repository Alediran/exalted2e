import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NativeMaStylesConfig } from "../../module/apps/native-ma-styles-config.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

let settingsSpy;

beforeEach(() => {
  settingsSpy = vi.spyOn(game.settings, "get").mockReturnValue({});
});

afterEach(() => {
  settingsSpy.mockRestore();
});

// ── _prepareContext ───────────────────────────────────────────────────────────

describe("NativeMaStylesConfig._prepareContext", () => {
  it("returns a splats array", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    expect(Array.isArray(ctx.splats)).toBe(true);
  });

  it("splats is non-empty", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    expect(ctx.splats.length).toBeGreaterThan(0);
  });

  it("excludes 'mortal' from splats", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    expect(ctx.splats.map(s => s.key)).not.toContain("mortal");
  });

  it("excludes 'spirit' from splats", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    expect(ctx.splats.map(s => s.key)).not.toContain("spirit");
  });

  it("excludes 'martialarts' from splats", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    expect(ctx.splats.map(s => s.key)).not.toContain("martialarts");
  });

  it("includes standard exalt types", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    const keys = ctx.splats.map(s => s.key);
    expect(keys).toContain("solar");
    expect(keys).toContain("lunar");
    expect(keys).toContain("terrestrial");
  });

  it("each splat has key, label, and styles properties", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    for (const splat of ctx.splats) {
      expect(splat).toHaveProperty("key");
      expect(splat).toHaveProperty("label");
      expect(splat).toHaveProperty("styles");
    }
  });

  it("styles is empty string when saved has no entry for the splat", async () => {
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    const solar = ctx.splats.find(s => s.key === "solar");
    expect(solar?.styles).toBe("");
  });

  it("styles joins saved array with newlines", async () => {
    settingsSpy.mockReturnValue({ solar: ["White Veil", "Silver Pact"] });
    const ctx = await new NativeMaStylesConfig()._prepareContext({});
    const solar = ctx.splats.find(s => s.key === "solar");
    expect(solar?.styles).toBe("White Veil\nSilver Pact");
  });

  it("reads nativeMartialArtsStyles from game.settings", async () => {
    await new NativeMaStylesConfig()._prepareContext({});
    expect(settingsSpy).toHaveBeenCalledWith("exalted2e", "nativeMartialArtsStyles");
  });
});
